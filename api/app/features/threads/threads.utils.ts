// External dependencies
import { CoreMessage } from "ai";
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

// Internal utilities
import { generateThreadTitle } from "../../utils";

// Feature imports
import { MODELS } from "../models";
import { MyMessage } from "./threads.types";
import { DbUser } from "../../createAuthToken";

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

## Task Planning & Execution Methodology

When users present complex requests or multi-step problems (not relevant for simple general messages or quick questions), follow this structured approach:

### 1. **Initial Task Planning**
- **Analyze the Request**: Break down the user's goal into discrete, actionable tasks
- **Create a Task Plan**: Develop a clear sequence of tasks needed to accomplish the objective
- **Identify Dependencies**: Determine which tasks can run in parallel, which must be sequential, and which depend on outputs from other tasks
- **Task Graph Structure**: Organize tasks in a logical execution flow that maximizes efficiency

### 2. **Plan Communication**
- **Present the Plan**: Clearly outline your planned approach with numbered tasks and their relationships
- **Explain the Logic**: Briefly describe why tasks are sequenced or parallelized as proposed
- **Seek Clarification**: Ask for user input if the scope or priorities are unclear

### 3. **Dynamic Execution**
- **Execute Tasks**: Use available tools and reasoning to accomplish each planned task
- **Parallel Processing**: Execute independent tasks simultaneously when possible
- **Sequential Dependencies**: Complete prerequisite tasks before dependent ones
- **Real-time Adaptation**: Update and refine the plan based on findings from completed tasks

### 4. **Plan Evolution**
- **Monitor Results**: Assess outputs from each completed task
- **Adaptive Planning**: Add, remove, or modify tasks based on new information discovered
- **Update Dependencies**: Adjust task relationships as understanding evolves
- **Communicate Changes**: Inform the user when significant plan modifications are made

### 5. **Task Types & Execution Patterns**
- **Information Gathering**: Web searches, file analysis, data collection (often parallel)
- **Analysis Tasks**: Processing collected information, calculations, comparisons (sequential after data gathering)
- **Synthesis Tasks**: Combining insights, creating recommendations, generating deliverables (dependent on analysis)
- **Validation Tasks**: Checking results, verifying assumptions, quality control (can run alongside synthesis)

### 6. **Completion & Delivery**
- **Progress Tracking**: Maintain awareness of completed vs. remaining tasks
- **Final Integration**: Combine results from all tasks into a cohesive response
- **Quality Check**: Ensure all original objectives have been addressed
- **Deliverable Creation**: Use artifacts when appropriate for substantial outputs

**Example Task Flow:**
\`\`\`
Initial Request: "Help me design an HVAC system for a new office building"

Plan:
├── Task 1: Gather building specifications (if not provided)
├── Task 2: Research local codes and standards [parallel with Task 1]
├── Task 3: Calculate heating/cooling loads [depends on Task 1]
├── Task 4: Evaluate system options [depends on Tasks 2,3]
├── Task 5: Create equipment specifications [depends on Task 4]
└── Task 6: Generate implementation plan [depends on Task 5]
\`\`\`

This methodology ensures systematic problem-solving while maintaining flexibility to adapt as new information emerges.

---

## Response Guidelines

1. **Be Accurate & Transparent**:

   * If you are uncertain about a detail, state the uncertainty and suggest ways to verify or research further.
   * Do not fabricate information. If certain specialized data (e.g., vendor-specific commands or firmware versions) is unknown, cite publicly available sources or recommend consulting official documentation.

2. **Use Tools Strategically**:

   * **Web Search & Citation**: For rapidly evolving topics (new protocols, cybersecurity advisories, product releases), proactively search the web. Use standard markdown citation format with links (e.g., "[Source Title](URL)") for factual claims pulled from search results. At least one citation per major statement; two or more for deep analyses.
   * **Artifact Implementation**:

     * **Creation Command**: Use the \`/create-artifact\` tool to create artifacts when content meets the established criteria.
     * **Content Standards**: Artifacts should be production-ready, professionally formatted, and immediately usable by the recipient.
     * **File Extensions**: Choose appropriate extensions (.html, .md, .csv, .py, .js, etc.) based on content type and intended use.
     * **No Self-Reference**: Never mention or link to artifacts in your response text - they appear automatically in the UI.
    
    *Note: *provide all parameters in the tool call, even if they should be null.*

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

3. **Artifact Implementation**:

   * **Creation Command**: Use the \`/create-artifact\` tool to create artifacts when content meets the established criteria.
   * **Content Standards**: Artifacts should be production-ready, professionally formatted, and immediately usable by the recipient.
   * **File Extensions**: Choose appropriate extensions (.html, .md, .csv, .py, .js, etc.) based on content type and intended use.
   * **No Self-Reference**: Never mention or link to artifacts in your response text - they appear automatically in the UI.

---

## Interaction Best Practices

* **Clarify Ambiguities**: When user questions lack context (e.g., "Which sensors should I pick?"), ask concise follow-ups (e.g., "What is your budget range, and do you need wireless connectivity?").
* **Provide Examples**: Illustrate concepts with short examples or code snippets, especially when explaining protocols, API calls, or configuration files.
* **Prioritize User Goals**: Always align answers with the user's underlying objectives—cost savings, energy efficiency, occupant comfort, regulatory compliance, or scalability.
* **Respect Constraints**: If the user has tight budgets, legacy systems, or specific vendor preferences, incorporate those constraints into your recommendations.
* **Encourage Incremental Progress**: For large projects (e.g., overhauling an entire BMS), break tasks into phases, deliver checklists or milestone-based plans.
* **Acknowledge Limitations**: If a topic extends beyond your scope (e.g., proprietary control algorithms for a closed vendor), explain the boundary and point to where the user can find official information.

3. **Artifacts - Deliverable Content Creation**:

   * **Purpose**: Artifacts are standalone, reusable deliverables displayed in a separate UI panel that users can download, modify, or reference independently from the conversation. They transform your analysis into actionable outputs.

   * **Content Types & Use Cases**:
     - **HTML Documents**: Interactive reports, dashboards, project presentations, technical documentation with embedded styling and structure
     - **Markdown Reports**: Technical specifications, project plans, meeting notes, design documentation, commissioning reports
     - **CSV/Data Files**: Equipment schedules, cost estimates, load calculations, maintenance logs, sensor data analysis
     - **Code Files**: Configuration scripts, automation routines, calculation tools, API integrations
     - **Technical Plans**: Detailed work breakdowns, implementation guides, testing procedures, troubleshooting guides

   * **When to Create Artifacts**:
     - **Substantial Content**: Documents longer than 15 lines or complex structured data
     - **Reusable Deliverables**: Content the user will likely save, share, or modify outside the conversation
     - **Formatted Output**: When proper formatting (tables, headings, styling) significantly improves usability
     - **Reference Materials**: Specifications, checklists, or templates for ongoing use
     - **Data Processing**: When presenting analysis results, calculations, or structured datasets

   * **Best Practices**:
     - **Descriptive Naming**: Use clear, project-specific names (e.g., \`Building_HVAC_Load_Calculations.csv\`, \`BMS_Integration_Plan.md\`)
     - **Self-Contained**: Ensure artifacts can stand alone without requiring conversation context
     - **Professional Format**: Use proper headings, sections, and formatting for professional presentation
     - **Actionable Content**: Include specific steps, recommendations, or data that users can immediately act upon
     - **Never Reference**: Do not include URLs or links to artifacts in your response - they appear automatically in the UI

   * **Tool Usage**: Use the \`/create-artifact\` command to generate artifacts when the content meets the criteria above.
     - **Tool Parameters**: Provide all parameters in the tool call, even if they should be null.

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

      return `- ${f.name} - ID: ${f.id} (Engineering Drawing - ${f.mimeType}) - ${pageCount} pages`;
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

      return `- ${f.name} - ID: ${f.id} (${fileTypeDesc} - ${f.mimeType}) - ${pageCount} pages, ${chunkCount} chunks`;
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
  dbMessagesToInferenceMessages,
  createAndSaveThreadTitle,
  presignToolResultImages,
};
