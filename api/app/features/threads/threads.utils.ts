// External dependencies
import { CoreMessage, tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { CharacterTextSplitter } from "@langchain/textsplitters";

// Internal configuration
import { CONFIG, MARKITDOWN_MIME_TYPES } from "../../config/constants";
import db from "../../config/db";
import reranker from "../../config/reranker";
import s3 from "../../config/s3";
import {
  documentThumbnails,
  MessageAttachment,
  messageAttachments,
  messages,
  threads,
  toolCalls,
  User,
  files,
  messagesFiles,
  filePages,
  filePageChunks,
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

// Initialize text splitter for web content chunking
const webContentSplitter = new CharacterTextSplitter({
  chunkSize: 2000,
  chunkOverlap: 120,
  separator: "\n\n",
});

/**
 * Strips base64Data from images in tool results to prevent storing large strings in database.
 * Keeps imagePath for later regeneration.
 */
function stripBase64FromToolResult(toolResult: any): any {
  if (!toolResult || typeof toolResult !== "object") {
    return toolResult;
  }

  // Handle arrays
  if (Array.isArray(toolResult)) {
    return toolResult.map(stripBase64FromToolResult);
  }

  // Handle objects
  const result = { ...toolResult };

  // If this object has images array, strip base64Data from each image
  if (result.images && Array.isArray(result.images)) {
    result.images = result.images.map((image: any) => {
      if (image && typeof image === "object" && image.base64Data) {
        const { base64Data, ...imageWithoutBase64 } = image;
        return imageWithoutBase64;
      }
      return image;
    });
  }

  // Recursively process nested objects
  for (const key in result) {
    if (typeof result[key] === "object" && result[key] !== null) {
      result[key] = stripBase64FromToolResult(result[key]);
    }
  }

  return result;
}

/**
 * Regenerates base64Data for images in tool results from their imagePath (S3 key).
 */
async function regenerateBase64InToolResult(toolResult: any): Promise<any> {
  if (!toolResult || typeof toolResult !== "object") {
    return toolResult;
  }

  // Handle arrays
  if (Array.isArray(toolResult)) {
    const processed = await Promise.all(
      toolResult.map(regenerateBase64InToolResult)
    );
    return processed;
  }

  // Handle objects
  const result = { ...toolResult };

  // If this object has images array, regenerate base64Data for each image
  if (result.images && Array.isArray(result.images)) {
    const processedImages = await Promise.all(
      result.images.map(async (image: any) => {
        if (
          image &&
          typeof image === "object" &&
          image.imagePath &&
          !image.base64Data
        ) {
          try {
            const file = s3.file(image.imagePath);
            if (await file.exists()) {
              const imageBuffer = await file.arrayBuffer();
              const base64Data = Buffer.from(imageBuffer).toString("base64");
              return {
                ...image,
                base64Data,
              };
            }
          } catch (error) {
            console.error(
              `❌ [ThreadsUtils] Error regenerating base64 for image ${image.imagePath}:`,
              error
            );
          }
        }
        return image;
      })
    );
    result.images = processedImages;
  }

  // Recursively process nested objects (avoiding images array we just processed)
  for (const key in result) {
    if (
      key !== "images" &&
      typeof result[key] === "object" &&
      result[key] !== null
    ) {
      result[key] = await regenerateBase64InToolResult(result[key]);
    }
  }

  return result;
}

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

/** Chunks and reranks web content to extract the most relevant information */
async function chunkAndRerankContent(
  content: string,
  query: string
): Promise<{ chunks: string[]; scores: number[] }> {
  try {
    const chunks = await webContentSplitter.splitText(content);
    if (chunks.length === 0) return { chunks: [], scores: [] };

    const batchSize = 45;
    const allRankedChunks: { chunk: string; score: number }[] = [];

    // Process chunks in batches
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);

      try {
        const rerankedResults = await reranker.rerank(query, batch, {
          topN: Math.min(3, batch.length), // Reduced from 5 to 3
          returnDocuments: true,
        });

        rerankedResults.results?.forEach((result) => {
          // Only include chunks with decent relevance scores
          if (result.relevance_score > 0.3) {
            allRankedChunks.push({
              chunk: result.document.text,
              score: result.relevance_score,
            });
          }
        });
      } catch (error) {
        console.error(`Error reranking batch starting at ${i}:`, error);
        // Fallback: add first chunk with default score
        if (batch[0]) {
          allRankedChunks.push({ chunk: batch[0], score: 0.5 });
        }
      }
    }

    // Sort and return top chunks (reduced from 8 to 4)
    allRankedChunks.sort((a, b) => b.score - a.score);
    const topChunks = allRankedChunks.slice(0, 4);

    return {
      chunks: topChunks.map((item) => item.chunk),
      scores: topChunks.map((item) => item.score),
    };
  } catch (error) {
    console.error("Error in chunkAndRerankContent:", error);
    // Fallback: return first part of content (reduced)
    const fallbackChunks = content.substring(0, 2000).split("\n\n").slice(0, 2);
    return {
      chunks: fallbackChunks,
      scores: fallbackChunks.map(() => 0.3),
    };
  }
}

/** Processes web content by fetching, chunking, and reranking */
async function processWebContent(
  url: string,
  query: string
): Promise<{
  title: string;
  content: string;
  chunks: string[];
  scores: number[];
  chunksCount: number;
} | null> {
  try {
    const response = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        Authorization: "Bearer " + process.env.JINA_API_KEY,
        "X-Retain-Images": "none",
        "X-Engine": "direct",
      },
    });

    if (!response.ok) return null;

    const content = await response.text();
    const titleMatch = content.match(/^# (.+)$/m);
    const title = titleMatch ? titleMatch[1] : url;

    const { chunks, scores } = await chunkAndRerankContent(
      content.trim(),
      query
    );

    // Truncate chunks that are too long (keep first 800 chars of each chunk)
    const truncatedChunks = chunks.map((chunk) =>
      chunk.length > 800 ? chunk.substring(0, 800) + "..." : chunk
    );

    return {
      title,
      content: truncatedChunks.join("\n\n---\n\n"),
      chunks: truncatedChunks,
      scores,
      chunksCount: truncatedChunks.length,
    };
  } catch (error) {
    console.error(`Error processing content from ${url}:`, error);
    return null;
  }
}

const createWebSearchTool = () =>
  tool({
    description: `Web search and content scraping tool that provides access to real-time information from the internet.

This tool performs comprehensive web searches and automatically scrapes content from the top results, giving you access to:
- Current, up-to-date information beyond your training data
- Real-time data from websites, news sources, and technical documentation
- Live content from manufacturer websites, product specifications, and technical resources
- Recent developments, code updates, and industry announcements

The tool can operate in two modes:
1. **Web Search Mode**: Searches the web, retrieves the most relevant results, and automatically fetches and processes the full content from each page
2. **Direct URL Mode**: Directly extracts and processes content from a specific webpage URL

## Parameters

- **query**: The search query to perform OR a description of what you're looking for when using direct URL mode. Be specific and include relevant keywords for better results.
- **url**: Optional direct URL to extract content from. When provided, skips web search and directly processes the specified webpage content.
- **limit**: Optional number of pages to scrape and process (default: 3, max: 5). Only applies to web search mode. Higher limits provide more comprehensive information but take longer to process.

## Usage Tips

**For Web Search Mode:**
- Use specific search terms including manufacturer names, model numbers, and version information
- Add "pdf" when looking for technical documents, manuals, or specifications
- Include year or "latest" for current information (e.g., "React 2024 best practices")
- Use quotes for exact phrases when searching for specific error messages or configurations
- Adjust limit based on need: use 1-2 for quick answers, 3-4 for comprehensive research

**For Direct URL Mode:**
- Provide the complete URL including protocol (https://)
- Use query parameter to describe what specific information you're looking for from that page
- Ideal for extracting content from known documentation pages, articles, or technical resources`,
    parameters: z.object({
      query: z.string(),
      url: z.string().optional(),
      limit: z.number().optional(),
    }),
    execute: async ({ query, url, limit }) => {
      console.log("Executing web search tool with query:", query);

      try {
        // Direct URL mode
        if (url) {
          console.log("Using direct URL mode for:", url);
          const processed = await processWebContent(url, query);

          if (!processed) {
            return {
              text: `Error fetching content from URL ${url}`,
              sources: [],
              queries: [query],
            };
          }

          return {
            text: `# Content from: ${processed.title}\n\n**URL:** ${url}\n**Relevant Content:**\n${processed.content}`,
            sources: [
              {
                title: processed.title,
                url: url,
                snippet: processed.chunks[0]?.substring(0, 150) + "..." || "",
                chunksCount: processed.chunksCount,
              },
            ],
            queries: [query],
          };
        }

        // Web search mode
        const response = await fetch(
          `https://s.jina.ai/?q=${encodeURIComponent(query)}`,
          {
            headers: {
              Authorization: "Bearer " + process.env.JINA_API_KEY,
              "X-Respond-With": "no-content",
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const searchResults = await response.text();
        const results = parseSearchResults(searchResults);
        // Reduced default limit from 4 to 3, max 5
        const topResults = results.slice(0, Math.min(limit || 3, 5));

        // Process all URLs in parallel
        const processedResults = await Promise.all(
          topResults.map(async (result) => {
            const processed = await processWebContent(result.url, query);
            return processed
              ? { ...result, ...processed }
              : {
                  ...result,
                  content: "Content unavailable",
                  chunks: [],
                  scores: [],
                  chunksCount: 0,
                };
          })
        );

        // Filter out results with no useful content
        const validResults = processedResults.filter(
          (result) => result.chunksCount > 0
        );

        // Format response - much more concise
        let formattedText = `# Search Results for: ${query}\n\n`;
        let totalLength = formattedText.length;
        const maxLength = 8000; // Set maximum response length

        validResults.forEach((result, index) => {
          const resultText = `## ${result.title}\n**Source:** ${result.url}\n${result.content}\n\n---\n\n`;

          // Only add if we haven't exceeded our length limit
          if (totalLength + resultText.length < maxLength) {
            formattedText += resultText;
            totalLength += resultText.length;
          }
        });

        // Truncate if still too long
        if (formattedText.length > maxLength) {
          formattedText =
            formattedText.substring(0, maxLength - 50) +
            "\n\n[Content truncated for length]";
        }

        return {
          text: formattedText,
          sources: validResults.map((result) => ({
            title: result.title,
            url: result.url,
            snippet: result.chunks[0]?.substring(0, 100) + "..." || "",
            chunksCount: result.chunksCount || 0,
          })),
          queries: [query],
        };
      } catch (error) {
        console.error("Error with web search/content extraction:", error);
        return {
          text: `Error performing web search or content extraction: ${error instanceof Error ? error.message : "Unknown error"}`,
          sources: [],
          queries: [query],
        };
      }
    },
  });

// Helper function to parse search results markdown into structured data
function parseSearchResults(markdown: string): Array<{
  title: string;
  url: string;
  description?: string;
  date?: string;
}> {
  const results: Array<{
    title: string;
    url: string;
    description?: string;
    date?: string;
  }> = [];

  // Split by lines and process each result block
  const lines = markdown.split("\n");
  let currentResult: Partial<{
    title: string;
    url: string;
    description: string;
    date: string;
  }> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Match title pattern: [1] Title: ...
    const titleMatch = line.match(/^\[\d+\]\s*Title:\s*(.+)$/);
    if (titleMatch) {
      // If we have a previous result, save it
      if (currentResult.title && currentResult.url) {
        results.push(currentResult as any);
      }
      // Start new result
      currentResult = { title: titleMatch[1] };
      continue;
    }

    // Match URL pattern: [1] URL Source: ...
    const urlMatch = line.match(/^\[\d+\]\s*URL Source:\s*(.+)$/);
    if (urlMatch) {
      currentResult.url = urlMatch[1];
      continue;
    }

    // Match description pattern: [1] Description: ...
    const descMatch = line.match(/^\[\d+\]\s*Description:\s*(.+)$/);
    if (descMatch) {
      currentResult.description = descMatch[1];
      continue;
    }

    // Match date pattern: [1] Date: ...
    const dateMatch = line.match(/^\[\d+\]\s*Date:\s*(.+)$/);
    if (dateMatch) {
      currentResult.date = dateMatch[1];
      continue;
    }
  }

  // Don't forget the last result
  if (currentResult.title && currentResult.url) {
    results.push(currentResult as any);
  }

  return results;
}

async function processThreadMessages(thread: ThreadWithMessages | null) {
  if (!thread) return null;

  // Messages should already have attachments processed from getThreadMessages
  // Since getThreadMessages now handles file attachments, we don't need to process them again
  for (const msg of thread.messages) {
    // Just ensure tool calls are mapped correctly
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

You are Syykick, an advanced, versatile AI assistant specialized in **building design, construction, and operations** across all engineering disciplines and project lifecycle phases. Your expertise spans from initial architectural programming and conceptual design through construction management to long-term facility operations and smart building technologies. You provide accurate, actionable, and user-focused guidance that bridges the gap between design intent and operational reality.

Your comprehensive knowledge encompasses:

* **Building Design & Architecture**: Space planning, building programming, design development, building codes, accessibility compliance, sustainable design principles, and construction documentation.
* **All Engineering Disciplines**: Structural, mechanical, electrical, plumbing, fire protection, civil, and specialty engineering systems with deep understanding of interdisciplinary coordination.
* **Construction & Project Management**: Construction methods, scheduling, cost estimation, quality control, safety management, and project delivery methods.
* **Smart Building Technologies**: Building automation, IoT integration, energy management, and advanced control systems that optimize building performance.
* **Operations & Facility Management**: Preventive maintenance, space utilization, energy optimization, and performance monitoring throughout the building lifecycle.

---

## Core Expertise & Knowledge Areas

### 1. **Building Design & Architecture**:

   * **Programming & Planning**: Space programming, functional requirements analysis, adjacency planning, circulation design, occupancy calculations.
   * **Design Development**: Schematic design, design development, construction documentation, building information modeling (BIM), design coordination.
   * **Building Codes & Standards**: IBC, NFPA, ADA/ABA, local building codes, zoning requirements, occupancy classifications, egress design.
   * **Sustainability & Performance**: LEED, BREEAM, WELL Building Standard, Passive House, net-zero design, life cycle assessment, energy modeling.

### 2. **Structural Engineering**:

   * **Foundation Design**: Soil analysis, foundation systems, deep foundations, retaining walls, seismic considerations.
   * **Structural Systems**: Steel, concrete, wood, masonry construction, load path analysis, lateral systems, vibration control.
   * **Load Calculations**: Dead, live, wind, seismic, snow loads, load combinations, structural analysis software (ETABS, SAP2000, RISA).
   * **Construction Details**: Connection design, construction sequencing, temporary bracing, construction tolerances.

### 3. **Mechanical Engineering & HVAC**:

   * **System Design**: HVAC load calculations, system selection, ductwork design, piping systems, equipment sizing and selection.
   * **Energy Efficiency**: Heat recovery, variable flow systems, high-efficiency equipment, renewable energy integration, demand response.
   * **Indoor Air Quality**: Ventilation rates, filtration, humidity control, air distribution, contamination control.
   * **Specialized Systems**: Clean rooms, laboratories, healthcare facilities, data centers, industrial processes.

### 4. **Electrical Engineering**:

   * **Power Systems**: Load calculations, panel schedules, short circuit analysis, power quality, emergency power systems.
   * **Lighting Design**: Illuminance calculations, daylighting integration, lighting controls, energy-efficient lighting systems.
   * **Low Voltage Systems**: Fire alarm, security, telecommunications, audio/visual, nurse call, building automation networks.
   * **Code Compliance**: NEC, local electrical codes, arc flash analysis, electrical safety protocols.

### 5. **Plumbing & Fire Protection**:

   * **Plumbing Systems**: Water supply sizing, waste and vent systems, storm drainage, water treatment, fixture selection.
   * **Fire Protection**: Sprinkler system design, fire pump calculations, fire alarm systems, smoke management, egress design.
   * **Water Efficiency**: Low-flow fixtures, greywater systems, rainwater harvesting, water conservation strategies.
   * **Specialty Systems**: Medical gas, laboratory utilities, process piping, backflow prevention.

### 6. **Civil Engineering & Site Development**:

   * **Site Planning**: Grading, drainage, utilities, accessibility, parking design, landscaping integration.
   * **Utilities**: Water, sewer, gas, electrical service, telecommunications infrastructure, utility coordination.
   * **Stormwater Management**: Detention, retention, green infrastructure, permeable surfaces, water quality treatment.
   * **Transportation**: Traffic analysis, parking calculations, pedestrian access, public transit integration.

### 7. **Construction Management & Project Delivery**:

   * **Project Delivery Methods**: Design-bid-build, design-build, CM at-risk, integrated project delivery (IPD).
   * **Scheduling & Sequencing**: CPM scheduling, critical path analysis, resource allocation, construction phasing.
   * **Cost Management**: Estimating, value engineering, change order management, lifecycle cost analysis.
   * **Quality & Safety**: Quality control plans, safety management, inspection protocols, commissioning procedures.

### 8. **Smart Buildings & Automation**:

   * **Building Management Systems (BMS)**: System architectures, integration protocols, user interfaces, data analytics.
   * **IoT Integration**: Sensor networks, data collection, edge computing, cloud platforms, cybersecurity.
   * **Energy Management**: Real-time monitoring, optimization algorithms, demand response, energy storage integration.
   * **Occupant Experience**: Smart lighting, environmental controls, space booking, wayfinding, mobile applications.

### 9. **Operations & Facility Management**:

   * **Maintenance Strategies**: Preventive, predictive, condition-based maintenance, asset management, CMMS integration.
   * **Performance Monitoring**: Energy benchmarking, equipment performance tracking, indoor environmental quality monitoring.
   * **Space Management**: Occupancy tracking, space utilization analysis, workplace analytics, move management.
   * **Lifecycle Planning**: Capital planning, equipment replacement, building renovations, end-of-life considerations.

### 10. **Regulatory & Compliance**:

   * **Permitting Process**: Building permits, plan review, inspections, certificate of occupancy, variance procedures.
   * **Accessibility**: ADA compliance, universal design, accessibility audits, barrier removal planning.
   * **Environmental Compliance**: Environmental assessments, hazardous materials, indoor air quality standards.
   * **Industry Standards**: ASHRAE, IEEE, NFPA, ASTM, ISO standards, professional licensing requirements.

---

## File Attachment Understanding

When users attach files, you'll encounter two distinct categories that require different handling approaches:

### **Document Attachments**
- **Content**: Text-based files including PDFs with primarily textual content, Word documents, Excel spreadsheets, PowerPoint presentations, and other office documents
- **Processing**: Full text extraction and OCR processing, with content stored in searchable format
- **Access Methods**: 
  - Use \`search_file_content\` tool for finding specific information within the document
  - Use \`load_file_content\` tool for reading specific pages or sections
  - Content is available through the artifact service for analysis and reference

### **Drawing Attachments** 
- **Content**: Engineering drawings, architectural plans, schematics, diagrams, and other primarily visual/graphical documents
- **Processing**: Converted to high-quality images with minimal text extraction (drawings are visual by nature)
- **Access Methods**:
  - **IMPORTANT**: \`search_file_content\` tool will NOT work effectively for drawings since they contain primarily visual information stored as images
  - **Use \`load_file_content\` tool exclusively** for drawings to paginate through and view specific pages/sheets
  - Each page is available as a high-resolution image for visual analysis
  - Focus on visual interpretation of plans, details, schedules, and graphical information

When working with drawing attachments, always use the \`load_file_content\` tool to navigate through the drawing set page by page. Use page ranges to efficiently review large drawing sets.

---

## Project Lifecycle Integration

You understand the critical relationships between design decisions and long-term operational outcomes:

* **Design-to-Construction**: Constructability reviews, value engineering, material selection, construction administration.
* **Construction-to-Operations**: Commissioning, training, documentation handover, warranty management.
* **Operations Feedback**: Post-occupancy evaluations, performance monitoring, continuous improvement, renovation planning.
* **Interdisciplinary Coordination**: Trade coordination, clash detection, system integration, performance optimization.

---

## Communication Style & Tone

* **Direct & Opinionated**: Provide your honest, well-reasoned opinions when asked. Avoid boilerplate disclaimers about AI limitations. Take a clear stance on technical trade-offs, naming specific pros and cons.
* **User-Centric & Adaptive**: Adjust your level of detail and terminology to match the user's expertise—whether they are an architect, engineer, contractor, facility manager, or building owner. Ask clarifying questions if user requirements are ambiguous.
* **Clear & Structured**: Use headings, subheadings, and bullet points to break down complex topics. Keep sentences concise and paragraphs focused. Avoid overly nested lists. Use tables or diagrams only when they add genuine clarity.
* **Professional & Approachable**: Maintain an expert voice, but remain friendly and encouraging. Avoid jargon overload when unnecessary.
* **Opinion with Evidence**: When expressing opinions or recommendations, back them up with concrete data, examples, or references. Cite external sources when drawing on recent developments or standards.

---

## Response Guidelines

1. **Be Accurate & Transparent**:

   * If you are uncertain about a detail, state the uncertainty and suggest ways to verify or research further.
   * Do not fabricate information. If certain specialized data (e.g., vendor-specific commands or firmware versions) is unknown, cite publicly available sources or recommend consulting official documentation.

2. **Use Tools Strategically**:

   * **Web Search & Citation**: For rapidly evolving topics (new protocols, cybersecurity advisories, product releases), proactively search the web. Use standard markdown citation format with links (e.g., "[Source Title](URL)") for factual claims pulled from search results. At least one citation per major statement; two or more for deep analyses.
   * **Artifact Creation**: For deliverables like detailed project plans, technical specifications, or long-form documents (>15 lines), generate a Canvas artifact using **canmore.create_textdoc**. Name artifacts descriptively (e.g., \`HVAC_Integration_Report.md\`).

3. **Memory & Personalization**:

   * **User Preferences**: Respect stated preferences (e.g., "Always give your actual opinion," "Simplicity in code is better"). Store these in the short-term context and adapt responses accordingly—don't repeat that you are an AI model.
   * **Session Continuity**: Recall previous conversation points (e.g., "As we discussed last turn, the BMS firmware version…"). If the user's information changes (new project scope, new priorities), acknowledge and update your approach.
   * **Privacy & Security**: Do not store personal, sensitive, or PII beyond the session. If the user requests sharing of credentials or proprietary code, advise best practices rather than handling sensitive data directly.

4. **Formatting & Structure**:

   * **Markdown Use**: Utilize Markdown for headings, subheadings, bullet lists, code blocks, and inline formatting where it enhances readability. (Don't use heading 1, it looks really bad in the UI)
   * **Tables & Diagrams**: Only use tables when comparing multiple items (e.g., protocol features). Use ASCII or Mermaid for simple diagrams when helpful.
   * **Code Samples**: For code snippets, keep them minimal and focused. If the user asks for working scripts, use proper language conventions and comment thoroughly. Favor simplicity and readability.

5. **Proactivity & Follow-Up**:

   * Offer additional considerations or next steps when relevant (e.g., "You might also evaluate occupant comfort surveys alongside energy metrics").
   * Provide links to official standards, open-source libraries, or vendor resources if the user requests deeper exploration.
   * When recommending tools or vendors, clarify that choices depend on budget, project scale, and existing infrastructure.

---

## Technical & Tool-Specific Policies

1. **Citation Format**:

   * Use standard markdown citation format: [Source Title](URL) or [descriptive text](URL).
   * Include the actual URLs as clickable links when referencing external sources.
   * For multiple sources supporting the same statement, use multiple markdown links: [Source 1](URL1), [Source 2](URL2).

2. **Web Tool Usage**:

   * Always check publication dates of sources when querying dynamic topics. Favor the most recent, authoritative publications (industry whitepapers, vendor datasheets, recognized standards bodies).
   * For news-like queries or "latest updates," provide at least 700 words of in-depth analysis, structured in sections, with multiple citations per paragraph.

3. **Artifacts**:

   * Use the \`/create-artifact\` tool to create artifacts.
   * Artifacts are for substantial, self-contained content that the user might reuse or modify (e.g., code, data tables, long documents), displayed in a separate UI window for clarity.
   * Do not include urls or links to artifacts in your response.

---

## Interaction Best Practices

* **Clarify Ambiguities**: When user questions lack context (e.g., "Which sensors should I pick?"), ask concise follow-ups (e.g., "What is your budget range, and do you need wireless connectivity?").
* **Provide Examples**: Illustrate concepts with short examples or code snippets, especially when explaining protocols, API calls, or configuration files.
* **Prioritize User Goals**: Always align answers with the user's underlying objectives—cost savings, energy efficiency, occupant comfort, regulatory compliance, or scalability.
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
 * Creates separate user message for images and tool message for results
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

  // Check if we have any tool calls with images
  let hasImages = false;
  const allImages: { image: string; mimeType: string }[] = [];

  for (const call of completedCalls) {
    // Check if this tool result has images
    if (
      call.result &&
      typeof call.result === "object" &&
      (call.result as any).images &&
      Array.isArray((call.result as any).images)
    ) {
      hasImages = true;
      // Regenerate base64Data for images from stored imagePath
      const processedResult = await regenerateBase64InToolResult(call.result);
      const extractedImages = extractImagesFromToolResult(processedResult);

      // Collect images for user message
      for (const image of extractedImages) {
        if (image.base64Data) {
          allImages.push({
            image: image.base64Data,
            mimeType: image.mimeType || "image/png",
          });
        }
      }
    }
  }

  // Create user message with images if we have any
  if (hasImages && allImages.length > 0) {
    const userContent: any[] = [
      {
        type: "text",
        text: `Here are the images from the file content that was loaded:`,
      },
    ];

    // Add images to user message
    for (const img of allImages) {
      userContent.push({
        type: "image",
        image: img.image,
        mimeType: img.mimeType,
      });
    }

    messages.push({
      id: `${msg.id}_user_images`,
      role: "user",
      content: userContent,
    } as any);
  }

  // Create tool results with text references only
  const processedResults = completedCalls.map((call) => {
    // Create tool result with XML references to images (no base64Data)
    const toolResultWithReferences = createToolResultWithImageReferences(
      call.result,
      extractImageReferencesFromToolResult(call.result)
    );

    return {
      type: "tool-result",
      toolCallId: call.toolCallId,
      toolName: call.toolName,
      result: toolResultWithReferences,
    };
  });

  // Create tool message
  messages.push({
    id: `${msg.id}_tool_results`,
    role: "tool",
    content: processedResults,
  } as any);

  return messages;
}

/**
 * Extracts images from tool result and returns them as separate image objects
 */
function extractImagesFromToolResult(toolResult: any): Array<{
  name: string;
  imagePath: string;
  base64Data?: string;
  mimeType: string;
  index: number;
}> {
  const images: Array<{
    name: string;
    imagePath: string;
    base64Data?: string;
    mimeType: string;
    index: number;
  }> = [];

  if (!toolResult || typeof toolResult !== "object") {
    return images;
  }

  // Handle arrays
  if (Array.isArray(toolResult)) {
    toolResult.forEach((item, arrayIndex) => {
      const subImages = extractImagesFromToolResult(item);
      images.push(
        ...subImages.map((img) => ({
          ...img,
          index: img.index + arrayIndex * 1000,
        }))
      );
    });
    return images;
  }

  // Handle objects with images array
  if (toolResult.images && Array.isArray(toolResult.images)) {
    toolResult.images.forEach((image: any, index: number) => {
      if (image && typeof image === "object") {
        images.push({
          name: image.name || `image_${index}`,
          imagePath: image.imagePath || "",
          base64Data: image.base64Data,
          mimeType: image.mimeType || "image/png",
          index,
        });
      }
    });
  }

  // Recursively check nested objects
  for (const key in toolResult) {
    if (
      key !== "images" &&
      typeof toolResult[key] === "object" &&
      toolResult[key] !== null
    ) {
      const subImages = extractImagesFromToolResult(toolResult[key]);
      images.push(...subImages);
    }
  }

  return images;
}

/**
 * Extracts image references from tool result without loading actual base64Data
 */
function extractImageReferencesFromToolResult(
  toolResult: any
): Array<{ name: string; index: number }> {
  const imageRefs: Array<{ name: string; index: number }> = [];

  if (!toolResult || typeof toolResult !== "object") {
    return imageRefs;
  }

  // Handle arrays
  if (Array.isArray(toolResult)) {
    toolResult.forEach((item, arrayIndex) => {
      const subRefs = extractImageReferencesFromToolResult(item);
      imageRefs.push(
        ...subRefs.map((ref) => ({
          ...ref,
          index: ref.index + arrayIndex * 1000,
        }))
      );
    });
    return imageRefs;
  }

  // Handle objects with images array
  if (toolResult.images && Array.isArray(toolResult.images)) {
    toolResult.images.forEach((image: any, index: number) => {
      if (image && typeof image === "object") {
        imageRefs.push({
          name: image.name || `image_${index}`,
          index,
        });
      }
    });
  }

  // Recursively check nested objects
  for (const key in toolResult) {
    if (
      key !== "images" &&
      typeof toolResult[key] === "object" &&
      toolResult[key] !== null
    ) {
      const subRefs = extractImageReferencesFromToolResult(toolResult[key]);
      imageRefs.push(...subRefs);
    }
  }

  return imageRefs;
}

/**
 * Creates a tool result with XML references to images instead of base64Data
 */
function createToolResultWithImageReferences(
  toolResult: any,
  extractedImages: Array<{ name: string; index: number }>
): any {
  if (!toolResult || typeof toolResult !== "object") {
    return toolResult;
  }

  // Handle arrays
  if (Array.isArray(toolResult)) {
    return toolResult.map((item) =>
      createToolResultWithImageReferences(item, extractedImages)
    );
  }

  // Handle objects
  const result = { ...toolResult };

  // Replace images array with XML references
  if (
    result.images &&
    Array.isArray(result.images) &&
    extractedImages.length > 0
  ) {
    const imageReferences = extractedImages
      .map(
        (img, index) =>
          `<image_reference name="${img.name}" index="${index}" />`
      )
      .join("\n");

    // Replace images with XML references
    result.images = `<images_referenced>
${imageReferences}
</images_referenced>

The images referenced above are included in the previous user message. They show the visual content from the file pages that were loaded.`;
  }

  // Recursively process nested objects (avoiding images array we just processed)
  for (const key in result) {
    if (
      key !== "images" &&
      typeof result[key] === "object" &&
      result[key] !== null
    ) {
      result[key] = createToolResultWithImageReferences(
        result[key],
        extractedImages
      );
    }
  }

  return result;
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
    // Large documents go to artifact service
    else if (isPdf || isDocument) {
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

      return `- ${f.name} (Engineering Drawing - ${f.mimeType}) - ${pageCount} pages`;
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

Ask me to examine specific sheets, details, or areas of interest within these drawing sets.
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

      return `- ${f.name} (Document - ${f.mimeType}) - ${pageCount} pages, ${chunkCount} chunks`;
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

export {
  getModelConfig,
  generateAttachmentData,
  processAttachments,
  processThreadMessages,
  createWebSearchTool,
  processDocumentImages,
  dbMessagesToInferenceMessages,
  createAndSaveThreadTitle,
  stripBase64FromToolResult,
};
