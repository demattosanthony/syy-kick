import { Workflow } from "../workflows.schemas";
import { z } from "zod";

export const windowDoorScheduleGenWorkflow: Workflow = {
  id: "window-door-schedule-gen",
  title: "Window & Door Schedule Generator",
  description:
    "This workflow generates a window and door schedule based on architectural drawings.",
  authorizedOrganizationIds: [
    "a58c6da2-4320-4aeb-8fc9-97fcfcae26d7",
    "a5b8c99d-9e1d-42a9-8473-b52471932d51",
    "cb9e9135-3f61-4b0b-a21f-1ecde3fcaf02",
  ],
  inputs: [
    {
      id: "architectural-drawings",
      type: "file",
      title: "Architectural Drawings",
      description: "Upload the document you want to analyze",
      acceptedFileTypes: "application/pdf",
      required: true,
    },
  ],
  output: {
    type: "text/csv",
    title: "Window & Door Schedule",
    description: "View the generated window and door schedule",
    outputKey: "csvArtifact",
  },
  steps: [
    {
      id: "doc-ocr",
      processingMessage: "Performing Optical Character Recognition (OCR)...",
      processedMessage:
        "Optical Character Recognition (OCR) completed successfully.",
      type: "document_ocr",
      config: {
        documentDataSource: "workflowInput.architectural-drawings",
        outputSchema: z.object({
          markdown: z.string(),
          images: z.array(
            z.object({
              url: z.string(),
              fileName: z.string(),
              mimeType: z.string(),
            })
          ),
        }),
      },
    },
    {
      id: "ai-evaluation",
      processingMessage: "Generating window and door schedules...",
      processedMessage: "Window and door schedules generated successfully.",
      type: "llm",
      inputMapping: {
        images: "doc-ocr.images",
      },
      config: {
        modelName: "gemini-2.5-pro-exp",
        outputSchema: z.object({
          csvArtifact: z.string(),
        }),
        promptTemplate: `You are an expert architectural document analysis system, specialized in extracting and processing window and door specifications from architectural drawings. Your objective is to generate standardized window and door schedules in CSV format.

Analysis Protocol:

1. SCHEDULE IDENTIFICATION
First, analyze the document for existing window and door schedules:
- Search for tables or sections explicitly labeled as "Window Schedule", "Door Schedule", or similar variants
- If found, proceed to Protocol A
- If not found, proceed to Protocol B

Protocol A - Existing Schedule Processing:
1. Extract all entries from the identified schedules
2. Validate and standardize measurements:
   - Convert all dimensions to feet and inches format (e.g., 7'0")
   - Verify each entry has both height and width
   - Calculate area in square feet (height × width)
   - Round areas to two decimal places
3. Format according to the required CSV structure

Protocol B - Floor Plan Analysis:
1. Analyze architectural floor plan images for:
   - Window symbols and annotations
   - Door symbols and annotations
   - Dimensional notations and scale indicators
2. For each identified element:
   - Extract or calculate dimensions using scale references
   - Convert measurements to feet and inches
   - Generate unique identifiers (e.g., "Window-A", "Door-1")
   - Calculate areas using extracted dimensions
3. Format according to the required CSV structure

Data Processing Requirements:
- All measurements must be in feet and inches format (e.g., 7'0")
- Areas must be in square feet, rounded to two decimal places
- Each item requires: unique identifier, height, width, and calculated area

Document your analysis process within <analysis_log> tags, including:
- Protocol selected (A or B) with justification
- Data extraction methodology
- Any assumptions or estimations made
- Conversion calculations performed
- Quality control checks applied

Output Format:
Generate a CSV artifact with the following structure:

WINDOW SCHEDULE
Item,Height,Width,Area (sq ft)
[window entries...]

DOOR SCHEDULE
Item,Height,Width,Area (sq ft)
[door entries...]

Quality Control:
- Verify all measurements are properly formatted (X'Y")
- Confirm area calculations are accurate and rounded
- Ensure unique identifiers are consistent and logical
- Validate that no required data fields are missing

Return only the final CSV artifact in the specified format, without any additional commentary or markup.`,
      },
    },
  ],
};
