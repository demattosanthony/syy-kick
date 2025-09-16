// External dependencies
import { CoreMessage, generateObject, generateText } from "ai";
import { eq, inArray } from "drizzle-orm";

// Internal configuration
import {
  CONFIG,
  MARKITDOWN_MIME_TYPES,
  PROGRAMMING_FILE_MIME_TYPES,
} from "../../config/constants";
import db from "../../config/db";
import s3 from "../../config/s3";
import {
  messages,
  threads,
  toolCalls,
  User,
  files,
  messagesFiles,
  filePages,
  filePageImages,
} from "../../config/schema";

// Feature imports
import { MODELS } from "../models";
import { MyMessage } from "./threads.types";
import { DbUser } from "../../createAuthToken";
import { z } from "zod";

export interface ImageData {
  name: string;
  imagePath: string;
  mimeType: string;
  imageUrl?: string;
  base64Data?: string;
}

/**
 * Loads images for given page IDs
 * In production: returns presigned URLs
 * In development: returns base64 data
 */
export async function loadImagesForPages(
  pageIds: string[],
  forceBase64: boolean = false
): Promise<ImageData[]> {
  const validPageIds = pageIds.filter(Boolean);
  if (validPageIds.length === 0) return [];

  console.log(
    `🖼️ [ImageUtils] Loading images for ${validPageIds.length} pages`
  );

  const images = await db.query.filePageImages.findMany({
    where: inArray(filePageImages.filePageId, validPageIds),
  });

  if (images.length === 0) {
    console.log(`📷 [ImageUtils] No images found for the selected pages`);
    return [];
  }

  const useBase64 = forceBase64 || !CONFIG.__prod__;
  console.log(
    `🖼️ [ImageUtils] Found ${images.length} images, using ${
      useBase64 ? "base64" : "URLs"
    }`
  );

  const imageResults: ImageData[] = [];

  for (const image of images) {
    try {
      const file = s3.file(image.imagePath);

      if (!(await file.exists())) {
        console.warn(
          `⚠️ [ImageUtils] Image not found in S3: ${image.imagePath}`
        );
        continue;
      }

      const imageData: ImageData = {
        name: image.name ?? "image",
        imagePath: image.imagePath,
        mimeType: "image/png",
      };

      if (useBase64) {
        // Load base64 data for development or when forced
        const imageBuffer = await file.arrayBuffer();
        imageData.base64Data = Buffer.from(imageBuffer).toString("base64");
        console.log(
          `✅ [ImageUtils] Loaded base64 for: ${image.name} (${imageBuffer.byteLength} bytes)`
        );
      } else {
        // Generate presigned URL for production
        imageData.imageUrl = file.presign({ expiresIn: 3600 });
        console.log(`✅ [ImageUtils] Generated URL for: ${image.name}`);
      }

      imageResults.push(imageData);
    } catch (error) {
      console.error(
        `❌ [ImageUtils] Error processing image ${image.name}:`,
        error
      );
    }
  }

  console.log(
    `🖼️ [ImageUtils] Successfully processed ${imageResults.length}/${images.length} images`
  );
  return imageResults;
}

/**
 * Loads images from tool results for AI inference
 * In production: returns presigned URLs
 * In development: returns base64 data
 */
export async function loadImagesFromToolResult(
  toolResult: any,
  forceBase64: boolean = false
): Promise<ImageData[]> {
  if (
    !toolResult?.images ||
    !Array.isArray(toolResult.images) ||
    toolResult.images.length === 0
  ) {
    return [];
  }

  const useBase64 = forceBase64 || !CONFIG.__prod__;
  console.log(
    `🖼️ [ImageUtils] Loading ${
      toolResult.images.length
    } images from tool result, using ${useBase64 ? "base64" : "URLs"}`
  );

  const imagesWithData = await Promise.all(
    toolResult.images.map(async (image: any): Promise<ImageData | null> => {
      try {
        if (!image.imagePath) return null;

        const file = s3.file(image.imagePath);
        if (!(await file.exists())) {
          console.warn(
            `⚠️ [ImageUtils] Image not found in S3: ${image.imagePath}`
          );
          return null;
        }

        const imageData: ImageData = {
          name: image.name || "image",
          imagePath: image.imagePath,
          mimeType: image.mimeType || "image/png",
        };

        if (useBase64) {
          // Load base64 data for development or when forced
          const imageBuffer = await file.arrayBuffer();
          imageData.base64Data = Buffer.from(imageBuffer).toString("base64");
          console.log(
            `✅ [ImageUtils] Loaded base64 for: ${image.name} (${imageBuffer.byteLength} bytes)`
          );
        } else {
          // Generate presigned URL for production
          imageData.imageUrl = file.presign({ expiresIn: 3600 });
          console.log(`✅ [ImageUtils] Generated URL for: ${image.name}`);
        }

        return imageData;
      } catch (error) {
        console.error(
          `❌ [ImageUtils] Error loading image ${image.name}:`,
          error
        );
        return null;
      }
    })
  );

  const validImages = imagesWithData.filter(
    (img): img is ImageData => img !== null
  );
  console.log(
    `✅ [ImageUtils] Successfully loaded ${validImages.length}/${toolResult.images.length} images`
  );

  return validImages;
}

// Helper function to presign image URLs in tool results
async function presignToolResultImages(result: any): Promise<any> {
  if (!result || typeof result !== "object") {
    return result;
  }

  // Handle artifact service tool results that have images
  if (result.images && Array.isArray(result.images)) {
    const presignedImages = await Promise.all(
      result.images.map(async (img: any) => {
        if (img.imagePath) {
          try {
            const presignedUrl = s3
              .file(img.imagePath)
              .presign({ expiresIn: 3600 });
            return {
              ...img,
              imageUrl: presignedUrl,
            };
          } catch (error) {
            console.error(
              `Error presigning image URL for ${img.imagePath}:`,
              error
            );
            return img;
          }
        }
        return img;
      })
    );

    return {
      ...result,
      images: presignedImages,
    };
  }

  return result;
}

/** Retrieve the model config. */
async function getModelConfig(model: string, messageContent: string) {
  if (model !== "Auto") return MODELS[model];

  console.log("🤖 Model routing started");
  const start = Date.now();

  const { object } = await generateObject({
    model: MODELS["gpt-5-mini"].model,
    schema: z.object({
      type: z.enum(["simple", "hard"]),
    }),
    prompt: `Your task is to understand the user's question and determine if its a 'simple' query or if its something hard/important.
Simple queries are ones that should be answered fast and quick.
Hard/important queries are ones where the user cares about it more and is willing to wait longer to get the full response.

The user's question is: ${messageContent}

Respond with a JSON object with the following schema:
{
  "type": "simple" | "hard"
}`,
  });

  console.log(`🤖 Model routing complete in ${Date.now() - start}ms`);
  console.log("🤖 [ModelConfig] Type of user query:", object.type);

  return object.type === "simple"
    ? MODELS["gpt-5-mini"]
    : MODELS["gemini-2.5-pro"];
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

  let systemPrompt = `<role>
You are Syykick, an agentic AI assistant created by Syyclops, a prop tech company based in Washington, DC. You specialize in building engineering across the full lifecycle: design principles, construction methods, system commissioning, project management strategies, and facility operations. 

Your role is to be a capable partner in assisting users with their tasks. You not only provide accurate, helpful, and concise information but also actively assist with performing work, such as:

- Creating files: Generating initial drafts of reports, specifications, meeting minutes, proposals, emails, checklists, and scope of work documents based on user prompts and provided information.
- Analyzing content: Analyzing text-based descriptions of drawings, specifications, or reports to identify potential inconsistencies, missing information, or areas needing clarification based on standard practices or user-defined criteria. (Note: You cannot directly interpret visual drawing files yet).
- Organizing information: Summarizing technical documents, structuring project data, and creating outlines for presentations or reports.
- Problem solving: Assisting with calculations (when provided with clear inputs and formulas), brainstorming solutions, and outlining troubleshooting steps for operational issues.
- Process support: Helping to define workflows, sequence construction tasks, or outline commissioning procedures.

You aim to accelerate workflows and enhance productivity for engineering professionals, students, and related stakeholders. Maintain a professional, collaborative, and efficient tone.
</role>

<environment>
You are embedded within the Syykick web application at https://syykick.com.

1.  **Execution Platform:** Deployed on Syyclops' server infrastructure.
2.  **User Interface:** You interact with users exclusively through the current **chat session**. All communication happens through this chat interface.
3.  **External Web Access:** You are connected to the internet and can utilize the web search tool (\`web_search\`) to retrieve publicly available information, standards, codes, and general knowledge.
4.  **Session Context:** Your awareness is primarily focused on the **current chat session**. You track the conversation history within this session to understand context, maintain conversational flow, and reference previous exchanges.
</environment>

<instructions>
1. Be Accurate and Honest: If you lack information or are unsure, state that clearly. Do not invent answers or provide speculative information.
2. Follow Formatting Rules: Strictly avoid nested lists and combining ordered/unordered lists. Use bullet points sparingly and only when essential for clarity. Do not include URLs or resource identifiers (like project or document IDs) in your responses.
3. Use Files Appropriately: For substantial, self-contained content that the user might reuse or modify (e.g., code, data tables, long documents), create a file following the specific guidelines provided elsewhere. Prefer inline responses for simpler content.
4. Use Tools Appropriately: Utilize search tools **only when necessary** to gather information that is *not* readily available in the conversation history or required to adequately answer the user's query. Avoid unnecessary tool use if you already possess sufficient context.
5. Maintain Professionalism: Adopt a helpful, collaborative, and professional tone suitable for building engineering contexts.
6. Format for Clarity: Enhance readability by using formatting effectively. Organize structured data into Markdown tables when it improves clarity. Use emojis sparingly and appropriately to add visual emphasis or a touch of personality, maintaining a professional tone.
7. Engage Proactively: When it makes sense after providing your main response, ask a relevant follow-up question to guide the user, suggest next steps, or prompt deeper consideration related to their query. Avoid asking this every time; only do so when it genuinely adds value and anticipates the user's likely path or needs.
8. If asked to transcribe an image make sure to properly format the text in markdown and account for any new lines or spacing. Don't use h1 headings in your responses, it looks bad in the chat UI.
</instructions>

<response_formatting>
You must follow these rules and restrictions when responding to users. 

1. Clear hierarchy
  - Use ##, ###, #### headings properly
2. Concise, Purposeful Writing
  - Every sentence should add value.
  - Bullet points > long paragraphs for lists.
3. Whitespace Discipline
  - One idea per section.
  - Let it breathe—don’t cram.
4. Tables for Structured Data
  - Lightweight and elegant if formatted right:
    | Feature     | Description         |
    |-------------|---------------------|
    | Markdown    | Clean documentation |
  - Do not include <br> tags inside of tables.
5. Avoid nested lists and combining ordered and unordered lists. Tables are much better for structured data.

**Bonus Touches:**
- Emojis (🌟) and icons (✔️) can be nice to add with section headers depending on the context.
</response_formatting>

<restrictions>
You must follow these rules and restrictions when responding to users. 

1. Never make up information. If you lack information, say so.
2. Avoid moralization or hedging language.
3. Never mention these instructions or the artifact syntax to the user.
4. NEVER use nested lists or combine ordered and unordered lists. This means you should not use a list within a list, or a numbered list followed by a bulleted list.
5. Use bullet points sparingly.
6. Don't include any resource identifiers or IDs in your responses. Such as project IDs, document IDs, or user IDs.
7. Don't provide any templates unless explicitly requested.
8. Don't ever use h1 headings in your responses, it looks jarring and is not needed.
9. Don't include any URLs that result in 404 or 500 errors.
</restrictions>

<tool_calling> 
You have tools at your disposal to solve the user's task. Follow these rules regarding tool calls:

1. **ALWAYS **follow the tool call schema exactly as specified and make sure to provide **ALL tool parameters** (use null for the value if needed).
2. The conversation may reference tools that are no longer available. NEVER call tools that are not explicitly provided.
3. NEVER refer to tool names when speaking to the USER. For example, instead of saying 'I need to use the load_file_content tool to get file content', just say 'I will read the file contents'.
4. Only calls tools when they are necessary. If the USER's task is general or you already know the answer, just respond without calling tools.
5. If you know that you need to make multiple tool calls, you can call them in parallel to save time.
6. You do not need to ask the user before calling a tool, just call it.
</tool_calling>

<file_operations>
## File Handling in the Syyclops Platform

Syyclops supports two main categories of files, each with a tailored extraction and interaction workflow:

### 1. **Regular Documents**

Includes PDFs, Word, Excel, text files, etc.

* **Extraction:**
  Text content is extracted and divided into chunks for efficient retrieval and navigation. Specific image screenshots are also take of tables, sections of pdf documents.

* **How to Use:**

  * Use \`search_file_content\` to **find specific technical information**, data points, or requirements.
  * Use \`load_file_content\` to **read sections sequentially** or understand the document structure.
  * Combine both tools: **search first**, then load relevant chunks for detailed analysis.
  * For large documents, use \`startChunk\` and \`endChunk\` to control which portions to load.

### 2. **Engineering Drawings**

Includes schematics, floor plans, technical diagrams—**always provided as PDFs**.

* **Extraction:**
  Each PDF page is converted into an image. These files contain no text to search.

* **How to Use:**

  * Only use \`load_file_content\` — **search does not apply** to image-based drawings.
  * Paginate using \`startPage\` and \`endPage\` to view specific sheets.
  * Focus on **visual details**: symbols, annotations, schedules, dimensions, etc.
  * Reference sheet numbers when discussing or reviewing with others.

### Key Takeaways

* **Know your file type.** Regular documents = searchable text chunks. Engineering drawings = page images.
* **Search only works on documents**, not drawings.
* **Always include images** for full context and completeness.

    <file_creation>
    You can also generate files based on the user's request. These can serve as downloadable deliverables or working references.

    **Examples:**
    - Technical reports, calculations, or analysis results
    - Code, scripts, or configuration files
    - Schedules, checklists, or project breakdowns
    - Comparison tables, equipment specs, selection matrices
    - Any structured output >15 lines of content

    *Best Practices:*
    - Use the \`create_file\` tool.
    - Choose appropriate file extensions (.html for interfaces, .md for documentation, .csv for data, .py for code)
    - Use descriptive and context-relevant filenames.
    - Organize content with clear headers and logical sections.
    - Include all necessary details to make the file self-contained and immediately useful.
    - Never reference or mention the file creation in your response - files appear automatically 
    </file_creation>
</file_operations>

<session_context>
    <current_date>
        ${dateString}
    </current_date>
    ${currentUserSection}
    ${userInstructionsSection}
</session_context>`;

  return systemPrompt;
}

/**
 * Directly transforms database messages into inference messages format
 * in a single function, handling file attachments, tool calls, and content formatting.
 */
async function dbMessagesToInferenceMessages(
  dbMsgs: Array<
    typeof messages.$inferSelect & {
      toolCalls: Array<typeof toolCalls.$inferSelect>;
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

    // Get file attachments for this message
    const messageFileRecs = await db.query.messagesFiles.findMany({
      where: eq(messagesFiles.messageId, msg.id),
    });

    const messageFiles = [];
    for (const msgFile of messageFileRecs) {
      const file = await db.query.files.findFirst({
        where: eq(files.id, msgFile.fileId),
      });
      if (file) {
        messageFiles.push(file);
      }
    }

    // Handle assistant messages with tool calls
    if (msg.role === "assistant" && msg.toolCalls.length > 0) {
      // Add assistant message with tool calls
      inferenceMessages.push(
        await createAssistantMessageWithFiles(msg, messageFiles, modelConfig)
      );

      // Add tool response messages - must come immediately after tool calls
      const toolMessages = await createToolMessages(msg, modelConfig);

      // Separate tool results from user images to maintain proper ordering
      const toolResultMessages = toolMessages.filter((m) => m.role === "tool");
      const userImageMessages = toolMessages.filter((m) => m.role === "user");

      // Tool results MUST come immediately after assistant tool calls
      inferenceMessages.push(...toolResultMessages);

      // User images can come after tool results
      inferenceMessages.push(...userImageMessages);
    } else {
      // Process regular message
      inferenceMessages.push(
        await createRegularMessageWithFiles(msg, messageFiles, modelConfig)
      );
    }
  }

  return inferenceMessages;
}

/**
 * Creates an assistant message with tool calls and files
 */
async function createAssistantMessageWithFiles(
  msg: typeof messages.$inferSelect & {
    toolCalls: Array<typeof toolCalls.$inferSelect>;
  },
  messageFiles: Array<typeof files.$inferSelect>,
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

  // Process file attachments
  const fileChunks = await createFileAttachmentMessages(
    messageFiles,
    modelConfig
  );
  chunks.push(...fileChunks);

  return {
    role: "assistant",
    content: chunks,
  };
}

/**
 * Creates tool messages with results from completed tool calls
 * For historical messages, properly loads and includes images from artifact service tools
 */
async function createToolMessages(
  msg: typeof messages.$inferSelect & {
    toolCalls: Array<typeof toolCalls.$inferSelect>;
  },
  modelConfig: {
    model: {
      modelId: string;
    };
  }
): Promise<CoreMessage[]> {
  const completedCalls = msg.toolCalls.filter(
    (call) => call.status === "completed" && call.result
  );

  if (completedCalls.length === 0) {
    return [];
  }

  const messages: CoreMessage[] = [];

  // Check for artifact service tools with images and load them
  const allImages: Array<{
    name: string;
    imagePath: string;
    mimeType: string;
    base64Data?: string;
    imageUrl?: string;
  }> = [];

  for (const call of completedCalls) {
    if (
      (call.toolName === "load_file_content" ||
        call.toolName === "search_file_content") &&
      call.result
    ) {
      console.log(
        `🔍 [ThreadsUtils] Checking historical ${call.toolName} for images`
      );
      const images = await loadImagesFromToolResult(call.result);
      // Add images that have either base64Data or imageUrl
      const validImages = images.filter(
        (img) => img.base64Data || img.imageUrl
      );
      allImages.push(...validImages);
    }
  }

  // Create user message with images if we have any
  if (allImages.length > 0) {
    console.log(
      `📸 [ThreadsUtils] Creating historical user message with ${allImages.length} images`
    );

    const userContent: any[] = [
      {
        type: "text",
        text: `Here are the images from the file content that was loaded:`,
      },
      ...allImages.map((img) => ({
        type: "image",
        image: img.base64Data || img.imageUrl, // Use base64 if available, otherwise URL
        mimeType: img.mimeType,
      })),
    ];

    messages.push({
      id: `${msg.id}_user_images`,
      role: "user",
      content: userContent,
    } as any);
  }

  // Create tool results with presigned URLs for client consumption
  const processedResults = await Promise.all(
    completedCalls.map(async (call) => {
      // Presign URLs in the tool result before sending to client
      const presignedResult = await presignToolResultImages(call.result);

      // For artifact service tools, remove images from stored results since they're handled separately
      let toolResult = presignedResult;
      if (
        (call.toolName === "load_file_content" ||
          call.toolName === "search_file_content") &&
        toolResult &&
        typeof toolResult === "object" &&
        "images" in toolResult
      ) {
        // Create a copy without images for the tool result
        const { images, ...resultWithoutImages } = toolResult as any;
        toolResult = resultWithoutImages;
      }

      return {
        type: "tool-result",
        toolCallId: call.toolCallId,
        toolName: call.toolName,
        result: toolResult,
      };
    })
  );

  // Create tool message
  messages.push({
    id: `${msg.id}_tool_results`,
    role: "tool",
    content: processedResults,
  } as any);

  return messages;
}

/**
 * Creates a regular message (not an assistant with tool calls) with files
 */
async function createRegularMessageWithFiles(
  msg: typeof messages.$inferSelect,
  messageFiles: Array<typeof files.$inferSelect>,
  modelConfig: any
): Promise<CoreMessage> {
  const chunks = [];

  // Add text content
  if (msg.text) {
    chunks.push({ type: "text", text: msg.text });
  }

  // Process file attachments
  const fileChunks = await createFileAttachmentMessages(
    messageFiles,
    modelConfig
  );
  chunks.push(...fileChunks);

  return {
    id: msg.id,
    role: msg.role,
    content: chunks,
  } as MyMessage;
}

/**
 * Process file attachments into appropriate chunks
 * Implements smart logic for direct inclusion vs artifact service
 */
async function createFileAttachmentMessages(
  messageFiles: Array<typeof files.$inferSelect>,
  modelConfig: any
): Promise<any[]> {
  const chunks = [];
  const artifactFiles = [];
  const drawingFiles = [];

  for (const file of messageFiles) {
    const isImage = file.mimeType?.includes("image");
    const isPdf = file.mimeType === "application/pdf";
    const isDocument = MARKITDOWN_MIME_TYPES.includes(file.mimeType || "");
    const isDrawing = file.category === "drawing";
    const isPlainText = file.mimeType === "text/plain";
    const isProgrammingFile = PROGRAMMING_FILE_MIME_TYPES.includes(
      file.mimeType || ""
    );

    // Direct inclusion for images (if supported by model)
    if (
      isImage &&
      modelConfig.supportedMimeTypes?.includes(file.mimeType || "")
    ) {
      try {
        const data = await generateAttachmentData(
          file.syyclops_path || "",
          file.mimeType || "",
          true
        );
        chunks.push({
          type: "image",
          image: data,
          mimeType: file.mimeType,
        });
      } catch (error) {
        console.error(`Error loading image file ${file.name}:`, error);
      }
    }
    // Drawing files (PDFs categorized as drawings)
    else if (isDrawing && isPdf) {
      drawingFiles.push(file);
    }
    // Large documents, plain text, and programming files go to artifact service
    else if (isPdf || isDocument || isPlainText || isProgrammingFile) {
      artifactFiles.push(file);
    }
    // Other files - include basic info
    else {
      try {
        const data = await generateAttachmentData(
          file.syyclops_path || "",
          file.mimeType || "",
          true
        );
        chunks.push({
          type: "file",
          data,
          mimeType: file.mimeType,
        });
      } catch (error) {
        console.error(`Error loading file ${file.name}:`, error);
      }
    }
  }

  // Add notice for drawing files with page count
  if (drawingFiles.length > 0) {
    const drawingListPromises = drawingFiles.map(async (f) => {
      // Get page count for drawing file
      const pageCount = await db.query.filePages
        .findMany({
          where: eq(filePages.fileId, f.id),
        })
        .then((pages) => pages.length);

      const fileSlug = f.syyclops_path?.split("/").pop() || f.name;

      return `- ${fileSlug} - (Engineering Drawing - ${f.mimeType}) - ${pageCount} pages`;
    });

    const drawingList = (await Promise.all(drawingListPromises)).join("\n");

    chunks.push({
      type: "text",
      text: `<drawing_attachments_notice>
The following engineering drawing files have been processed and are available as high-resolution images:

${drawingList}

These are visual/graphical documents (architectural plans, engineering drawings, schematics, etc.) that have been converted to images for analysis. To access these drawings:

- Use the \`load_file_content\` tool to navigate through the drawing pages
- Specify page ranges to view specific sheets or details
- Each page is available as a high-resolution image for visual interpretation
- NOTE: \`search_file_content\` will NOT work effectively for these drawings since they contain primarily visual information
</drawing_attachments_notice>`,
    });
  }

  // Add artifact service prompting for regular documents with page count
  if (artifactFiles.length > 0) {
    const fileListPromises = artifactFiles.map(async (f) => {
      // Get page count for document file
      const pageCount = await db.query.filePages
        .findMany({
          where: eq(filePages.fileId, f.id),
        })
        .then((pages) => pages.length);

      // Get chunk count for document file
      const chunkCount = await db.query.filePages
        .findMany({
          where: eq(filePages.fileId, f.id),
          with: {
            chunks: true,
          },
        })
        .then((pages) =>
          pages.reduce((sum, page) => sum + page.chunks.length, 0)
        );

      // Determine file type description
      let fileTypeDesc = "Document";
      if (f.mimeType === "text/plain") {
        fileTypeDesc = "Plain Text";
      } else if (PROGRAMMING_FILE_MIME_TYPES.includes(f.mimeType || "")) {
        fileTypeDesc = "Code File";
      }

      const fileSlug = f.syyclops_path?.split("/").pop() || f.name;

      return `- ${fileSlug} - (${fileTypeDesc} - ${f.mimeType}) - ${pageCount} pages, ${chunkCount} chunks`;
    });

    const fileList = (await Promise.all(fileListPromises)).join("\n");

    chunks.push({
      type: "text",
      text: `<document_attachments_notice>
The following document files have been processed and are available through the artifact service:

${fileList}

These files have been processed with text extraction and OCR. You can access their content using:

- \`search_file_content\` tool to find specific information within the documents
- \`load_file_content\` tool to read specific pages or sections (default: first 10 chunks for regular documents)
- Content is available for analysis, reference, and text-based operations
</document_attachments_notice>`,
    });
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

async function generateThreadTitle(message: string) {
  const { text } = await generateText({
    model: MODELS["gemini-2.5-flash"].model,
    prompt: `Generate a title for the following user message. The title should describe what their message is about so they can later find it easily. The title should be 3 to 4 words give or take. Only respond with the title and nothing else.\n\nUser message:\n\n${message}`,
  });

  return text;
}

export {
  getModelConfig,
  generateThreadTitle,
  generateAttachmentData,
  dbMessagesToInferenceMessages,
  createAndSaveThreadTitle,
  presignToolResultImages,
};
