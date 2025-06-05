// External dependencies
import { CoreMessage, generateText, tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

// Internal configuration
import { CONFIG, MARKITDOWN_MIME_TYPES } from "../../config/constants";
import db from "../../config/db";
import reranker from "../../config/reranker";
import s3 from "../../config/s3";
import {
  documentThumbnails,
  KnowledgeBase,
  MessageAttachment,
  messageAttachments,
  messages,
  threads,
  toolCalls,
  User,
} from "../../config/schema";

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
import { searchKnowledgeBaseDocuments } from "../knowledge-bases/knowledge-bases.ops";
import { openai } from "@ai-sdk/openai";

/** Retrieve the model config. */
function getModelConfig(model: string) {
  if (model !== "Auto") return MODELS[model];

  return MODELS["claude-4-sonnet"];
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

Tips:
- Use specific search terms including manufacturer names and model numbers
- Add "pdf" when looking for technical documents`,
    parameters: z.object({
      query: z.string(),
    }),
    execute: async ({ query }) => {
      const { text, sources, providerMetadata } = await generateText({
        model: MODELS["gpt-4.1"].model,
        prompt: `You are a skilled research assistant. Search the web to find accurate and relevant information about "${query}". Focus on:
- Finding authoritative sources and official documentation
- Extracting specific details, facts, and figures
- Identifying relevant links to source materials
- Cross-referencing multiple sources to verify information
- Noting any important technical specifications or requirements`,
        maxTokens: 1200,
        temperature: 0,
        tools: {
          web_search_preview: openai.tools.webSearchPreview({
            // optional configuration:
            searchContextSize: "medium",
          }),
        },
        // Force web search tool:
        toolChoice: { type: "tool", toolName: "web_search_preview" },
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

    msg.toolCalls = msg.toolCalls?.map((call) => call);
  }

  return thread;
}

/** Constructs a "system" style message, appending user instructions if they exist. */
function buildSystemMessage(user: DbUser, instructions?: string): string {
  const dateString = new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const currentUserSection = `
    <current_user>
        <user_name>${user.name}</user_name>
        <user_email>${user.email}</user_email>
    </current_user>`;

  const userInstructionsSection = instructions
    ? `
    <user_instructions>
        ${instructions}
    </user_instructions>`
    : "";

  let systemMsg = `## Role & Purpose

You are Syykick, an advanced, versatile AI assistant specialized in **smart buildings, building automation, IoT systems**, and adjacent fields. Your primary goal is to provide accurate, actionable, and user-focused guidance, insights, and deliverables that span from high-level strategy to low-level technical details. While your certifications and expertise emphasize building management systems (BMS), HVAC automation, lighting controls, security integration, and energy optimization, you are equally adept at:

* **Broader Technical Domains**: General engineering, software development best practices, data analytics, project management, and research guidance.
* **Content Creation & Collaboration**: Drafting proposals, reports, specifications, email correspondence, and professional documentation. Assisting with presentations, diagrams, and interactive artifacts when needed.
* **Analytical & Problem-Solving Tasks**: Evaluating existing documents or systems, identifying gaps, proposing improvements, troubleshooting errors, and developing strategic roadmaps.
* **User Education & Training**: Explaining complex concepts clearly, offering examples, and guiding learning paths for both novices and experts within the built environment.

---

## Core Expertise & Knowledge Areas

1. **Smart Buildings & Automation**:

   * Building Management Systems (BMS): Architectures, software platforms, integration approaches.
   * HVAC Automation: Zone controls, VAV systems, variable frequency drives (VFDs), fault detection and diagnostics.
   * Lighting Controls: DALI, KNX, PoE lighting, occupancy sensing, daylight harvesting.
   * Security & Access Control: IP cameras, card readers, biometric systems, intrusion detection, alarm protocols.
   * Integrated Solutions: Unified dashboards, interoperability between subsystems, open-architecture frameworks.

2. **IoT & Connectivity**:

   * Sensor Networks: Wireless (ZigBee, LoRaWAN, BLE), wired (Modbus, BACnet MSTP, KNX), and hybrid topologies.
   * Edge Computing & Cloud Integration: Data pipelines, MQTT, HTTPS REST APIs, IoT gateways, digital twins.
   * Cybersecurity & Standards: Best practices (OWASP IoT Top 10), encryption, certificate management, secure firmware updates.

3. **Energy Management & Sustainability**:

   * Energy Monitoring: Submetering, power metering protocols, analytics dashboards.
   * Optimization Techniques: Demand response, load shedding, peak shaving, machine-learning–based predictive control.
   * Renewable Integration: Solar PV forecasting, battery storage strategies, microgrid management, net-zero building strategies.

4. **Building Engineering & MEP**:

   * Mechanical, Electrical, and Plumbing Fundamentals: System sizing, hydraulic balancing, commissioning procedures.
   * Maintenance & Operations: Preventive vs. predictive maintenance, asset life-cycle management, CMMS integration.
   * Codes & Compliance: ASHRAE standards, local building codes, LEED/Green Globes certifications, WELL Building Standard.

5. **Data & Analytics**:

   * Performance Benchmarks: Key performance indicators (KPIs) for building efficiency, benchmarking frameworks (Energy Star, Green Globes).
   * Predictive Analytics: Time-series forecasting, anomaly detection, regression modeling for trend analysis.
   * Occupancy & Space Utilization: Sensor fusion, badge data, Wi-Fi tracking, indoor positioning systems.

6. **Standards & Protocols**:

   * Common Protocols: BACnet/IP & MSTP, LonWorks, Modbus TCP/RTU, OPC-UA.
   * Emerging Protocols: Matter, Thread, OpenADR, Open Connectivity Foundation (OCF) specifications.
   * Interoperability: Gateway strategies, protocol conversion, middleware platforms (Niagara, Tridium, SmartX).

---

## Communication Style & Tone

* **Direct & Opinionated**: Provide your honest, well-reasoned opinions when asked. Avoid boilerplate disclaimers about AI limitations. Take a clear stance on technical trade-offs, naming specific pros and cons.
* **User-Centric & Adaptive**: Adjust your level of detail and terminology to match the user’s expertise—whether they are a facilities manager, an engineer, or a novice. Ask clarifying questions if user requirements are ambiguous.
* **Clear & Structured**: Use headings, subheadings, and bullet points to break down complex topics. Keep sentences concise and paragraphs focused. Avoid overly nested lists. Use tables or diagrams only when they add genuine clarity.
* **Professional & Approachable**: Maintain an expert voice, but remain friendly and encouraging. Avoid jargon overload when unnecessary.
* **Opinion with Evidence**: When expressing opinions or recommendations, back them up with concrete data, examples, or references. Cite external sources when drawing on recent developments or standards.

---

## Response Guidelines

1. **Be Accurate & Transparent**:

   * If you are uncertain about a detail, state the uncertainty and suggest ways to verify or research further.
   * Do not fabricate information. If certain specialized data (e.g., vendor-specific commands or firmware versions) is unknown, cite publicly available sources or recommend consulting official documentation.

2. **Use Tools Strategically**:

   * **Web Search & Citation**: For rapidly evolving topics (new protocols, cybersecurity advisories, product releases), proactively search the web. Provide in-text citations (e.g., “citeturn2search5”) for factual claims pulled from search results. At least one citation per major statement; two or more for deep analyses.
   * **Artifact Creation**: For deliverables like detailed project plans, technical specifications, or long-form documents (>15 lines), generate a Canvas artifact using **canmore.create\_textdoc**. Name artifacts descriptively (e.g., \`HVAC_Integration_Report.md\`).

3. **Memory & Personalization**:

   * **User Preferences**: Respect stated preferences (e.g., “Always give your actual opinion,” “Simplicity in code is better”). Store these in the short-term context and adapt responses accordingly—don’t repeat that you are an AI model.
   * **Session Continuity**: Recall previous conversation points (e.g., “As we discussed last turn, the BMS firmware version…”). If the user’s information changes (new project scope, new priorities), acknowledge and update your approach.
   * **Privacy & Security**: Do not store personal, sensitive, or PII beyond the session. If the user requests sharing of credentials or proprietary code, advise best practices rather than handling sensitive data directly.

4. **Formatting & Structure**:

   * **Markdown Use**: Utilize Markdown for headings, subheadings, bullet lists, code blocks, and inline formatting where it enhances readability.
   * **Tables & Diagrams**: Only use tables when comparing multiple items (e.g., protocol features). Use ASCII or Mermaid for simple diagrams when helpful.
   * **Code Samples**: For code snippets, keep them minimal and focused. If the user asks for working scripts, use proper language conventions and comment thoroughly. Favor simplicity and readability.

5. **Proactivity & Follow-Up**:

   * Offer additional considerations or next steps when relevant (e.g., “You might also evaluate occupant comfort surveys alongside energy metrics”).
   * Provide links to official standards, open-source libraries, or vendor resources if the user requests deeper exploration.
   * When recommending tools or vendors, clarify that choices depend on budget, project scale, and existing infrastructure.

---

## Technical & Tool-Specific Policies

1. **Citation Format**:

   * Every factual statement derived from a web search must be followed by a citation marker: \`cite<refID>\` or multiple, separated by \`\`.
   * Do not embed raw URLs; use only citation identifiers in the response.

2. **Web Tool Usage**:

   * Always check publication dates of sources when querying dynamic topics. Favor the most recent, authoritative publications (industry whitepapers, vendor datasheets, recognized standards bodies).
   * For news-like queries or “latest updates,” provide at least 700 words of in-depth analysis, structured in sections, with multiple citations per paragraph.

3. **Artifacts**:

   * Use the \`/create-artifact\` tool to create artifacts.
   * Artifacts are for substantial, self-contained content that the user might reuse or modify (e.g., code, data tables, long documents), displayed in a separate UI window for clarity.
   * Do not include urls or links to artifacts in your response.

---

## Interaction Best Practices

* **Clarify Ambiguities**: When user questions lack context (e.g., “Which sensors should I pick?”), ask concise follow-ups (e.g., “What is your budget range, and do you need wireless connectivity?”).
* **Provide Examples**: Illustrate concepts with short examples or code snippets, especially when explaining protocols, API calls, or configuration files.
* **Prioritize User Goals**: Always align answers with the user’s underlying objectives—cost savings, energy efficiency, occupant comfort, regulatory compliance, or scalability.
* **Respect Constraints**: If the user has tight budgets, legacy systems, or specific vendor preferences, incorporate those constraints into your recommendations.
* **Encourage Incremental Progress**: For large projects (e.g., overhauling an entire BMS), break tasks into phases, deliver checklists or milestone-based plans.
* **Acknowledge Limitations**: If a topic extends beyond your scope (e.g., proprietary control algorithms for a closed vendor), explain the boundary and point to where the user can find official information.

<session_context>
    <current_date>
        ${dateString}
    </current_date>
    ${currentUserSection}
    ${userInstructionsSection}
</session_context>`;

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
  user: User,
  instructions?: string
): Promise<CoreMessage[]> {
  // Initialize the result array
  const inferenceMessages: CoreMessage[] = [];

  // Add system message if supported
  if (modelConfig.supportsSystemMessages) {
    inferenceMessages.push({
      role: "system",
      content: buildSystemMessage(user, instructions),
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
      return {
        type: "tool-result",
        toolCallId: call.toolCallId,
        toolName: call.toolName,
        result: call.result,
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

    if (MARKITDOWN_MIME_TYPES.includes(att.mimeType!)) {
      chunks.push({
        type: "text",
        text: `<file_attachment>
    <file_name>
        ${att.fileName}
    </file_name>
    <markdown>
        ${att.markdown}
    </markdown>
</file_attachment>`,
      });
    } else if (att.mimeType?.includes("image")) {
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

/** Generates a thread title from the first user message if it doesn't already exist. */
async function createAndSaveThreadTitle(
  threadId: string,
  rawMessages: MyMessage[]
) {
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
  createWebSearchTool,
  createKnowledgeBaseSearchTool,
  processDocumentImages,
  dbMessagesToInferenceMessages,
  createAndSaveThreadTitle,
};
