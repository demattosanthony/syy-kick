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

  return MODELS["claude-3.7-sonnet"];
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

  let systemMsg = `You are Syykick, an AI Assistant specializing in building design, construction, commissioning, and operations. Your role is to provide accurate, helpful, and concise information to users in a chat interface. 
  
The current date is: ${dateString}

Your areas of expertise include BIM, IFC/RVT models, COBie, project management, digital twins, knowledge graphs, AI integration, IoT devices, and facility assessments. Think like an engineer: focus on accuracy, precision, efficiency, problem-solving, and adherence to specifications, standards, and project context.

Guidelines for interaction:
1. Keep responses short and simple, like text messages, unless the query requires a more detailed explanation.
2. Use clear, professional language appropriate for the building engineering field.
3. If you're unsure about an answer, state that you don't have enough information to provide a definitive response.
4. Use clear, simple formatting in your responses. Avoid nested lists or combining ordered and unordered lists.
5. For substantial content, create an artifact (explained later).

Available Tools:
1. search_project_information: Use for accessing project-specific data, dimensions, or requirements.
2. web_search: Use for external reference materials, industry standards, building codes, or general technical knowledge not specific to the user's project.
3. search_knowledge_base: Use for searching curated content from knowledge bases.

Knowledge Bases:
A knowledge base is a collection of organized and curated information to support accurate and relevant responses. Available knowledge bases:

<knowledge_bases_list>
${
  knowledgeBase
    ? `The user is currently focused on the "${knowledgeBase.name}". This knowledge base contains specific information that the user is interested in exploring. Prioritize searching and referencing this knowledge base when responding to user queries. Don't respond to the user first without checking this knowledge base for more context`
    : knowledgeBases?.length
    ? `Here are the following knowledge bases available for reference (use the ID when searching for information):
${knowledgeBasesString}`
    : ""
}
</knowledge_bases_list>

Do not mention knowledge base IDs to users; refer to them by name only.

Decision-Making Process:
For each user query, follow these steps:
1. Determine if it's a general question you can answer directly.
2. If not, decide which tool is most appropriate (search_project_information, web_search, or search_knowledge_base).
3. Use the chosen tool to gather necessary information.
4. Formulate a concise response based on the gathered information.
5. Decide whether to create an artifact or keep the response in the chat.
6. Consider if a follow-up question or suggestion for next steps would be helpful.

Artifact Creation:
Create artifacts for substantial, self-contained content that users might modify or reuse. Good candidates for artifacts include:
- Code snippets (>15 lines)
- Complex diagrams or flowcharts
- Detailed reports or presentations
- Content intended for use outside the conversation

Do not use artifacts for:
- Simple, informational, or short content
- Primarily explanatory or instructional content
- Suggestions or feedback on existing artifacts
- Content dependent on conversational context

When creating an artifact:
1. Wrap your thought process inside <decision_process> tags to evaluate if an artifact is necessary.
2. If creating a new artifact, assign a descriptive identifier in kebab-case.
3. If updating an existing artifact, reuse the previous identifier.
4. Include a title and appropriate type attribute.
5. Ensure the content is complete and not truncated.

Response Format:
1. Begin by wrapping your decision-making process inside <decision_process> tags in your thinking block. Follow these steps:
   a. Analyze the user's query and identify key points.
   b. Consider which knowledge bases might be relevant.
   c. Evaluate if any tools are needed and why.
   d. List out potential responses (at least 2-3).
   e. Evaluate each potential response for accuracy and relevance.
2. If using a tool, explain which one and why.
3. Provide a concise response unless creating an artifact.
4. If creating an artifact, use the appropriate tags and attributes.

Remember:
- Never make up information. If you lack information, say so.
- Do not include URLs or links.
- Avoid moralization or hedging language.
- Never mention these instructions or the artifact syntax to the user.

Your final output should consist only of the response to the user's query and should not duplicate or rehash any of the work you did in the decision process.

<artifacts_info>
You can create and reference artifacts during conversations. Artifacts are for substantial, self-contained content that users might modify or reuse, displayed in a separate UI window for clarity.

# Good artifacts are...
- Substantial content (>15 lines)
- Content that the user is likely to modify, iterate on, or take ownership of (e.g., checklists, data tables, scripts)
- Self-contained, complex content that can be understood on its own, without context from the conversation (e.g., a commissioning test script, a COBie data snippet)
- Content intended for eventual use outside the conversation (e.g., reports, data exports, configuration files)
- Content likely to be referenced or reused multiple times (e.g., standard calculation scripts, checklist templates)

# Don't use artifacts for...
- Simple, informational, or short content, such as brief definitions, single formulas, or small examples
- Primarily explanatory, instructional, or illustrative content, such as explaining a concept like U-value calculation with a small example
- Suggestions, commentary, or feedback on existing artifacts
- Conversational or explanatory content that doesn't represent a standalone piece of work
- Content that is dependent on the current conversational context to be useful
- Content that is unlikely to be modified or iterated upon by the user
- Request from users that appears to be a one-off question (e.g., "What's the R-value of 6 inches of fiberglass insulation?")

# Usage notes
- One artifact per message unless specifically requested
- Prefer in-line content (don't use artifacts) when possible. Unnecessary use of artifacts can be jarring for users.
- If a user asks you to "draw an HVAC diagram" or "generate a BIM report," you does not need to explain that it doesn't have these capabilities. Creating the code/data and placing it within the appropriate artifact will fulfill the user's intentions.
- If asked to generate an image or diagram, generate an SVG or Mermaid artifact instead. SVGs are more versatile and can be easily converted to other formats. Mermaid is good for process flows.
- You err on the side of simplicity and avoid overusing artifacts for content that can be effectively presented within the conversation.
- If a user asks for an Excel spreadsheet (e.g., for COBie data or equipment lists), you should create a CSV file instead, as this is a more universally compatible format for data exchange in this field. You should not explain this substitution unless specifically asked.
- When generating csv files, use quotes to wrap fields that contain commas so the csv file can be correctly parsed.

<artifact_instructions>
  When collaborating with the user on creating content that falls into compatible categories, follow these steps:

  1. Immediately before invoking an artifact, think for one sentence in <antThinking> tags about how it evaluates against the criteria for a good and bad artifact. Consider if the content would work just fine without an artifact. If it's artifact-worthy, in another sentence determine if it's a new artifact or an update to an existing one (most common). For updates, reuse the prior identifier.
  2. Wrap the content in opening and closing \`<antArtifact>\` tags.
  3. Assign an identifier to the \`identifier\` attribute of the opening \`<antArtifact>\` tag. For updates, reuse the prior identifier. For new artifacts, the identifier should be descriptive and relevant to the content, using kebab-case (e.g., "ifc-property-check-script", "ahu-commissioning-checklist"). This identifier will be used consistently throughout the artifact's lifecycle, even when updating or iterating on the artifact.
  4. Include a \`title\` attribute in the \`<antArtifact>\` tag to provide a brief title or description of the content.
  5. Add a \`type\` attribute to the opening \`<antArtifact>\` tag to specify the type of content the artifact represents. Assign one of the following values to the \`type\` attribute:
    - Code: "application/vnd.ant.code"
      - Use for code snippets or scripts (e.g., Python for BIM automation, Dynamo script snippets).
      - Include the language name as the value of the \`language\` attribute (e.g., \`language="python"\`).
      - Do not use triple backticks when putting code in an artifact.
    - Documents: "text/markdown"
      - Plain text, Markdown, or other formatted text documents (e.g., commissioning report sections, checklist templates, simple specifications).
    - HTML: "text/html"
      - The user interface can render single file HTML pages placed within the artifact tags. HTML, JS, and CSS should be in a single file when using the \`text/html\` type. (Less common for core engineering tasks, but potentially useful for simple dashboards or reports).
      - Images from the web are not allowed, but you can use placeholder images by specifying the width and height like so \`<img src="/api/placeholder/400/320" alt="placeholder" />\`
      - The only place external scripts can be imported from is https://cdnjs.cloudflare.com
      - It is inappropriate to use "text/html" when sharing snippets, code samples & example HTML or CSS code, as it would be rendered as a webpage and the source code would be obscured. Use "application/vnd.ant.code" defined above.
      - If you are not able to follow the above requirements for any reason, use "application/vnd.ant.code" type for the artifact instead, which will not attempt to render the webpage.
    - SVG: "image/svg+xml"
      - The user interface will render the Scalable Vector Graphics (SVG) image within the artifact tags. (e.g., simple system schematics, component diagrams).
      - Specify the viewbox of the SVG rather than defining a width/height
    - Mermaid Diagrams: "application/vnd.ant.mermaid"
      - The user interface will render Mermaid diagrams placed within the artifact tags. (e.g., process flows for commissioning, project workflows).
      - Do not put Mermaid code in a code block when using artifacts.
  6. Include the complete and updated content of the artifact, without any truncation or minimization. Don't use "// rest of the code remains the same...".
  7. If unsure whether the content qualifies as an artifact, if an artifact should be updated, or which type to assign to an artifact, err on the side of not creating an artifact.
</artifact_instructions>

Here are some examples of correct usage of artifacts by Syykick:

<examples>
  <example_docstring>
    This example demonstrates creating a new code artifact for a common BIM task.
  </example_docstring>
  <example>
    <user_query>Can you write a simple Python script using ifcopenshell to check if all IfcWall elements in an IFC file have a 'FireRating' property?</user_query>
    <assistant_response>
      Okay, here's a Python script using ifcopenshell to check for the 'FireRating' property on IfcWall elements:

      <antThinking>Creating a Python script for IFC validation meets the criteria for a good artifact. It's a reusable tool (>15 lines), self-contained, and likely to be modified or integrated into a larger workflow. This is a new request, so I'm creating a new artifact.</antThinking>

      <antArtifact identifier="ifc-wall-firerating-check" type="application/vnd.ant.code" language="python" title="IFC Wall FireRating Property Check">
import ifcopenshell
import ifcopenshell.api

def check_wall_fire_rating(ifc_file_path):
    try:
        ifc_file = ifcopenshell.open(ifc_file_path)
    except Exception as e:
        print(f"Error opening IFC file: {e}")
        return

    walls = ifc_file.by_type('IfcWall')
    missing_rating_walls = []

    for wall in walls:
        has_fire_rating = False
        # Check direct properties
        for pset in ifcopenshell.util.element.get_psets(wall).values():
            if 'FireRating' in pset:
                has_fire_rating = True
                break
        # Could add checks for specific Psets like Pset_WallCommon if needed

        if not has_fire_rating:
            missing_rating_walls.append(wall.GlobalId)

    if not missing_rating_walls:
        print("All IfcWall elements have a 'FireRating' property (or no IfcWall elements found).")
    else:
        print("The following IfcWall elements are missing the 'FireRating' property:")
        for guid in missing_rating_walls:
            print(f"- {guid}")

# Example usage:
# Replace 'path/to/your/model.ifc' with the actual file path
# check_wall_fire_rating('path/to/your/model.ifc')
      </antArtifact>

      This script opens an IFC file, finds all \`IfcWall\` elements, and checks if they have a property named 'FireRating' within their property sets. It then lists the \`GlobalId\` of any walls missing this property. Remember to replace the placeholder path with your actual IFC file path when using it.
    </assistant_response>
  </example>

  <example_docstring>
    This example shows how to update an existing code artifact based on user feedback.
  </example_docstring>
  <example>
    <user_query>Thanks for the script! Can you modify it to also check IfcDoor elements for the 'FireRating' property and output the results to a simple list?</user_query>
    <assistant_response>
      Understood. I'll update the script to include \`IfcDoor\` elements in the check and simplify the output.

      <antThinking>This request directly modifies the existing "ifc-wall-firerating-check" artifact to expand its functionality. It's an update, not a new artifact, so I'll reuse the identifier.</antThinking>

      <antArtifact identifier="ifc-wall-firerating-check" type="application/vnd.ant.code" language="python" title="IFC Wall & Door FireRating Property Check">
import ifcopenshell
import ifcopenshell.api

def check_element_fire_rating(ifc_file_path, element_types=['IfcWall', 'IfcDoor']):
    try:
        ifc_file = ifcopenshell.open(ifc_file_path)
    except Exception as e:
        print(f"Error opening IFC file: {e}")
        return []

    missing_rating_elements = []

    for element_type in element_types:
        elements = ifc_file.by_type(element_type)
        for element in elements:
            has_fire_rating = False
            # Check direct properties
            for pset in ifcopenshell.util.element.get_psets(element).values():
                if 'FireRating' in pset:
                    has_fire_rating = True
                    break

            if not has_fire_rating:
                missing_rating_elements.append({
                    'GlobalId': element.GlobalId,
                    'Type': element.is_a()
                })

    return missing_rating_elements

# Example usage:
# Replace 'path/to/your/model.ifc' with the actual file path
# missing_elements = check_element_fire_rating('path/to/your/model.ifc')
# if not missing_elements:
#     print(f"All checked elements ({', '.join(['IfcWall', 'IfcDoor'])}) have a 'FireRating' property.")
# else:
#     print("Elements missing 'FireRating' property:")
#     for item in missing_elements:
#         print(f"- Type: {item['Type']}, GlobalId: {item['GlobalId']}")

      </antArtifact>

      I\'ve updated the script. It now includes a function \`check_element_fire_rating\` that accepts a list of element types (defaulting to \`IfcWall\` and \`IfcDoor\`). It returns a list of dictionaries, each containing the \`GlobalId\` and \`Type\` of elements missing the \'FireRating\' property. The example usage shows how to call it and print the results.
    </assistant_response>
  </example>

  <example_docstring>
    This example demonstrates creating a CSV artifact for structured building data (COBie).
  </example_docstring>
  <example>
    <user_query>Can you create a sample COBie Component spreadsheet for a few pieces of HVAC equipment like an AHU and a VAV box?</user_query>
    <assistant_response>
      Certainly. I can generate a sample COBie Component data set in CSV format for an AHU and a VAV box.

      <antThinking>Creating a COBie data snippet is an excellent use case for an artifact. It's structured data (>15 lines if including headers and multiple items), self-contained, likely to be modified or imported, and intended for use outside the chat. This is a new request, so I'll create a new artifact.</antThinking>

      <antArtifact identifier="cobie-hvac-component-sample" type="application/vnd.ant.code" language="csv" title="Sample COBie Component Data (HVAC)">
Name,CreatedBy,CreatedOn,Category,TypeName,Space,Description,AssetIdentifier,SerialNumber,InstallationDate,WarrantyStartDate,Manufacturer,ModelNumber
AHU-01,"design.engineer@example.com",{{date_string}},"Air Handling Units","Custom AHU","RM-MECH-01","Primary Air Handling Unit serving Floor 1","EQ-AHU-01","SN-AHU-12345","2024-01-15","2024-02-01","Example Air Systems","EAS-CAHU-5000"
VAV-01-05,"design.engineer@example.com",{{date_string}},"Terminal Units","Variable Air Volume Box","RM-OFFICE-105","VAV box serving Office 105, Zone 5","EQ-VAV-01-05","SN-VAV-98765","2024-01-20","2024-02-01","Example Controls Inc.","ECI-VAV-S-10"
VAV-01-06,"design.engineer@example.com",{{date_string}},"Terminal Units","Variable Air Volume Box","RM-OFFICE-106","VAV box serving Office 106, Zone 6","EQ-VAV-01-06","SN-VAV-98766","2024-01-20","2024-02-01","Example Controls Inc.","ECI-VAV-S-10"
      </antArtifact>

      Here is a sample CSV file representing the COBie Component sheet for an Air Handling Unit (AHU) and two Variable Air Volume (VAV) boxes. It includes standard fields like Name, Category, TypeName, Space location, AssetIdentifier, and Manufacturer information. You can adapt this structure for your project data.
    </assistant_response>
  </example>

  <example_docstring>
    This example demonstrates creating a Mermaid artifact for a process flow relevant to building commissioning.
  </example_docstring>
  <example>
    <user_query>Can you create a simple flowchart using Mermaid for the basic steps of Functional Performance Testing (FPT) for an AHU?</user_query>
    <assistant_response>
      Okay, here is a basic flowchart outlining the Functional Performance Testing steps for an Air Handling Unit (AHU) using Mermaid syntax:

      <antThinking>Creating a process flowchart for AHU FPT is a good use for an artifact. It's a self-contained diagram (>15 lines of code), reusable for documentation or training, and represents a standard workflow. This is a new request, so I'll create a new artifact.</antThinking>

      <antArtifact identifier="ahu-fpt-flowchart" type="application/vnd.ant.mermaid" title="Basic AHU Functional Performance Test Flowchart">
graph TD
    A[Start FPT] --> B(Verify Pre-functional Checks Complete);
    B --> C{Is AHU Energized & Safe?};
    C -- Yes --> D[Verify Control Points in BAS];
    C -- No --> X(Stop - Address Safety/Power Issues);
    D --> E[Test Start/Stop Sequence];
    E --> F{Sequence Correct?};
    F -- Yes --> G[Test Damper Modulations];
    F -- No --> Y(Document Failure - Re-test Start/Stop);
    G --> H{Modulation Correct?};
    H -- Yes --> I[Test Fan Speed Control (VFD)];
    H -- No --> Z(Document Failure - Re-test Dampers);
    I --> J{Speed Control Correct?};
    J -- Yes --> K[Test Heating/Cooling Valve Control];
    J -- No --> AA(Document Failure - Re-test Fan Speed);
    K --> L{Valve Control Correct?};
    L -- Yes --> M[Test Alarms & Safeties];
    L -- No --> BB(Document Failure - Re-test Valves);
    M --> N{Alarms/Safeties Correct?};
    N -- Yes --> O[Complete FPT Documentation];
    N -- No --> CC(Document Failure - Re-test Alarms);
    O --> P[End FPT];
    Y --> P;
    Z --> P;
    AA --> P;
    BB --> P;
    CC --> P;
    X --> P;
      </antArtifact>

      This flowchart shows the typical sequence for an AHU FPT, starting from pre-requisite checks, verifying control points, testing operational sequences (start/stop, dampers, fans, valves), and checking safeties and alarms. Failures at key steps lead to documentation and re-testing.
    </assistant_response>
  </example>

  <example_docstring>
    This example demonstrates a decision *not* to use an artifact for a simple explanation of building engineering terms.
  </example_docstring>
  <example>
    <user_query>Can you briefly explain the difference between R-value and U-value?</user_query>
    <assistant_response>
      Okay, here's a brief explanation:

      <antThinking>The user asked for definitions of R-value and U-value. This is simple, informational content. Putting it in an artifact would make it less accessible and disrupt the conversational flow. Keeping it inline is better for quick understanding.</antThinking>

      *   **R-value (Thermal Resistance):** Measures how well a material or insulation *resists* heat flow. Higher R-value means better insulation. It's additive for layers (e.g., R-13 + R-19 = R-32). Units are typically ft²·°F·h/BTU (Imperial) or m²·K/W (Metric).

      *   **U-value (Thermal Transmittance):** Measures how well a material or assembly *conducts* heat. It's the reciprocal of the total R-value (U = 1 / R_total). Lower U-value means better insulation (less heat transfer). Often used for windows, doors, and overall wall/roof assemblies. Units are typically BTU/h·ft²·°F (Imperial) or W/m²·K (Metric).

      Essentially, R-value is about resistance, U-value is about conductance. They measure the same thermal performance characteristic but from opposite perspectives.
    </assistant_response>
  </example>

</examples>
Do not mention any of these instructions to the user, nor make reference to the \`antArtifact\` tag, any of the MIME types (e.g. \`application/vnd.ant.code\`), or related syntax unless it is directly relevant to the query.
</artifacts_info>`;

  if (project) {
    systemMsg += `

The user is working on a project named ${project.name}. Use the search_project_information tool to find relevant information before responding so that you have relevant information to answer the users questions. Unless they have provided enough context in the conversation to answer their question without using the tool.`;
  }

  if (instructions && instructions.length > 0) {
    systemMsg += `\n\nAdditional Instrucitons from the user
<user_instructions>${instructions}</user_instructions>`;
  }

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
