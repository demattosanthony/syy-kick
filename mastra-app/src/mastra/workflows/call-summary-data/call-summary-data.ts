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
import fs from "fs";
import path from "path";

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
  id: "streamFilterAndSort",
  description: "Stream CSV files, filter, sort, and generate summary in a single pass to minimize memory usage.",
  inputSchema: inputSchema,
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
    const custNMBR = (inputData.custNMBR.value as { text: string }).text.trim();
    const adrsCode = (inputData.adrsCode.value as { text: string }).text.trim();

    logger.info(`Starting optimized stream processing from local directory.`);
    logger.info(`Filtering for CUSTNMBR: "${custNMBR}", ADRSCODE: "${adrsCode}"`);

    // Get the local directory path
    const localDir = process.cwd();
    const projectRoot = localDir.split("/.mastra")[0];
    const csvDirectory = path.join(projectRoot, "customer-templates", "service-call-summary-dataset");

    logger.info(`Reading CSV files from: ${csvDirectory}`);

    // Check if directory exists
    if (!fs.existsSync(csvDirectory)) {
      throw new Error(`CSV directory not found: ${csvDirectory}`);
    }

    // Get all CSV files in the directory
    const files = fs.readdirSync(csvDirectory)
      .filter(file => file.toLowerCase().endsWith('.csv'))
      .map(file => path.join(csvDirectory, file));

    if (files.length === 0) {
      throw new Error(`No CSV files found in directory: ${csvDirectory}`);
    }

    logger.info(`Found ${files.length} CSV files to process`);

    // Process files sequentially to avoid memory buildup
    const allMatchingRecords: CallRecord[] = [];
    
    for (const filePath of files) {
      const fileName = path.basename(filePath);
      logger.info(`--> Processing file: ${fileName}`);
      
      try {
        // Create read stream for the file
        const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
        
        const rl = readline.createInterface({
          input: fileStream,
          crlfDelay: Infinity,
        });

        let isFirstLine = true;
        const fileRecords: CallRecord[] = [];
        
        for await (const line of rl) {
          if (isFirstLine) {
            isFirstLine = false;
            continue; // Skip header
          }

          const values = line.split(',');
          if (values.length < 6) continue;

          const recordCustNmbr = values[2].trim();
          const recordAdrsCode = values[3].trim();

          if (recordCustNmbr === custNMBR && recordAdrsCode === adrsCode) {
            const noteParts = values.slice(5);
            let recordNotes = noteParts.join(',').trim();
            if (recordNotes.startsWith('"') && recordNotes.endsWith('"')) {
              recordNotes = recordNotes.substring(1, recordNotes.length - 1);
            }
            
            fileRecords.push({
              DATE1: values[0].trim(),
              CUSTNAME: values[1].trim(),
              CUSTNMBR: recordCustNmbr,
              ADRSCODE: recordAdrsCode,
              Service_Call_ID: values[4].trim(),
              Record_Notes: recordNotes,
              fileName: fileName,
            });
          }
        }
        
        // Add records from this file to the main array
        allMatchingRecords.push(...fileRecords);
        logger.info(`   ...finished streaming ${fileName}, found ${fileRecords.length} matching records.`);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
      } catch (error) {
        logger.error(`Error processing file ${fileName}:`, error);
        // Continue with other files
      }
    }

    logger.info(`Found a total of ${allMatchingRecords.length} matching records across all files.`);
    
    if (allMatchingRecords.length === 0) {
      throw new Error(`No records found for CUSTNMBR: ${custNMBR} and ADRSCODE: ${adrsCode}`);
    }

    // Sort records by date (most recent first)
    logger.info(`Sorting ${allMatchingRecords.length} records by date`);
    const sortedRecords = allMatchingRecords.sort((a, b) => {
      const dateA = new Date(a.DATE1);
      const dateB = new Date(b.DATE1);
      return dateB.getTime() - dateA.getTime();
    });

    // Limit to most recent 100 records to prevent memory issues
    const limitedRecords = sortedRecords.slice(0, 100);
    if (sortedRecords.length > 100) {
      logger.warn(`Limited to 100 most recent records (total found: ${sortedRecords.length})`);
    }

    // Generate summary using LLM
    logger.info(`Generating LLM summary for ${limitedRecords.length} records.`);

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
${JSON.stringify(limitedRecords, null, 2)}`;

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
      sortedRecords: limitedRecords,
      custNMBR,
      adrsCode,
    };
  },
});

const stepTwo = createStep({
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
  description: "This workflow processes CSV files from local directory and generates a PDF summary for a specific customer",
  inputSchema: inputSchema,
  outputSchema: finalStepOutputSchema,
  steps: [
    stepOne,
    stepTwo,
  ],
})
  .then(stepOne)
  .then(stepTwo)
  .commit();

export { callSummaryData };

