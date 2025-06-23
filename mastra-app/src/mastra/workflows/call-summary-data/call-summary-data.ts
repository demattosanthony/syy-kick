// Core dependencies
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { RuntimeContext } from "@mastra/core/runtime-context";
import { z } from "zod";

// AI/ML dependencies
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";

// PDF generation
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import * as readline from "node:readline";
import { Readable } from "stream";

// Local utilities
import { getFileFromS3, getPresignedUrl, uploadFileToS3 } from "../../../s3.ts";
import logger from "../../../logger.ts";
import {
  type WorkflowExecutionInputValues,
  type WorkflowFile,
} from "../../../types.ts";

// Types for CSV data
interface CallRecord {
  DATE1: string;
  CUSTNAME: string;
  CUSTNMBR: string;
  ADRSCODE: string;
  Service_Call_ID: string;
  Record_Notes: string;
  fileName: string;
}

const inputSchema: z.ZodType<WorkflowExecutionInputValues> = z.object({
  csvFile: z.object({
    type: z.literal("file"),
    label: z.literal("CSV File"),
    value: z.array(z.object({
      fileKey: z.string(),
      mimeType: z.literal("text/csv"),
      fileName: z.string(),
    })),
    multiple: z.literal(true),
  }),
  custNMBR: z.object({
    type: z.literal("text"),
    label: z.literal("CUSTNMBR"),
    value: z.object({
      text: z.string(),
    }),
  }),
  adrsCode: z.object({
    type: z.literal("text"),
    label: z.literal("ADRSCODE"),
    value: z.object({
      text: z.string(),
    }),
  }),
});

const finalStepOutputSchema = z.object({
  callSummaryPdfFile: z.object({
    type: z.literal("file"),
    file: z.object({
      fileKey: z.string(),
      mimeType: z.string(),
      fileName: z.string(),
      url: z.string().optional(),
    }),
  }),
});

const stepOne = createStep({
  id: "streamAndFilterRecords",
  description: "Stream CSV files, parse, and filter records on-the-fly.",
  inputSchema: inputSchema,
  outputSchema: z.object({
    filteredRecords: z.array(z.object({
      DATE1: z.string(),
      CUSTNAME: z.string(),
      CUSTNMBR: z.string(),
      ADRSCODE: z.string(),
      Service_Call_ID: z.string(),
      Record_Notes: z.string(),
      fileName: z.string(),
    })),
    custNMBR: z.string(),
    adrsCode: z.string(),
  }),
  execute: async ({ inputData }) => {
    const csvFiles = inputData.csvFile.value as WorkflowFile[];
    const custNMBR = (inputData.custNMBR.value as { text: string }).text.trim();
    const adrsCode = (inputData.adrsCode.value as { text: string }).text.trim();

    logger.info(`Starting stream processing for ${csvFiles.length} file(s).`);
    logger.info(`Filtering for CUSTNMBR: "${custNMBR}", ADRSCODE: "${adrsCode}"`);

    const processingPromises = csvFiles.map((csvFile) =>
      new Promise<CallRecord[]>(async (resolve, reject) => {
        try {
          const { fileKey, fileName } = csvFile;
          const matchingRecords: CallRecord[] = [];
          
          const file = await getFileFromS3(fileKey);
          const s3Stream = file.Body;

          if (!s3Stream || !(s3Stream instanceof Readable)) {
            logger.warn(`Could not get readable stream for ${fileName}. Skipping.`);
            resolve([]);
            return;
          }

          const rl = readline.createInterface({
            input: s3Stream,
            crlfDelay: Infinity,
          });

          let isFirstLine = true;
          rl.on('line', (line) => {
            if (isFirstLine) {
              isFirstLine = false;
              return; // Skip header
            }

            const values = line.split(',');
            if (values.length < 6) return;

            const recordCustNmbr = values[2].trim();
            const recordAdrsCode = values[3].trim();

            if (recordCustNmbr === custNMBR && recordAdrsCode === adrsCode) {
              const noteParts = values.slice(5);
              let recordNotes = noteParts.join(',').trim();
              if (recordNotes.startsWith('"') && recordNotes.endsWith('"')) {
                recordNotes = recordNotes.substring(1, recordNotes.length - 1);
              }
              
              matchingRecords.push({
                DATE1: values[0].trim(),
                CUSTNAME: values[1].trim(),
                CUSTNMBR: recordCustNmbr,
                ADRSCODE: recordAdrsCode,
                Service_Call_ID: values[4].trim(),
                Record_Notes: recordNotes,
                fileName,
              });
            }
          });

          rl.on('close', () => {
            logger.info(`   ...finished streaming ${fileName}, found ${matchingRecords.length} matching records.`);
            resolve(matchingRecords);
          });

          rl.on('error', (err) => {
            logger.error(`Error streaming file ${fileName}:`, err);
            reject(err);
          });
        } catch (error) {
          reject(error);
        }
      })
    );
    
    const results = await Promise.all(processingPromises);
    const allFilteredRecords = results.flat();

    logger.info(`Found a total of ${allFilteredRecords.length} matching records across all files.`);
    
    if (allFilteredRecords.length === 0) {
      throw new Error(`No records found for CUSTNMBR: ${custNMBR} and ADRSCODE: ${adrsCode}`);
    }
    
    return {
      filteredRecords: allFilteredRecords,
      custNMBR,
      adrsCode,
    };
  },
});

const stepTwo = createStep({
  id: "sortRecordsByDate",
  description: "Sort records by date (most recent first)",
  inputSchema: z.object({
    filteredRecords: z.array(z.object({
      DATE1: z.string(),
      CUSTNAME: z.string(),
      CUSTNMBR: z.string(),
      ADRSCODE: z.string(),
      Service_Call_ID: z.string(),
      Record_Notes: z.string(),
      fileName: z.string(),
    })),
    custNMBR: z.string(),
    adrsCode: z.string(),
  }),
  outputSchema: z.object({
    sortedRecords: z.array(z.object({
      DATE1: z.string(),
      CUSTNAME: z.string(),
      CUSTNMBR: z.string(),
      ADRSCODE: z.string(),
      Service_Call_ID: z.string(),
      Record_Notes: z.string(),
      fileName: z.string(),
    })),
    custNMBR: z.string(),
    adrsCode: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { filteredRecords } = inputData;
    logger.info(`Sorting ${filteredRecords.length} records by date (most recent first)`);

    const sortedRecords = [...filteredRecords].sort((a, b) => {
      const dateA = new Date(a.DATE1);
      const dateB = new Date(b.DATE1);
      return dateB.getTime() - dateA.getTime();
    });

    return {
      sortedRecords,
      custNMBR: inputData.custNMBR,
      adrsCode: inputData.adrsCode,
    };
  },
});

const stepThree = createStep({
  id: "generateLlmSummary",
  description: "Generate a concise summary of all service calls using an LLM.",
  inputSchema: z.object({
    sortedRecords: z.array(z.object({
      DATE1: z.string(),
      CUSTNAME: z.string(),
      CUSTNMBR: z.string(),
      ADRSCODE: z.string(),
      Service_Call_ID: z.string(),
      Record_Notes: z.string(),
      fileName: z.string(),
    })),
    custNMBR: z.string(),
    adrsCode: z.string(),
  }),
  outputSchema: z.object({
    summaryText: z.string(),
    sortedRecords: z.array(z.object({
      DATE1: z.string(),
      CUSTNAME: z.string(),
      CUSTNMBR: z.string(),
      ADRSCODE: z.string(),
      Service_Call_ID: z.string(),
      Record_Notes: z.string(),
      fileName: z.string(),
    })),
    custNMBR: z.string(),
    adrsCode: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { sortedRecords, custNMBR, adrsCode } = inputData;
    logger.info(`Generating LLM summary for ${sortedRecords.length} records.`);

    const prompt = `Your role is to act as an expert technical analyst. A busy field technician is about to visit a customer and needs a high-level summary of all previous service calls to quickly understand the situation.

You will be provided with a JSON array of service call records, sorted from most recent to oldest.

Your task is to synthesize this information into a concise, easy-to-read summary. Do NOT simply list every call. Instead, identify patterns, key events, and crucial information.

**Output Structure:**

1.  **Overall Situation:** A 1-2 sentence summary of the main issues or history at this site.
2.  **Key Equipment:** A list of the primary equipment models and serial numbers mentioned across the notes.
3.  **Service History Highlights:** A bulleted list of the 3-5 most significant events or findings. Focus on major repairs, recurring problems, and diagnoses.
4.  **Open Recommendations:** A bulleted list of any outstanding recommendations or required follow-up actions (e.g., "Customer will need quote for this repair"). If there are none, state "No open recommendations noted."

**Instructions:**
- Be direct and use clear, technical language.
- Focus on facts: repairs made, parts replaced, system status, and technician findings.
- Extract equipment model and serial numbers (M# / S#) where available.
- The output must be a single block of plain text. Do not use Markdown formatting like '#' or '**'. Use bullet points with '-'.

Here are the service records for CUSTNMBR ${custNMBR}:
${JSON.stringify(sortedRecords, null, 2)}`;

    const { object } = await generateObject({
      model: google("gemini-2.5-pro-preview-06-05"),
      schema: z.object({
        summaryText: z.string(),
      }),
      prompt,
    });
    
    logger.info("LLM Summary generated successfully.");

    return {
      summaryText: object.summaryText,
      sortedRecords,
      custNMBR,
      adrsCode,
    };
  },
});

const stepFour = createStep({
  id: "generatePdfFromData",
  description: "Generate PDF summary directly from sorted records",
  inputSchema: z.object({
    summaryText: z.string(),
    sortedRecords: z.array(z.object({
      DATE1: z.string(),
      CUSTNAME: z.string(),
      CUSTNMBR: z.string(),
      ADRSCODE: z.string(),
      Service_Call_ID: z.string(),
      Record_Notes: z.string(),
      fileName: z.string(),
    })),
    custNMBR: z.string(),
    adrsCode: z.string(),
  }),
  outputSchema: finalStepOutputSchema,
  execute: async ({ inputData, runtimeContext }) => {
    const { summaryText, sortedRecords, custNMBR, adrsCode } = inputData;
    const workflowId = runtimeContext.get("workflowId");
    const runId = runtimeContext.get("runId");
    
    logger.info("Generating PDF with summary and detailed records.");
    
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let yPosition = height - 50;
    const leftMargin = 50;
    const rightMargin = 50;
    const bottomMargin = 50;
    const lineHeight = 14;
    const sectionSpacing = 10;
    
    // Helper function to format date
    const formatDate = (dateString: string): string => {
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      } catch (error) {
        return dateString;
      }
    };

    // Helper function to clean notes
    const cleanNotes = (notes: string): string => {
      return notes
        .replace(/\n/g, ' ') // Replace newlines with spaces
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
    };

    // Helper to calculate height of a text block without drawing it
    const calculateBlockHeight = (text: string, fontSize: number, fontToUse: any): number => {
      const maxWidth = width - leftMargin - rightMargin;
      const words = text.split(' ');
      let currentLine = '';
      let lineCount = 0;

      if (!text || text.trim() === '') return 0;

      for (const word of words) {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const textWidth = fontToUse.widthOfTextAtSize(testLine, fontSize);

        if (textWidth > maxWidth && currentLine !== '') {
          lineCount++;
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }

      if (currentLine) {
        lineCount++;
      }

      return lineCount * lineHeight;
    };

    // Helper function to add text with wrapping
    const addTextWithWrapping = (text: string, fontSize: number, fontToUse: any, xPos: number) => {
      const maxWidth = width - (xPos + rightMargin);
      const words = text.split(' ');
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const textWidth = fontToUse.widthOfTextAtSize(testLine, fontSize);

        if (textWidth > maxWidth && currentLine !== '') {
          page.drawText(currentLine, { x: xPos, y: yPosition, size: fontSize, font: fontToUse, color: rgb(0, 0, 0) });
          yPosition -= lineHeight;
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }

      if (currentLine) {
        page.drawText(currentLine, { x: xPos, y: yPosition, size: fontSize, font: fontToUse, color: rgb(0, 0, 0) });
        yPosition -= lineHeight;
      }
    };

    // --- SUMMARY PAGE ---
    addTextWithWrapping("Executive Summary", 18, boldFont, leftMargin);
    yPosition -= sectionSpacing * 2;
    addTextWithWrapping(`CUSTNMBR: ${custNMBR} | ADRSCODE: ${adrsCode}`, 12, font, leftMargin);
    yPosition -= sectionSpacing * 2;
    
    const summaryLines = summaryText.split('\n');
    for(const line of summaryLines) {
        addTextWithWrapping(line, 11, font, leftMargin);
    }

    // --- DETAILED CALL HISTORY ---
    if (sortedRecords.length > 0) {
      page = pdfDoc.addPage([595.28, 841.89]);
      yPosition = height - 50;
      
      addTextWithWrapping("Detailed Service Call History", 18, boldFont, leftMargin);
      yPosition -= sectionSpacing * 2;
      
      for (const record of sortedRecords) {
        const formattedDate = formatDate(record.DATE1);
        const cleanedNotes = cleanNotes(record.Record_Notes);
        
        const dateText = `Date - ${formattedDate}`;
        const serviceCallText = `Service_Call_ID: ${record.Service_Call_ID}`;
        const fileNameText = `(Source: ${record.fileName})`;
        const notesText = `Notes: ${cleanedNotes}`;

        // Calculate the total height of the record block to check for page breaks
        const recordBlockHeight = 
          calculateBlockHeight(dateText, 14, boldFont) +
          calculateBlockHeight(serviceCallText, 11, font) +
          calculateBlockHeight(fileNameText, 9, font) +
          calculateBlockHeight(notesText, 11, font) +
          sectionSpacing;

        // If the entire block doesn't fit, create a new page first
        if (yPosition - recordBlockHeight < bottomMargin) {
          page = pdfDoc.addPage([595.28, 841.89]);
          yPosition = height - 50;
        }
        
        // Draw the record block, which is now guaranteed to fit on the current page
        addTextWithWrapping(dateText, 14, boldFont, leftMargin);
        addTextWithWrapping(serviceCallText, 11, font, leftMargin + 20);
        addTextWithWrapping(fileNameText, 9, font, leftMargin + 20);
        addTextWithWrapping(notesText, 11, font, leftMargin + 20);
        yPosition -= sectionSpacing; // Add spacing after each record
      }
    }
    
    const pdfBytes = await pdfDoc.save();
    const fileKey = `workflows/${workflowId}/${runId}/call-summary.pdf`;

    await uploadFileToS3(fileKey, Buffer.from(pdfBytes), "application/pdf");
    const presignedUrlString = await getPresignedUrl(fileKey);

    logger.info("PDF generated and uploaded successfully");
    logger.info(`Processed ${sortedRecords.length} records`);

    const pdfFile = {
      type: "file" as const,
      file: {
        fileKey,
        mimeType: "application/pdf",
        fileName: "call-summary.pdf",
        url: presignedUrlString,
      },
    };

    return {
      callSummaryPdfFile: pdfFile,
    };
  },
});

// Build the workflow
const callSummaryData = createWorkflow({
  id: "Call Summary Data",
  description: "This workflow processes a CSV file of call records and generates a PDF summary for a specific customer",
  inputSchema: inputSchema,
  outputSchema: finalStepOutputSchema,
  steps: [
    stepOne,
    stepTwo,
    stepThree,
    stepFour,
  ],
})
  .then(stepOne)
  .then(stepTwo)
  .then(stepThree)
  .then(stepFour)
  .commit();

export { callSummaryData };

