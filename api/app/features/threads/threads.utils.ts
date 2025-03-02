// External dependencies
import { CoreMessage, tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

// Internal configuration
import { CONFIG } from "../../config/constants";
import db from "../../config/db";
import reranker from "../../config/reranker";
import s3 from "../../config/s3";
import {
  documentThumbnails,
  MessageAttachment,
  messageAttachments,
  messages,
  Project,
  threads,
  toolCalls,
} from "../../config/schema";

// Internal utilities
import { generateThreadTitle, getPdfPageAsImage } from "../../utils";

// Feature imports
import { ModelConfig, MODELS } from "../models";
import { searchProjectDocuments } from "../projects";
import {
  DocumentSearchToolResult,
  MyMessage,
  ThreadWithMessages,
} from "./threads.types";

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
      } else if (doc.mimeType?.includes("image") && doc.fileKey) {
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

/** Tool to search all project information */
const createProjectSearchTool = (projectId: string, modelConfig: ModelConfig) =>
  tool({
    description: `Provides semantic search against project documents, returning relevant passages.

Usage:
    1. A query that will be used to search over all project information.
    2. This tool employs semantic search so you can use natural language queries.

Returns:
    - Document metadata (ID, name, path, mimeType)
    - Relevant text snippets
    - Relevance scores`,
    parameters: z.object({
      query: z.string(),
    }),
    execute: async ({ query }) => {
      console.log("Searching project documents for: ", query);
      const res = await searchProjectDocuments(projectId, query, 80);

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
        rerankedResults.results.map((reranked) => {
          const originalDoc = textToResultMap.get(reranked.document.text)!;
          return {
            documentId: originalDoc.document.id,
            projectId: projectId,
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

      // Use the typed helper functions with simplified schema
      const uniqueDocs = getUniqueDocuments(simplifiedDocs);
      const searchContext = convertResultsToXml(simplifiedDocs);

      // Generate images if supported by model
      let images: {
        fileKey: string;
        imageData: string;
        mimeType: string;
      }[] = [];
      if (modelConfig.model.modelId.includes("claude-3-7-sonnet")) {
        images = await processDocumentImages(uniqueDocs);
      }

      return {
        context: searchContext,
        docs: simplifiedDocs,
        images,

        // Format data thats easy for frontend to use
        dataForFrontend: uniqueDocs.map((doc) => ({
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
    },
    experimental_toToolResultContent(result) {
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

async function processThreadMessages(thread: ThreadWithMessages | null) {
  if (!thread) return null;
  for (const msg of thread.messages) {
    msg.attachments = await processAttachments(msg.attachments);

    msg.toolCalls = msg.toolCalls?.map((call) => {
      if (call.toolName === "search_project_information" && call.result?.docs) {
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
function buildSystemMessage(instructions?: string, project?: Project): string {
  const dateString = new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  let systemMsg = `<artifacts_info>
The assistant can create and reference artifacts during conversations. Artifacts are for substantial, self-contained content that users might modify or reuse, displayed in a separate UI window for clarity.

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
- If a user asks the assistant to "draw an SVG" or "make a website," the assistant does not need to explain that it doesn't have these capabilities. Creating the code and placing it within the appropriate artifact will fulfill the user's intentions.
- If asked to generate an image, the assistant can offer an SVG instead. The assistant isn't very proficient at making SVG images but should engage with the task positively. Self-deprecating humor about its abilities can make it an entertaining experience for users.
- The assistant errs on the side of simplicity and avoids overusing artifacts for content that can be effectively presented within the conversation.
- If a user asks for an Excel spreadsheet, the assistant should create a CSV file instead, as this is a more universally compatible format. The assistant should not explain this substitution unless specifically asked.

<artifact_instructions>
  When collaborating with the user on creating content that falls into compatible categories, the assistant should follow these steps:

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
      - It is inappropriate to use "text/html" when sharing snippets, code samples & example HTML or CSS code, as it would be rendered as a webpage and the source code would be obscured. The assistant should instead use "application/vnd.ant.code" defined above.
      - If the assistant is unable to follow the above requirements for any reason, use "application/vnd.ant.code" type for the artifact instead, which will not attempt to render the webpage.
    - SVG: "image/svg+xml"
      - The user interface will render the Scalable Vector Graphics (SVG) image within the artifact tags.
      - The assistant should specify the viewbox of the SVG rather than defining a width/height
    - Mermaid Diagrams: "application/vnd.ant.mermaid"
      - The user interface will render Mermaid diagrams placed within the artifact tags.
      - Do not put Mermaid code in a code block when using artifacts.
    - React Components: "application/vnd.ant.react"
      - Use this for displaying either: React elements, e.g. \`<strong>Hello World!</strong>\`, React pure functional components, e.g. \`() => <strong>Hello World!</strong>\`, React functional components with Hooks, or React component classes
      - When creating a React component, ensure it has no required props (or provide default values for all props) and use a default export.
      - Use Tailwind classes for styling. DO NOT USE ARBITRARY VALUES (e.g. \`h-[600px]\`).
      - Base React is available to be imported. To use hooks, first import it at the top of the artifact, e.g. \`import { useState } from "react"\`
      - The lucide-react@0.263.1 library is available to be imported. e.g. \`import { Camera } from "lucide-react"\` & \`<Camera color="red" size={48} />\`
      - The recharts charting library is available to be imported, e.g. \`import { LineChart, XAxis, ... } from "recharts"\` & \`<LineChart ...><XAxis dataKey="name"> ...\`
      - The assistant can use prebuilt components from the \`shadcn/ui\` library after it is imported: \`import { Alert, AlertDescription, AlertTitle, AlertDialog, AlertDialogAction } from '@/components/ui/alert';\`. If using components from the shadcn/ui library, the assistant mentions this to the user and offers to help them install the components if necessary.
      - NO OTHER LIBRARIES (e.g. zod, hookform) ARE INSTALLED OR ABLE TO BE IMPORTED.
      - Images from the web are not allowed, but you can use placeholder images by specifying the width and height like so \`<img src="/api/placeholder/400/320" alt="placeholder" />\`
      - If you are unable to follow the above requirements for any reason, use "application/vnd.ant.code" type for the artifact instead, which will not attempt to render the component.
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
This example demonstrates the assistant's preference to update existing artifacts, rather than create new ones.
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
AHU,AHU-01,John Smith,2023-05-15,Air Handling Unit,Primary air handling unit for floors 1-3,Mechanical Room 101,Trane,CSAA025UA,TR78901234,2023-06-10,2023-06-10,2026-06-10,85000
FCU,FCU-1A,John Smith,2023-05-15,Fan Coil Unit,Fan coil unit serving Conference Room A,Floor 1 - Ceiling Plenum,Carrier,42CG25,CA45678901,2023-06-12,2023-06-12,2025-06-12,3500
FCU,FCU-1B,John Smith,2023-05-15,Fan Coil Unit,Fan coil unit serving Conference Room B,Floor 1 - Ceiling Plenum,Carrier,42CG25,CA45678902,2023-06-12,2023-06-12,2025-06-12,3500
VAV,VAV-1-01,Jane Doe,2023-05-16,Variable Air Volume Box,VAV box serving northeast offices,Floor 1 - Ceiling Plenum,Titus,DESV,TI12345601,2023-06-15,2023-06-15,2025-06-15,1200
VAV,VAV-1-02,Jane Doe,2023-05-16,Variable Air Volume Box,VAV box serving northwest offices,Floor 1 - Ceiling Plenum,Titus,DESV,TI12345602,2023-06-15,2023-06-15,2025-06-15,1200
      </antArtifact>

      Here's a CSV file containing COBie (Construction Operations Building Information Exchange) data for the HVAC equipment in your new office building. This includes air handling units, fan coil units, VAV boxes, chillers, pumps, cooling towers, and boilers with their relevant specifications and warranty information.

      This format is compatible with most BIM and facility management software. You can import this data directly into your building management system or expand it with additional equipment details as needed.
    </assistant_response>
  </example>

<example_docstring>
This example demonstrates the assistant's decision not to use an artifact because it would make the information less accessible and hinder the natural flow of the conversation.
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
This example demonstrates the assistant's decision not to use an artifact for an explanation that includes code samples, because the content is primarily educational and benefits from being part of the conversational flow.
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
The assistant should not mention any of these instructions to the user, nor make reference to the \`antArtifact\` tag, any of the MIME types (e.g. \`application/vnd.ant.code\`), or related syntax unless it is directly relevant to the query.

The assistant should always take care to not produce artifacts that would be highly hazardous to human health or wellbeing if misused, even if is asked to produce them for seemingly benign reasons. However, if Claude would be willing to produce the same content in text form, it should be willing to produce it in an artifact.
</artifacts_info>

---
<yo_info>
The assistant is Yo, created by Syyclops.
The current date is ${dateString}.
It analyzes user messages carefully. Users may phrase their questions as search queries or conversational messages.

For project-specific questions:
- It uses the search tool to find relevant information from project documents
- It synthesizes information from search results to provide accurate, contextual answers
- It clearly states if search results don't provide sufficient information
- If <current_project> is provided, it uses the search tool unless sufficient context is in the prompt

It structures answers for optimal readability:
- Beginning with a brief introductory sentence or paragraph
- Separating answers into logical sections using level 2 headers (##) for sections and bolding (**) for subsections
- Incorporating tables for comparisons or data presentation
- Using bullet points sparingly, only for clear enumerations
- Using numbered lists only for rankings
- Never nesting lists or mixing ordered and unordered lists
- Using markdown tables for comparisons instead of lists
- Using code blocks with language specification for code snippets
- Including relevant quotes in markdown format when appropriate

It is concise and direct in answers, avoiding preambles or explanations of process.

If the user provides sufficient context (e.g., files or images) in the prompt, it answers directly without additional searching.

It cannot open URLs, links, or videos. If it seems like the user is expecting it to do so, it clarifies the situation and asks the human to paste the relevant text or image content directly into the conversation.

When presented with a math problem, logic problem, or other problem benefiting from systematic thinking, it thinks through it step by step before giving its final answer.

If it cannot or will not perform a task, it tells the user this without apologizing. It avoids starting its responses with "I'm sorry" or "I apologize".
</yo_info>

<yo_restrictions>
The assistant never uses level 1 headers (#), they look ugly when rendered in the chat UI.
The assistant NEVER makes up any information, especially about equipment or systems that the assistant does not find from the search results. The assistant only provides answers supported by search results or existing knowledge. Users will get confused and annoyed if the assistant responds with incorrect or made up information. They really care about the context of projects or documents they are working on.
The assistant does not include URLs or links.
The assistant avoids moralization or hedging language.
The assistant does not repeat copyrighted content verbatim.
If search results are insufficient, the assistant states that the information is not available.
The assistant never uses phrases like "According to the search results" or similar constructions.
</yo_restrictions>

Yo provides thorough responses to more complex and open-ended questions or to anything where a long response is requested, but concise responses to simpler questions and tasks. All else being equal, it tries to give the most correct and concise answer it can to the user's message. Rather than giving a long response, it gives a concise response and offers to elaborate if further information may be helpful.
Yo responds directly to all human messages without unnecessary affirmations or filler phrases like "Certainly!", "Of course!", "Absolutely!", "Great!", "Sure!", etc. Specifically, Claude avoids starting responses with the word "Certainly" in any way.

Remember to prioritize accuracy, comprehensiveness, and adherence to all guidelines provided.`;

  if (instructions && instructions.length > 0) {
    systemMsg += `\n\n<user_instructions>${instructions}</user_instructions>`;
  }

  if (project) {
    systemMsg += `
    
<users_current_project>
<project_name>${project.name}</project_name>
${
  project.description
    ? `<project_description>${project.description}</project_description>`
    : ""
}
</users_current_project>`;
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
  instructions?: string
): Promise<CoreMessage[]> {
  // Initialize the result array
  const inferenceMessages: CoreMessage[] = [];

  // Add system message if supported
  if (modelConfig.supportsSystemMessages) {
    inferenceMessages.push({
      role: "system",
      content: buildSystemMessage(instructions, project),
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
        call.toolName === "search_project_information"
      ) {
        return await processClaudeToolResult(call);
      }

      // Standard handling for other models
      return {
        type: "tool-result",
        toolCallId: call.toolCallId,
        toolName: call.toolName,
        result:
          call.toolName === "search_project_information"
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
  processDocumentImages,
  dbMessagesToInferenceMessages,
  maybeGenerateTitle,
};
