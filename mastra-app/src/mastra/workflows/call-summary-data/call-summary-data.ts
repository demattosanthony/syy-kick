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
  id: "streamAndFilterRecords",
  description: "Stream CSV files from local directory, parse, and filter records on-the-fly.",
  inputSchema: inputSchema,
  outputSchema: z.object({
    sortedRecords: z.array(z.custom<CallRecord>()),
    custNMBR: z.string(),
    adrsCode: z.string(),
  }),
  execute: async ({ inputData }) => {
    const custNMBR = (inputData.custNMBR.value as { text: string }).text.trim();
    const adrsCode = (inputData.adrsCode.value as { text: string }).text.trim();

    logger.info(`Starting stream processing from local directory.`);
    logger.info(`Filtering for CUSTNMBR: "${custNMBR}", ADRSCODE: "${adrsCode}"`);

    const localDir = process.cwd();
    const projectRoot = localDir.split("/.mastra")[0];
    const csvDirectory = path.join(projectRoot, "customer-templates", "service-call-summary-dataset");

    if (!fs.existsSync(csvDirectory)) throw new Error(`CSV directory not found: ${csvDirectory}`);

    const files = fs.readdirSync(csvDirectory).filter(file => file.toLowerCase().endsWith('.csv'));
    if (files.length === 0) throw new Error(`No CSV files found in directory: ${csvDirectory}`);

    logger.info(`Found ${files.length} CSV files to process`);
    const allMatchingRecords: CallRecord[] = [];

    for (const file of files) {
      const filePath = path.join(csvDirectory, file);
      const fileName = path.basename(filePath);
      logger.info(`--> Processing file: ${fileName}`);
      const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
      const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
      let isFirstLine = true;
      for await (const line of rl) {
        if (isFirstLine) { isFirstLine = false; continue; }
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
          allMatchingRecords.push({
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
    }

    if (allMatchingRecords.length === 0) throw new Error(`No records found...`);

    const sortedRecords = allMatchingRecords.sort((a, b) => new Date(b.DATE1).getTime() - new Date(a.DATE1).getTime());
    const limitedRecords = sortedRecords.slice(0, 100);
    if (sortedRecords.length > 100) {
      logger.warn(`Limited to 100 most recent records (total found: ${sortedRecords.length})`);
    }

    return { sortedRecords: limitedRecords, custNMBR, adrsCode };
  },
});

const stepTwo = createStep({
  id: "generateSummary",
  description: "Generate a high-level summary of service calls.",
  inputSchema: z.object({
    sortedRecords: z.array(z.custom<CallRecord>()),
    custNMBR: z.string(),
    adrsCode: z.string(),
  }),
  outputSchema: z.object({
    summaryText: z.string(),
    sortedRecords: z.array(z.custom<CallRecord>()),
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
    
    return { summaryText: object.summaryText, sortedRecords, custNMBR, adrsCode };
  },
});

const stepThree = createStep({
  id: "analyzeEquipment",
  description: "Analyze notes to identify and summarize equipment history.",
  inputSchema: z.object({
    summaryText: z.string(),
    sortedRecords: z.array(z.custom<CallRecord>()),
    custNMBR: z.string(),
    adrsCode: z.string(),
  }),
  outputSchema: z.object({
    equipmentAnalysis: z.string(),
    summaryText: z.string(),
    sortedRecords: z.array(z.custom<CallRecord>()),
    custNMBR: z.string(),
    adrsCode: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { sortedRecords, summaryText, custNMBR, adrsCode } = inputData;
    logger.info(`Analyzing equipment from ${sortedRecords.length} records.`);
    
    const prompt = `You are a technical analyst reviewing service call notes. Your task is to identify all unique pieces of equipment and provide a summary for each.
    
    **Instructions:**
    1.  Scan all 'Record_Notes' from the provided JSON data.
    2.  Identify each unique piece of equipment by its Model (M#) or type (e.g., "Daikin RTU", "YORK RTU").
    3.  For each piece of equipment, provide a bulleted list containing:
        - Manufacturer, Model Number (M#), and Serial Number (S#) if available.
        - The total number of service calls related to this specific equipment.
        - A 1-sentence summary of the most recent activity or issue.
    4.  If no specific equipment is mentioned, state "No specific equipment details found in notes."
    5.  Format the output as a single block of plain text. Do not use markdown like '#' or '**'.
    
    Here are the service records:
    ${JSON.stringify(sortedRecords, null, 2)}`;
    
    const { object } = await generateObject({
      model: google("gemini-2.5-pro-preview-06-05"),
      schema: z.object({ equipmentAnalysis: z.string() }),
      prompt,
    });
    
    return { equipmentAnalysis: object.equipmentAnalysis, summaryText, sortedRecords, custNMBR, adrsCode };
  },
});

const stepFour = createStep({
  id: "generatePdfReport",
  description: "Assemble the final PDF report with all sections.",
  inputSchema: z.object({
    summaryText: z.string(),
    equipmentAnalysis: z.string(),
    sortedRecords: z.array(z.custom<CallRecord>()),
    custNMBR: z.string(),
    adrsCode: z.string(),
  }),
  outputSchema: finalStepOutputSchema,
  execute: async ({ inputData, runtimeContext }) => {
    const { summaryText, equipmentAnalysis, sortedRecords, custNMBR, adrsCode } = inputData;
    const workflowId = runtimeContext.get("workflowId");
    const runId = runtimeContext.get("runId");

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

    // --- SUMMARY SECTION ---
    addTextWithWrapping("Executive Summary", 18, boldFont, leftMargin);
    yPosition -= sectionSpacing * 2;
    addTextWithWrapping(`CUSTNMBR: ${custNMBR} | ADRSCODE: ${adrsCode}`, 12, font, leftMargin);
    yPosition -= sectionSpacing * 2;
    
    const summaryLines = summaryText.split('\n');
    for(const line of summaryLines) {
        addTextWithWrapping(line, 11, font, leftMargin);
    }
    
    // --- EQUIPMENT SECTION ---
    yPosition -= sectionSpacing * 3; // Add more space before the next section
    addTextWithWrapping("Known Equipment", 18, boldFont, leftMargin);
    yPosition -= sectionSpacing * 2;
    
    const equipmentAnalysisLines = equipmentAnalysis.split('\n');
    for(const line of equipmentAnalysisLines) {
        // Simple heuristic to identify an equipment name line (e.g., starts with a manufacturer name or doesn't start with a space/hyphen)
        const isEquipmentTitle = line.trim().length > 0 && !line.startsWith(' ') && !line.startsWith('-');
        if (isEquipmentTitle) {
            addTextWithWrapping(line, 12, boldFont, leftMargin); // Bold and slightly larger
        } else {
            addTextWithWrapping(line, 11, font, leftMargin + 10); // Indent details
        }
    }
    
    // --- PREVIOUS CALLS SECTION ---
    if (sortedRecords.length > 0) {
        page = pdfDoc.addPage([595.28, 841.89]);
        yPosition = height - 50;
        addTextWithWrapping("Previous Calls", 18, boldFont, leftMargin);
        yPosition -= sectionSpacing * 2;
        
        for (const record of sortedRecords) {
            const formattedDate = formatDate(record.DATE1);
            const cleanedNotes = cleanNotes(record.Record_Notes);
            
            const dateText = `Date - ${formattedDate}`;
            const serviceCallText = `Service_Call_ID: ${record.Service_Call_ID}`;
            const fileNameText = `(Source: ${record.fileName})`;
            const notesText = `Notes: ${cleanedNotes}`;

            const recordBlockHeight = 
              calculateBlockHeight(dateText, 14, boldFont) +
              calculateBlockHeight(serviceCallText, 11, font) +
              calculateBlockHeight(fileNameText, 9, font) +
              calculateBlockHeight(notesText, 11, font) +
              sectionSpacing;

            if (yPosition - recordBlockHeight < bottomMargin) {
              page = pdfDoc.addPage([595.28, 841.89]);
              yPosition = height - 50;
            }
            
            addTextWithWrapping(dateText, 14, boldFont, leftMargin);
            addTextWithWrapping(serviceCallText, 11, font, leftMargin + 20);
            addTextWithWrapping(fileNameText, 9, font, leftMargin + 20);
            addTextWithWrapping(notesText, 11, font, leftMargin + 20);
            yPosition -= sectionSpacing; 
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
  steps: [stepOne, stepTwo, stepThree, stepFour],
})
  .then(stepOne)
  .then(stepTwo)
  .then(stepThree)
  .then(stepFour)
  .commit();

export { callSummaryData };

