import { Attachment, generateObject } from "ai";
import {
  FileData,
  LLMStepConfig,
  PdfPageExtractStepConfig,
  StepExecutorFunction,
  StepExecutorInput,
  StepOutputData,
} from "./workflows.schemas";
import { MODELS } from "../models";
import { PDFDocument } from "pdf-lib";
import { getPdfPageAsImage } from "../../utils";

export const executeLLMStep: StepExecutorFunction = async ({
  step,
  state,
  inputs,
  workflow,
}: StepExecutorInput): Promise<StepOutputData> => {
  const stepConfig = step.config as LLMStepConfig["config"];
  const modelName = stepConfig.modelName || "claude-3.5-sonnet";

  // Populate the prompt template and get all the attachments
  let populatedPrompt = stepConfig.promptTemplate;
  let files: FileData[] = [];

  for (const key in inputs) {
    const placeholder = `{input.${key}}`;
    const value = inputs[key];

    // Handle file data
    if (value && value.url && typeof value === "object") {
      files.push(value);
    } else {
      // Replace all placeholders with the actual values
      populatedPrompt = populatedPrompt.replace(placeholder, String(value));
    }
  }

  const attachments: Attachment[] = files?.map((file) => ({
    url: file.url,
    contentType: file.mimeType,
    name: file.fileName,
  }));

  console.log(`[${step.id}] Starting LLM step execution`);
  console.log(`[${step.id}] Prompt:`, populatedPrompt);
  console.log(`[${step.id}] Attachments Length:`, attachments.length);

  try {
    const { object } = await generateObject({
      model: MODELS[modelName].model,
      schema: stepConfig.outputSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: populatedPrompt,
            },
            ...(attachments.map((attachment) => ({
              type: "file",
              data: attachment.url,
              mimeType: attachment.contentType,
            })) as any),
          ],
        },
      ],
    });

    const validatedOutput = stepConfig.outputSchema.safeParse(object);

    console.log(`[${step.id}] LLM step completed successfully`);
    return validatedOutput.data as StepOutputData;
  } catch (error) {
    console.error(`[${step.id}] Error during LLM step execution:`, error);
    throw error; // Re-throw the error after logging
  }
};

export const executePdfPageExtractionStep: StepExecutorFunction = async ({
  step,
  state,
  inputs,
  workflow,
  utils,
}: StepExecutorInput): Promise<StepOutputData> => {
  const stepConfig = step.config as PdfPageExtractStepConfig["config"];
  console.log(`[${step.id}] Starting PDF Page Extraction step execution`);

  // 1. Resolve PDF FileData and Page Number from state
  const pageNumber = utils.getDataSourceValue(
    state,
    stepConfig.pageNumberSource
  ) as number | undefined;
  const pdfFileInfo = utils.getDataSourceValue(
    state,
    stepConfig.pdfDataSource
  ) as FileData | undefined;

  // 2. Validate inputs
  if (
    !pdfFileInfo ||
    typeof pdfFileInfo !== "object" ||
    !pdfFileInfo.url ||
    !pdfFileInfo.fileName
  ) {
    throw new Error(
      `Could not resolve valid PDF FileData (with url) at source '${stepConfig.pdfDataSource}' for step ${step.id}.`
    );
  }
  if (
    typeof pageNumber !== "number" ||
    !Number.isInteger(pageNumber) ||
    pageNumber <= 0
  ) {
    throw new Error(
      `Invalid or missing page number at source '${stepConfig.pageNumberSource}' for step ${step.id}. Received: ${pageNumber}`
    );
  }

  // Load the original PDF
  const pdfDoc = await PDFDocument.load(pdfFileInfo.url);

  // Create a new pdf doc
  const newPdfDoc = await PDFDocument.create();

  // Copy the specific page
  const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [pageNumber - 1]); // PDF pages are 0-indexed
  newPdfDoc.addPage(copiedPage);

  // Save the new PDF
  const newPdfBytes = await newPdfDoc.save();

  // Use the full extracted PDF page for the image conversion
  const pageImage = await getPdfPageAsImage(newPdfBytes, 1, {
    format: "png",
    dpi: 150, // Higher DPI for better quality
    maxDimension: 8000,
  });

  // Write the image to a file
  const imageFilePath = `./pdf-page-extraction-results/page_${pageNumber}.png`;
  await Bun.write(imageFilePath, Buffer.from(pageImage, "base64"));

  return {
    imageBase64: pageImage,
    pageNumber,
  };
};

export const stepExecutorRegistry = new Map<string, StepExecutorFunction>();
stepExecutorRegistry.set("llm", executeLLMStep);
stepExecutorRegistry.set("pdf_page_extract", executePdfPageExtractionStep);
