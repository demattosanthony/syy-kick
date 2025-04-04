// External dependencies
import { CoreMessage, generateText, tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

// Internal configuration
import { CONFIG } from "../../config/constants";
import db from "../../config/db";
import reranker from "../../config/reranker";
import s3 from "../../config/s3";
import {
  documentThumbnails,
  KnowledgeBase,
  MessageAttachment,
  messageAttachments,
  messages,
  Project,
  threads,
  toolCalls,
} from "../../config/schema";
import { Workspace } from "../../middleware";

// Internal utilities
import { generateThreadTitle, getPdfPageAsImage } from "../../utils";

// Feature imports
import { ModelConfig, MODELS } from "../models";
import {
  DocumentSearchToolResult,
  MyMessage,
  ThreadWithMessages,
} from "./threads.types";
import { DbUser } from "../../createAuthToken";
import { PermissionManager } from "../permissions/permissions.tools";
import { Permissions } from "../permissions/permissions.types";
import { searchKnowledgeBaseDocuments } from "../knowledge-bases/knowledge-bases.ops";
import { documentsOps } from "../projects/docs/documents.ops";

/** Retrieve the model config. */
async function getModelConfig(model: string) {
  if (model !== "Auto") return MODELS[model];

  return MODELS["claude-3.5-sonnet"];
}

/** If environment is production and user allows, return a presigned URL, else base64. */
async function generateAttachmentData(
  fileKey: string,
  mimeType?: string,
  allowUrl?: boolean
): Promise<string> {
  if (allowUrl && CONFIG.__prod__) {
    return s3.file(fileKey).presign({ expiresIn: 3600 });
  }
  const buffer = Buffer.from(await s3.file(fileKey).arrayBuffer());
  return buffer.toString("base64");
}

/** Adds presigned URLs (or base64 data) to each attachment. */
async function processAttachments(attachments: MessageAttachment[]) {
  try {
    const processed: MessageAttachment[] = [];
    for (const att of attachments) {
      const url = s3.file(att.fileKey).presign({ expiresIn: 3600 });
      processed.push({ ...att, url });
    }
    return processed;
  } catch (error) {
    console.error("Error processing attachments:", error);
    return attachments;
  }
}

/** Converts reranked search results to XML format for AI consumption */
function convertResultsToXml(docs: DocumentSearchToolResult[]): string {
  return `<documents_context>${docs
    .map(
      (doc) => `
<document>
  <document_id>${doc.documentId}</document_id>
  <source>${doc.documentName}</source>
  <snippet>${doc.text}</snippet>
  <score>${doc.similarity}</score>
</document>`
    )
    .join("\n\n")}
</documents_context>`;
}

/** Extracts unique documents, treating PDF pages as separate docs */
function getUniqueDocuments(
  docs: DocumentSearchToolResult[]
): DocumentSearchToolResult[] {
  const uniqueDocsMap = new Map<string, DocumentSearchToolResult>();
  for (const doc of docs) {
    const key = doc.pageNumber
      ? `${doc.documentId}_page${doc.pageNumber}`
      : doc.documentId;
    if (!uniqueDocsMap.has(key)) {
      uniqueDocsMap.set(key, doc);
    }
  }
  return Array.from(uniqueDocsMap.values());
}

/** Processes a PDF document and returns its page as an image data URL */
async function processPdfDocument(doc: DocumentSearchToolResult): Promise<{
  fileKey: string;
  imageData: string;
  mimeType: string;
} | null> {
  try {
    if (!doc.pageNumber || !doc.fileKey) {
      return null;
    }

    // Check if thumbnail already exists
    const existingThumbnail = await db.query.documentThumbnails.findFirst({
      where: and(
        eq(documentThumbnails.documentId, doc.documentId),
        eq(documentThumbnails.pageNumber, doc.pageNumber)
      ),
    });

    if (existingThumbnail) {
      // Return existing thumbnail
      return {
        fileKey: existingThumbnail.fileKey,
        imageData: await generateAttachmentData(existingThumbnail.fileKey),
        mimeType: "image/png",
      };
    }

    // Fetch and convert PDF page to image
    const pdfBytes = await s3.file(doc.fileKey).bytes();
    const base64Image = await getPdfPageAsImage(pdfBytes, doc.pageNumber);

    // Store converted image
    const imageKey = `document-thumbnails/${doc.documentId}_page${doc.pageNumber}.png`;
    await s3
      .file(imageKey)
      .write(Buffer.from(base64Image, "base64"), { type: "image/png" });

    // Save thumbnail reference in database
    await db.insert(documentThumbnails).values({
      documentId: doc.documentId,
      pageNumber: doc.pageNumber,
      fileKey: imageKey,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return {
      fileKey: imageKey,
      imageData: base64Image,
      mimeType: "image/png",
    };
  } catch (error) {
    console.error("Error processing PDF document:", error);
    return null;
  }
}

/** Processes documents and returns image data URLs for supported types */
async function processDocumentImages(docs: DocumentSearchToolResult[]): Promise<
  {
    fileKey: string;
    imageData: string;
    mimeType: string;
  }[]
> {
  // Process all documents in parallel
  const processingPromises = docs.map(async (doc) => {
    try {
      if (doc.mimeType === "application/pdf") {
        return await processPdfDocument(doc);
      } else if (
        (doc.mimeType?.includes("image/png") ||
          doc.mimeType?.includes("image/jpg") ||
          doc.mimeType?.includes("image/jpeg")) &&
        doc.fileKey
      ) {
        const imageData = await generateAttachmentData(doc.fileKey);
        return {
          fileKey: doc.fileKey,
          imageData,
          mimeType: doc.mimeType,
        };
      }
      return null;
    } catch (error) {
      console.error("Error processing document:", error);
      return null;
    }
  });

  // Wait for all processing to complete and filter out nulls
  const results = (await Promise.all(processingPromises)).filter(
    (result): result is NonNullable<typeof result> => result !== null
  );

  return results;
}

function formatDocumentSearchResults(
  docs: DocumentSearchToolResult[],
  images: { fileKey: string; imageData: string; mimeType: string }[]
) {
  const context = convertResultsToXml(docs);
  return {
    context,
    docs,
    images,
    dataForFrontend: docs.map((doc) => ({
      document_id: doc.documentId,
      path: doc.path,
      projectId: doc.projectId,
      source: doc.documentName,
      snippet: doc.text,
      score: doc.similarity,
      page: doc.pageNumber,
      url: doc.fileKey
        ? s3.file(doc.fileKey).presign({ expiresIn: 3600 })
        : undefined,
    })),
  };
}

/** Tool to search all project information */
const createProjectSearchTool = (
  modelConfig: ModelConfig,
  workspace: Workspace,
  user: DbUser,
  projectId?: string
) =>
  tool({
    description: `Search project documents and retrieve relevant information.

Usage:
    1. Use when you need specific information from project documents not available in the conversation history.
    2. Provide a clear, specific query to search across all project documents.
    3. Best for technical details, specifications, or project-specific information.
    4. Avoid using for general questions or when information is already in the conversation.

Returns:
    - Relevant document excerpts with context
    - Document metadata (name, path, type)
    - Visual previews for supported document types`,
    parameters: z.object({
      query: z.string(),
    }),
    execute: async ({ query }) => {
      // Determine project IDs based on workspace type
      let projectIds: string[] | undefined;

      try {
        // Handle organization workspace
        if (workspace.type === "organization") {
          if (projectId) {
            // Check user's access to the specific project
            const orgRole = await PermissionManager.getUserOrganisationRole(
              user.id,
              workspace.id
            );

            // Admins and managers have access to all projects
            const isAdmin = [
              Permissions.Roles.SUPER_ADMIN,
              Permissions.Roles.ORGANIZATION_ADMIN,
              Permissions.Roles.ORGANIZATION_MANAGER,
            ].includes(orgRole?.role.name as Permissions.Roles);

            if (isAdmin) {
              projectIds = [projectId];
            } else {
              // Check regular member's access to the project
              if (!orgRole) {
                throw new Error("User is not a member of the organization");
              }

              const resourceId = await PermissionManager.getResourseId(
                Permissions.Resources.ORGANIZATION_PROJECT_DOCS
              );

              if (!resourceId) {
                throw new Error("Resource not found");
              }

              const hasAccess =
                await PermissionManager.userHasAccessToRessource(
                  orgRole,
                  workspace.id,
                  resourceId,
                  Permissions.Actions.READ,
                  projectId
                );

              if (!hasAccess) {
                throw new Error("User does not have access to the project");
              }

              projectIds = [projectId];
            }
          } else {
            // No specific project ID, get all accessible projects
            projectIds = await PermissionManager.getUserOrgProjectsIds(
              user.id,
              workspace.id
            );
          }
        } else if (projectId) {
          // For non-organization workspaces with a projectId
          projectIds = [projectId];
        }
      } catch (error) {
        console.error("Error determining project IDs:", error);
        return {
          images: [],
          context: "",
          docs: [],
          dataForFrontend: [],
        };
      }

      try {
        // Execute the search with the determined project IDs
        const res = await documentsOps.searchProjectDocuments({
          query,
          workspace,
          projectIds,
          limit: 80,
        });
        console.log("Search results:", res.length);

        // Rerank results
        const rerankedResults = await reranker.rerank(
          query,
          res.map((r) => r.text || ""),
          {
            topN: 20,
            returnDocuments: true,
          }
        );

        // Create a map of text to original result for lookup
        const textToResultMap = new Map(res.map((r) => [r.text, r]));

        // Map reranked results to simplified schema
        const simplifiedDocs: DocumentSearchToolResult[] =
          rerankedResults.results?.map((reranked) => {
            const originalDoc = textToResultMap.get(reranked.document.text)!;
            return {
              documentId: originalDoc.document.id,
              projectId: originalDoc.document.projectId || projectId || "", // Fallback to parameter or empty string
              path: originalDoc.document.path,
              documentName: originalDoc.document.name,
              text: originalDoc.text,
              similarity: reranked.relevance_score,
              pageNumber: (originalDoc.metadata as { page_number?: number })
                ?.page_number,
              mimeType: originalDoc.document.mimeType,
              fileKey: originalDoc.document.fileKey,
            };
          });
        console.log("Simplified docs length:", simplifiedDocs.length);

        // Generate final output
        const uniqueDocs = getUniqueDocuments(simplifiedDocs);
        const images =
          modelConfig.model.modelId.includes("claude-3-7-sonnet") ||
          modelConfig.model.modelId.includes("claude-3-5-sonnet")
            ? await processDocumentImages(uniqueDocs)
            : [];

        return formatDocumentSearchResults(uniqueDocs, images);
      } catch (error) {
        console.error("Error searching project documents:", error);
        return {
          images: [],
          context: "",
          docs: [],
          dataForFrontend: [],
        };
      }
    },
    experimental_toToolResultContent(result) {
      if (!result) {
        return [];
      }
      return [
        ...result.images.map((image) => ({
          type: "image" as const,
          data: image.imageData,
          mimeType: image.mimeType,
        })),
        {
          type: "text",
          text: result.context,
        },
      ];
    },
  });

/** Tool to search knowledge base documents */
const createKnowledgeBaseSearchTool = (
  modelConfig: ModelConfig,
  knowledgeBase?: KnowledgeBase
) =>
  tool({
    description: `${
      knowledgeBase
        ? `This tool allows you to retrieve information from the "${knowledgeBase.name}" knowledge base.`
        : `This tool allows you to retrieve information from a Knowledge Base.`
    }

Usage:
    1. Use when you need information stored within a designated knowledge base.

Returns:
    - Relevant document excerpts with context
    - Document metadata (name, path)
    - Visual previews for supported document types`,
    parameters: z.object({
      query: z.string(),
      ...(knowledgeBase
        ? {}
        : {
            knowledgeBaseId: z
              .string()
              .describe("The ID of the knowledge base to search within."),
          }),
    }),
    execute: async ({ query, knowledgeBaseId }) => {
      const targetKnowledgeBaseId: string = knowledgeBase
        ? knowledgeBase.id
        : (knowledgeBaseId as string);

      try {
        // Execute the search within the specified knowledge base
        const res = await searchKnowledgeBaseDocuments({
          query,
          knowledgeBaseId: targetKnowledgeBaseId,
          limit: 80, // Same limit as project search for consistency
        });
        console.log(
          `Knowledge base search results for KB ${knowledgeBaseId}:`,
          res.length
        );

        // Rerank results
        const rerankedResults = await reranker.rerank(
          query,
          res.map((r) => r.text || ""),
          {
            topN: 20, // Same topN as project search
            returnDocuments: true,
          }
        );

        // Create a map of text to original result for lookup
        const textToResultMap = new Map(res.map((r) => [r.text, r]));

        // Map reranked results to simplified schema
        const simplifiedDocs: DocumentSearchToolResult[] =
          rerankedResults.results?.map((reranked) => {
            const originalDoc = textToResultMap.get(reranked.document.text)!;
            return {
              documentId: originalDoc.document.id,
              // Knowledge bases don't have project IDs, set to null or undefined
              projectId: undefined,
              path: originalDoc.document.path,
              documentName: originalDoc.document.name,
              text: originalDoc.text,
              similarity: reranked.relevance_score,
              pageNumber: (originalDoc.metadata as { page_number?: number })
                ?.page_number,
              mimeType: originalDoc.document.mimeType,
              fileKey: originalDoc.document.fileKey,
              // Add knowledgeBaseId for frontend context if needed
              knowledgeBaseId: targetKnowledgeBaseId,
            };
          }) ?? []; // Ensure it defaults to an empty array if results are null/undefined
        console.log(
          "Simplified knowledge base docs length:",
          simplifiedDocs.length
        );

        // Generate final output
        const uniqueDocs = getUniqueDocuments(simplifiedDocs);
        const images = modelConfig.model.modelId.includes("claude-3.7-sonnet")
          ? await processDocumentImages(uniqueDocs)
          : [];

        return formatDocumentSearchResults(uniqueDocs, images);
      } catch (error) {
        console.error(
          `Error searching knowledge base ${targetKnowledgeBaseId}:`,
          error
        );
        // Return a structured error message
        return {
          images: [],
          context: `Error searching knowledge base: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          docs: [],
          dataForFrontend: [],
        };
      }
    },
    experimental_toToolResultContent(result) {
      if (!result || !result.context || result.context.startsWith("Error:")) {
        // Handle cases where execute returned an error or no result
        return [{ type: "text", text: result?.context || "No results found." }];
      }

      return [
        ...(result.images || []).map((image) => ({
          type: "image" as const,
          data: image.imageData,
          mimeType: image.mimeType,
        })),
        {
          type: "text",
          text: result.context,
        },
      ];
    },
  });

const createWebSearchTool = () =>
  tool({
    description: `Search the web for public information.

When to use:
- Product manuals and technical specifications
- Industry standards and building codes
- Manufacturer documentation
- General knowledge questions

When NOT to use:
- Project-specific information (use search_project_information instead)
- Information about your specific building or equipment
- Content in your uploaded documents

Tips:
- Use specific search terms including manufacturer names and model numbers
- Add "pdf" when looking for technical documents`,
    parameters: z.object({
      query: z.string(),
    }),
    execute: async ({ query }) => {
      const { text, sources, providerMetadata } = await generateText({
        model: MODELS["gemini-2.0-flash-online"].model,
        prompt: `Search the web for information on "${query}"`,
        maxTokens: 1200,
        temperature: 0,
      });

      const metadata = providerMetadata?.google as
        | Record<string, any>
        | undefined;
      const groundingMetadata = metadata?.groundingMetadata;
      let formattedText = text;

      // Add citations to text if groundingMetadata exists
      if (groundingMetadata?.groundingSupports?.length) {
        // Sort supports by startIndex descending to avoid position shifts
        const supports = [...groundingMetadata.groundingSupports].sort(
          (a, b) => (b.segment?.startIndex ?? 0) - (a.segment?.startIndex ?? 0)
        );

        for (const support of supports) {
          const { segment, groundingChunkIndices } = support;
          if (
            segment?.endIndex != null &&
            groundingChunkIndices?.length &&
            groundingChunkIndices[0] < sources.length
          ) {
            // Insert citation at the end of the segment
            const sourceIndex = groundingChunkIndices[0];
            formattedText =
              formattedText.substring(0, segment.endIndex) +
              ` [${sourceIndex + 1}]` +
              formattedText.substring(segment.endIndex);
          }
        }
      }

      // Process sources to resolve redirect URLs
      const processedSources = await Promise.all(
        sources.map(async (source) => {
          if (
            source.url?.includes(
              "vertexaisearch.cloud.google.com/grounding-api-redirect"
            )
          ) {
            try {
              const response = await fetch(source.url, {
                method: "HEAD",
                redirect: "manual",
              });
              const location = response.headers.get("location");
              if (location) return { ...source, url: location };
            } catch (error) {
              console.error("Error resolving redirect URL:", error);
            }
          }
          return source;
        })
      );

      return {
        text: formattedText,
        sources: processedSources,
        queries: groundingMetadata?.webSearchQueries,
      };
    },
  });

async function processThreadMessages(thread: ThreadWithMessages | null) {
  if (!thread) return null;
  for (const msg of thread.messages) {
    msg.attachments = await processAttachments(msg.attachments);

    msg.toolCalls = msg.toolCalls?.map((call) => {
      if (
        (call.toolName === "search_project_information" ||
          call.toolName === "search_projects_information" ||
          call.toolName === "search_knowledge_base_information" ||
          call.toolName === "search_documents") &&
        call.result?.docs
      ) {
        const uniqueDocs = getUniqueDocuments(call.result.docs);

        return {
          ...call,
          result: {
            ...call.result, // Preserve existing result properties
            dataForFrontend: uniqueDocs.map((doc) => ({
              document_id: doc.documentId,
              source: doc.documentName,
              snippet: doc.text,
              path: doc.path,
              score: doc.similarity,
              page: doc.pageNumber,
              projectId: doc.projectId,
              url: doc.fileKey
                ? s3.file(doc.fileKey).presign({ expiresIn: 3600 })
                : undefined,
            })),
          },
        };
      }

      // For other tool calls
      return call;
    });
  }

  return thread;
}

/** Constructs a "system" style message, appending user instructions if they exist. */
function buildSystemMessage(
  instructions?: string,
  project?: Project,
  knowledgeBase?: KnowledgeBase,
  knowledgeBases?: KnowledgeBase[]
): string {
  const dateString = new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  let knowledgeBasesString = "";
  if (knowledgeBases?.length) {
    knowledgeBasesString = knowledgeBases
      .map((kb) => `- Name: ${kb.name}, ID: ${kb.id}`)
      .join("\n");
  }

  let systemMsg = `You are Syykick, an AI Assistant with expertise in building design, construction, and operations. Your role is to provide accurate, helpful, and concise information to users in a chat interface.
  
The current date is: ${dateString}

You provide expert guidance on BIM, IFC/RVT models, COBie, project management, digital twins, knowledge graphs, AI integration, IoT devices, and facility assessments.
You think like an engineer: focus on accuracy, precision, efficiency, problem-solving, and adherence to specifications, standards, and project context.

Guidelines for interaction:
1. Keep responses short and simple unless the query requires a more detailed explanation.
2. Use clear, professional language appropriate for the building engineering field.
3. If you're unsure about an answer, state that you don't have enough information to provide a definitive response.
4. For long responses, consider using artifacts to present detailed information clearly.

Format your responses as follows:
1. For short answers (1-3 sentences), provide the response directly.
2. Do not nest lists or mix ordered and unordered lists.
3. Use bullet points sparingly.
4. Include code blocks with language specification when sharing code.
5. Incorporate tables for comparisons or data presentation.

Response Restrictions:
1. Do not use level 1 headers (#).
2. NEVER makes up any information. If you are collaborating with the user on a project they want information relevant to their work not general information.
3. Do not include URLs or links.
4. Avoid moralization or hedging language.
5. If search results are insufficient, state that the information is not available.
6. Never use phrases like "According to the search results" or similar constructions.

<knowledge_base_info>
A knowledge base is a collection of information that has been organized and curated to support you in providing accurate and relevant responses to user queries. Knowledge bases can contain a wide range of information, including technical specifications, best practices, industry standards, and reference materials.
Never tell the user a knowledge base id. This would confuse the user, just use the name instead.

${
  knowledgeBase
    ? `The user is currently focused on the "${knowledgeBase.name}". This knowledge base contains specific information that the user is interested in exploring. Prioritize searching and referencing this knowledge base when responding to user queries. Don't respond to the user first without checking this knowledge base for more context`
    : knowledgeBases?.length
    ? `Here are the following knowledge bases available for reference (use the ID when searching for information):
${knowledgeBasesString}`
    : ""
}
</knowledge_base_info>

<tools_use_instructions>
You have access to these three tools that help you find relevant information to better assist the user:

1. search_project_information:
   - Provides access to relveant context from the user's project.
   - Project-specific data, dimensions, or requirements
   - Any information that would only exist in the user's project files
   - Most of the time you should start with this tool

2. web_search:
   - External reference materials like equipment manuals or cut sheets
   - Industry standards, building codes, or regulatory information
   - Manufacturer specifications that are publicly available
   - General technical knowledge not specific to the user's project

3. search_knowledge_base:
   - Searching the knowledge bases for specific information
   - Accessing curated content from the knowledge bases
   - Finding detailed technical information or best practices

IMPORTANT: Whenever searching for information about the user's building, equipment, or project details, ALWAYS use search_project_information first. Only use web_search if the information needed is of a general nature that would exist on public websites.

For example:
- "What is the schedule for AHU-1?" → search_project_information
- "What are the specifications of the Trane RTAA chillers in our building?" → search_project_information
- "What does the Trane RTAA chiller installation manual recommend for pipe sizing?" → web_search
</tools_use_instructions>

<artifacts_info>
You can create and reference artifacts during conversations. Artifacts are for substantial, self-contained content that users might modify or reuse, displayed in a separate UI window for clarity.

# Good artifacts are...
- Substantial content (>15 lines)
- Content that the user is likely to modify, iterate on, or take ownership of
- Self-contained, complex content that can be understood on its own, without context from the conversation
- Content intended for eventual use outside the conversation (e.g., reports, emails, presentations)
- Content likely to be referenced or reused multiple times

# Don't use artifacts for...
- Simple, informational, or short content, such as brief code snippets, mathematical equations, or small examples
- Primarily explanatory, instructional, or illustrative content, such as examples provided to clarify a concept
- Suggestions, commentary, or feedback on existing artifacts
- Conversational or explanatory content that doesn't represent a standalone piece of work
- Content that is dependent on the current conversational context to be useful
- Content that is unlikely to be modified or iterated upon by the user
- Request from users that appears to be a one-off question

# Usage notes
- One artifact per message unless specifically requested
- Prefer in-line content (don't use artifacts) when possible. Unnecessary use of artifacts can be jarring for users.
- If a user asks you to "draw an SVG" or "make a website," you does not need to explain that it doesn't have these capabilities. Creating the code and placing it within the appropriate artifact will fulfill the user's intentions.
- If asked to generate an image, generate an SVG artifact instead. SVGs are more versatile and can be easily converted to other formats.
- You err on the side of simplicity and avoid overusing artifacts for content that can be effectively presented within the conversation.
- If a user asks for an Excel spreadsheet, you should create a CSV file instead, as this is a more universally compatible format. You should not explain this substitution unless specifically asked.
- When generating csv files, use quotes to wrap fields that contain commas so the csv file can be correctly parsed.

<artifact_instructions>
  When collaborating with the user on creating content that falls into compatible categories, follow these steps:

  1. Immediately before invoking an artifact, think for one sentence in <antThinking> tags about how it evaluates against the criteria for a good and bad artifact. Consider if the content would work just fine without an artifact. If it's artifact-worthy, in another sentence determine if it's a new artifact or an update to an existing one (most common). For updates, reuse the prior identifier.
  2. Wrap the content in opening and closing \`<antArtifact>\` tags.
  3. Assign an identifier to the \`identifier\` attribute of the opening \`<antArtifact>\` tag. For updates, reuse the prior identifier. For new artifacts, the identifier should be descriptive and relevant to the content, using kebab-case (e.g., "example-code-snippet"). This identifier will be used consistently throughout the artifact's lifecycle, even when updating or iterating on the artifact.
  4. Include a \`title\` attribute in the \`<antArtifact>\` tag to provide a brief title or description of the content.
  5. Add a \`type\` attribute to the opening \`<antArtifact>\` tag to specify the type of content the artifact represents. Assign one of the following values to the \`type\` attribute:
    - Code: "application/vnd.ant.code"
      - Use for code snippets or scripts in any programming language.
      - Include the language name as the value of the \`language\` attribute (e.g., \`language="python"\`).
      - Do not use triple backticks when putting code in an artifact.
    - Documents: "text/markdown"
      - Plain text, Markdown, or other formatted text documents
    - HTML: "text/html"
      - The user interface can render single file HTML pages placed within the artifact tags. HTML, JS, and CSS should be in a single file when using the \`text/html\` type.
      - Images from the web are not allowed, but you can use placeholder images by specifying the width and height like so \`<img src="/api/placeholder/400/320" alt="placeholder" />\`
      - The only place external scripts can be imported from is https://cdnjs.cloudflare.com
      - It is inappropriate to use "text/html" when sharing snippets, code samples & example HTML or CSS code, as it would be rendered as a webpage and the source code would be obscured. Use "application/vnd.ant.code" defined above.
      - If you are not able to follow the above requirements for any reason, use "application/vnd.ant.code" type for the artifact instead, which will not attempt to render the webpage.
    - SVG: "image/svg+xml"
      - The user interface will render the Scalable Vector Graphics (SVG) image within the artifact tags.
      - Specify the viewbox of the SVG rather than defining a width/height
    - Mermaid Diagrams: "application/vnd.ant.mermaid"
      - The user interface will render Mermaid diagrams placed within the artifact tags.
      - Do not put Mermaid code in a code block when using artifacts.
  6. Include the complete and updated content of the artifact, without any truncation or minimization. Don't use "// rest of the code remains the same...".
  7. If unsure whether the content qualifies as an artifact, if an artifact should be updated, or which type to assign to an artifact, err on the side of not creating an artifact.
</artifact_instructions>

Here are some examples of correct usage of artifacts by other AI assistants:

<examples>
  <example_docstring>
    This example demonstrates how to create a new artifact and reference it in the response.
  </example_docstring>

  <example>
    <user_query>Can you help me create a Python script to calculate the factorial of a number?</user_query>

    <assistant_response>
      Sure! Here's a Python script that calculates the factorial of a number:

      <antThinking>Creating a Python script to calculate factorials meets the criteria for a good artifact. It's a self-contained piece of code that can be understood on its own and is likely to be reused or modified. This is a new conversation, so there are no pre-existing artifacts. Therefore, I'm creating a new artifact.</antThinking>

      <antArtifact identifier="factorial-script" type="application/vnd.ant.code" language="python" title="Simple Python factorial script">
        def factorial(n):
            if n == 0:
                return 1
            else:
                return n * factorial(n - 1)

      ...
    </assistant_response>

  </example>

<example_docstring>
This example shows how to update an existing artifact and reference it in the response.
</example_docstring>

  <example>
    <user_query>Thanks for the factorial script! Can you modify it to handle invalid input gracefully?</user_query>

    <assistant_response>
      Good point! It's important to handle invalid input to prevent errors. I'll update the script to include input validation.

      <antThinking>This request is a direct modification of the existing "factorial-calculator" artifact. It's not a new artifact but an update to make the script more robust. I'll reuse the "factorial-calculator" identifier to maintain continuity and show the evolution of our code.</antThinking>

      <antArtifact identifier="factorial-script" type="application/vnd.ant.code" language="python" title="Simple Python factorial script">
        def factorial(n):
            if n == 0:
                return 1
            else:
                return n * factorial(n - 1)

        while True:
            try:
                num = int(input("Enter a non-negative integer: "))
                if num < 0:
                    raise ValueError
                break
            except ValueError:
                print("Invalid input. Please enter a non-negative integer.")

      ...
    </assistant_response>

  </example>

<example_docstring>
This example shows how to create an SVG artifact and reference it in the response.
</example_docstring>

  <example>
    <user_query>Can you draw a simple blue circle in SVG?</user_query>

    <assistant_response>
      I'll create a simple blue circle for you using SVG.

      <antThinking>Drawing a simple blue circle in SVG is a good candidate for an artifact. It's a standalone visual element that can be reused or modified. This is a new request, so I'll create a new artifact with the identifier "blue-circle-svg".</antThinking>

      <antArtifact identifier="blue-circle-svg" type="image/svg+xml" title="Simple blue circle SVG">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="blue" />
        </svg>
      </antArtifact>

      Here's a simple SVG image of a blue circle, as requested. The circle is centered at coordinates (50, 50) with a radius of 40 pixels, and it's filled with the color blue.

      ...
    </assistant_response>

  </example>

<example_docstring>
    This example demonstrates how to create a Mermaid artifact for a simple flow chart.
  </example_docstring>

  <example>
    <user_query>Can you create a simple flow chart showing the process of making tea using Mermaid?</user_query>

    <assistant_response>
      Sure! Here's a simple flow chart depicting the process of making tea using Mermaid syntax:

      <antThinking>Creating a flow chart to show the process of making tea is an excellent candidate for an artifact. It's a self-contained diagram that can be understood on its own and might be used in various contexts like a presentation or a how-to guide. This is a new request, so I'll create a new artifact with the identifier "tea-making-flowchart".</antThinking>

      <antArtifact identifier="tea-making-flowchart" type="application/vnd.ant.mermaid" title="Flow chart: Making Tea">
        graph TD
            A[Start] --> B{Water boiled?}
            B -->|Yes| C[Add tea leaves to cup]
            B -->|No| D[Boil water]
            D --> B
            C --> E[Pour boiling water into cup]
            E --> F[Steep tea for desired time]
            F --> G[Remove tea leaves]
            G --> H[Add milk or sugar, if desired]
            H --> I[Enjoy your tea!]
            I --> J[End]
      </antArtifact>

      This flow chart uses Mermaid syntax to visualize the steps involved in making a cup of tea.

      ...
    </assistant_response>
  </example>

<example_docstring>
This example demonstrates a preference to update existing artifacts, rather than create new ones.
</example_docstring>

  <example>
    <user_query>I'm teaching a beginner's programming course, and I want to include some interactive examples for the students to try out. Do you have any suggestions for simple programs that could help them understand basic concepts?</user_query>

    <assistant_response>
      Teaching a beginner's programming course is a great opportunity to introduce students to fundamental concepts through interactive examples. One idea that comes to mind is building upon the factorial calculator we discussed earlier.

      <antThinking>The interactive factorial calculator is a good artifact: it's substantial (>15 lines), self-contained, and usable outside the conversation. It's not simple informational or primarily explanatory content. This is an update to our existing "factorial-calculator" artifact, transforming it into a teaching tool.</antThinking>

      <antArtifact identifier="factorial-script" type="application/vnd.ant.code" language="python" title="Simple Python factorial script">
        def factorial(n):
            if n == 0:
                return 1
            else:
                return n * factorial(n - 1)

        def main():
            print("Welcome to the Factorial Calculator!")
            print("Enter a non-negative integer to calculate its factorial.")
            print("Enter 'q' to quit the program.")

            while True:
                user_input = input("

Enter a number (or 'q' to quit): ")

                if user_input == 'q':
                    print("Thank you for using the Factorial Calculator. Goodbye!")
                    break

                try:
                    num = int(user_input)
                    if num < 0:
                        raise ValueError
                    result = factorial(num)
                    print(f"The factorial of {num} is {result}")
                except ValueError:
                    print("Invalid input. Please enter a non-negative integer or 'q' to quit.")

        if __name__ == "__main__":
            main()
      </antArtifact>

      I've updated it to make it even more suitable as a learning example for your students. Here are the key changes:

      1. Separated the factorial calculation logic into its own function, \`factorial()\`. This demonstrates the concept of function definition and recursion.

      ...
    </assistant_response>

  </example>

<example_docstring>
This example demonstrates how to create a CSV artifact when a user asks for a building engineering spreadsheet.
</example_docstring>

  <example>
    <user_query>Can you create an Excel spreadsheet with COBie data for the HVAC equipment in our new office building?</user_query>

    <assistant_response>
      I'd be happy to create a COBie-formatted dataset for your HVAC equipment:

      <antThinking>Creating a COBie spreadsheet for HVAC equipment is an excellent candidate for an artifact. It's structured building engineering data that the user will likely want to modify or import into their BIM software. This is a new request, so I'll create a new artifact with a CSV format, even though the user asked for Excel, as CSV is more universally compatible.</antThinking>

      <antArtifact identifier="cobie-hvac-equipment" type="application/vnd.ant.code" language="csv" title="COBie HVAC Equipment Data">
Type,Name,CreatedBy,CreatedOn,Category,Description,Location,Manufacturer,ModelNumber,SerialNumber,InstallationDate,WarrantyStartDate,WarrantyEndDate,ReplacementCost
AHU,AHU-01,"John Smith",2023-05-15,"Air Handling Unit","Primary air handling unit for floors 1-3","Mechanical Room 101",Trane,CSAA025UA,TR78901234,2023-06-10,2023-06-10,2026-06-10,85000
FCU,FCU-1A,"John Smith",2023-05-15,"Fan Coil Unit","Fan coil unit serving Conference Room A","Floor 1 - Ceiling Plenum",Carrier,42CG25,CA45678901,2023-06-12,2023-06-12,2025-06-12,3500
FCU,FCU-1B,"John Smith",2023-05-15,"Fan Coil Unit","Fan coil unit serving Conference Room B","Floor 1 - Ceiling Plenum",Carrier,42CG25,CA45678902,2023-06-12,2023-06-12,2025-06-12,3500
VAV,VAV-1-01,"Jane Doe",2023-05-16,"Variable Air Volume Box","VAV box serving northeast offices","Floor 1 - Ceiling Plenum",Titus,DESV,TI12345601,2023-06-15,2023-06-15,2025-06-15,1200
VAV,VAV-1-02,"Jane Doe",2023-05-16,"Variable Air Volume Box","VAV box serving northwest offices","Floor 1 - Ceiling Plenum",Titus,DESV,TI12345602,2023-06-15,2023-06-15,2025-06-15,1200
      </antArtifact>

      Here's a CSV file containing COBie (Construction Operations Building Information Exchange) data for the HVAC equipment in your new office building. This includes air handling units, fan coil units, VAV boxes, chillers, pumps, cooling towers, and boilers with their relevant specifications and warranty information.

      This format is compatible with most BIM and facility management software. You can import this data directly into your building management system or expand it with additional equipment details as needed.
    </assistant_response>
  </example>

<example_docstring>
This example demonstrates a decision not to use an artifact because it would make the information less accessible and hinder the natural flow of the conversation.
</example_docstring>

  <example>
    <user_query>
      Can you give me a quick rundown of some common Python list methods? I'm new to Python and trying to understand the basics.
    </user_query>

    <assistant_response>
      Absolutely! Python lists are versatile and have many useful methods. Here's a quick overview of some common ones:

      <antThinking>The user asked about common Python list methods. While informative, putting this in a separate artifact window would make it harder for the user to quickly scan, understand, and ask follow-up questions. Keeping it in our chat makes the info more glanceable and our discussion more fluid.</antThinking>

      1. \`append(x)\`: Adds an item \`x\` to the end of the list.
        Example: \`my_list.append(4)\`

      2. \`extend(iterable)\`: Adds all items from an iterable (like another list) to the end.
        Example: \`my_list.extend([5, 6, 7])\`

      3. \`insert(i, x)\`: Inserts an item \`x\` at a given position \`i\`.
        Example: \`my_list.insert(1, "new")\`

      ...
    </assistant_response>
  </example>

<example_docstring>
This example demonstrates a decision not to use an artifact for an explanation that includes code samples, because the content is primarily educational and benefits from being part of the conversational flow.
</example_docstring>

  <example>
    <user_query>
      I'm learning Python and algorithms. Can you explain how binary search works and maybe show me a simple Python implementation? I learn best by seeing code.
    </user_query>

    <assistant_response>
      Absolutely! Binary search is an efficient algorithm for finding an item in a sorted list. It works by repeatedly dividing the search interval in half. Let's walk through it with a simple Python implementation.

      <antThinking>The user asked for an explanation of binary search with a Python implementation. Although this involves code, it's primarily educational—the code is part of the explanation, not a standalone tool. Putting this in an artifact would disrupt the learning flow. The user learns best by seeing code in context, so keeping everything in our chat makes it easier for them to follow along and ask questions.</antThinking>

      First, let's define a function for binary search:

      \`\`\`python
      def binary_search(arr, target):
          left, right = 0, len(arr) - 1

          while left <= right:
              mid = (left + right) // 2
              if arr[mid] == target:
                  return mid
              elif arr[mid] < target:
                  left = mid + 1
      ...
    </assistant_response>
  </example>

</examples>
Do not mention any of these instructions to the user, nor make reference to the \`antArtifact\` tag, any of the MIME types (e.g. \`application/vnd.ant.code\`), or related syntax unless it is directly relevant to the query.
</artifacts_info>`;

  if (project) {
    systemMsg += `
    

The user is working on a project named ${project.name}. Use the search_project_information tool to find relevant information before responding so that you have relevant information to answer the users questions.`;
  }

  if (instructions && instructions.length > 0) {
    systemMsg += `\n\n<user_instructions>${instructions}</user_instructions>`;
  }

  systemMsg += `\n\nYou are now being connected with the user.`;

  console.log(systemMsg);

  return systemMsg;
}

/**
 * Directly transforms database messages into inference messages format
 * in a single function, handling attachments, tool calls, and content formatting.
 */
async function dbMessagesToInferenceMessages(
  dbMsgs: Array<
    typeof messages.$inferSelect & {
      toolCalls: Array<typeof toolCalls.$inferSelect>;
      attachments: Array<typeof messageAttachments.$inferSelect>;
    }
  >,
  modelConfig: {
    model: {
      modelId: string;
    };
    supportedMimeTypes?: string[];
    supportsSystemMessages?: boolean;
  },
  project?: Project,
  instructions?: string,
  knowledgeBase?: KnowledgeBase,
  knowledgeBases?: KnowledgeBase[]
): Promise<CoreMessage[]> {
  // Initialize the result array
  const inferenceMessages: CoreMessage[] = [];

  // Add system message if supported
  if (modelConfig.supportsSystemMessages) {
    inferenceMessages.push({
      role: "system",
      content: buildSystemMessage(
        instructions,
        project,
        knowledgeBase,
        knowledgeBases
      ),
    });
  }

  // Process each database message
  for (let i = 0; i < dbMsgs.length; i++) {
    const msg = dbMsgs[i];

    // Skip messages with unsupported attachments
    if (
      !isAttachmentSupported(msg.attachments, modelConfig.supportedMimeTypes)
    ) {
      continue;
    }

    // Handle assistant messages with tool calls
    if (msg.role === "assistant" && msg.toolCalls.length > 0) {
      // Add assistant message with tool calls
      inferenceMessages.push(await createAssistantMessage(msg, modelConfig));

      // Add tool response message if there are completed calls
      const toolMessage = await createToolMessage(msg, modelConfig);
      if (toolMessage) {
        inferenceMessages.push(toolMessage);
      }
    } else {
      // Process regular message
      inferenceMessages.push(await createRegularMessage(msg, modelConfig));
    }
  }

  return inferenceMessages;
}

/**
 * Determines if all attachments in a message are supported by the model
 */
function isAttachmentSupported(
  attachments: Array<typeof messageAttachments.$inferSelect>,
  supportedMimeTypes?: string[]
): boolean {
  if (!attachments.length) return true; // No attachments, so supported

  // Check if all attachments are supported
  return attachments.every((attachment) =>
    supportedMimeTypes?.includes(attachment.mimeType || "")
  );
}

/**
 * Creates an assistant message with tool calls
 */
async function createAssistantMessage(
  msg: typeof messages.$inferSelect & {
    toolCalls: Array<typeof toolCalls.$inferSelect>;
    attachments: Array<typeof messageAttachments.$inferSelect>;
  },
  modelConfig: any
): Promise<CoreMessage> {
  const chunks = [];

  // Add text content if present
  if (msg.text) {
    chunks.push({ type: "text", text: msg.text });
  }

  // Add tool calls
  for (const call of msg.toolCalls) {
    chunks.push({
      type: "tool-call",
      toolCallId: call.toolCallId,
      toolName: call.toolName,
      args: call.args,
    });
  }

  // Process attachments
  const attachmentChunks = await createAttachmentMessages(msg.attachments);
  chunks.push(...attachmentChunks);

  return {
    role: "assistant",
    content: chunks,
  };
}

/**
 * Creates a tool message with results from completed tool calls
 */
async function createToolMessage(
  msg: typeof messages.$inferSelect & {
    toolCalls: Array<typeof toolCalls.$inferSelect>;
    attachments: Array<typeof messageAttachments.$inferSelect>;
  },
  modelConfig: {
    model: {
      modelId: string;
    };
  }
): Promise<CoreMessage | null> {
  const completedCalls = msg.toolCalls.filter(
    (call) => call.status === "completed" && call.result
  );

  if (completedCalls.length === 0) {
    return null;
  }

  const processedResults = await Promise.all(
    completedCalls.map(async (call) => {
      // Special handling for Claude 3.7 Sonnet
      if (
        modelConfig.model.modelId.includes("claude-3.7-sonnet") &&
        (call.toolName === "search_project_information" ||
          call.toolName === "search_documents" ||
          call.toolName === "search_projects_information")
      ) {
        return await processClaudeToolResult(call);
      }

      // Standard handling for other models
      return {
        type: "tool-result",
        toolCallId: call.toolCallId,
        toolName: call.toolName,
        result:
          call.toolName === "search_project_information" ||
          call.toolName === "search_documents" ||
          call.toolName === "search_projects_information"
            ? convertResultsToXml((call.result as any).docs)
            : call.result,
      };
    })
  );

  return {
    id: `${msg.id}_tool_results`,
    role: "tool",
    content: processedResults,
  } as MyMessage;
}

/**
 * Processes tool results specifically for Claude 3.7 Sonnet
 */
async function processClaudeToolResult(call: {
  toolCallId: string;
  toolName: string;
  result: any;
}): Promise<any> {
  const images = call.result.images || [];
  const imagesData = await Promise.all(
    images.map(async (image: { fileKey: string; mimeType: string }) => {
      return {
        type: "image" as const,
        data: await generateAttachmentData(image.fileKey),
        mimeType: image.mimeType,
      };
    })
  );

  return {
    type: "tool-result",
    toolCallId: call.toolCallId,
    toolName: call.toolName,
    experimental_content: [
      ...imagesData,
      {
        type: "text" as const,
        text: convertResultsToXml(call.result.docs),
      },
    ],
  };
}

/**
 * Creates a regular message (not an assistant with tool calls)
 */
async function createRegularMessage(
  msg: typeof messages.$inferSelect & {
    toolCalls: Array<typeof toolCalls.$inferSelect>;
    attachments: Array<typeof messageAttachments.$inferSelect>;
  },
  modelConfig: any
): Promise<CoreMessage> {
  const chunks = [];

  // Add text content
  if (msg.text) {
    chunks.push({ type: "text", text: msg.text });
  }

  // Process attachments
  const attachmentChunks = await createAttachmentMessages(msg.attachments);
  chunks.push(...attachmentChunks);

  return {
    id: msg.id,
    role: msg.role,
    content: chunks,
  } as MyMessage;
}

/**
 * Process attachments into appropriate chunks
 */
async function createAttachmentMessages(
  attachments: Array<typeof messageAttachments.$inferSelect>
): Promise<any[]> {
  const chunks = [];

  for (const att of attachments) {
    const data = await generateAttachmentData(att.fileKey, att.mimeType!, true);

    if (att.mimeType?.includes("image")) {
      chunks.push({
        type: "image",
        image: data,
        mimeType: att.mimeType,
      });
    } else {
      chunks.push({
        type: "file",
        data,
        mimeType: att.mimeType,
      });
    }
  }

  return chunks;
}

/** Generates a thread title from the first user message if it doesn’t already exist. */
async function maybeGenerateTitle(
  threadId: string,
  rawMessages: MyMessage[],
  existingTitle?: string | null
) {
  if (existingTitle) return; // no need to do anything if we have a title

  const firstUserTextMessage = rawMessages.find((msg) => msg.role === "user");
  if (!firstUserTextMessage) return;

  try {
    const textContent = Array.isArray(firstUserTextMessage.content)
      ? firstUserTextMessage.content.find((chunk) => chunk.type === "text")
          ?.text || ""
      : (firstUserTextMessage.content as string) || "";

    const title = await generateThreadTitle(textContent);
    await db.update(threads).set({ title }).where(eq(threads.id, threadId));
  } catch (error) {
    console.error("Error generating title", error);
  }
}

export {
  getModelConfig,
  generateAttachmentData,
  processAttachments,
  processThreadMessages,
  createProjectSearchTool,
  createWebSearchTool,
  createKnowledgeBaseSearchTool,
  processDocumentImages,
  dbMessagesToInferenceMessages,
  maybeGenerateTitle,
};
