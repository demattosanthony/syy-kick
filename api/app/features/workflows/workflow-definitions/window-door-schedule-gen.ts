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
    "99b93b8d-0360-47af-bd74-0fd099f07c4e"
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
      id: "find-schedules-page",
      type: "llm",
      processingMessage: "Finding the page with window and door schedules...",
      processedMessage: "Window and door schedules page found.",
      inputMapping: {
        file: "workflowInput.architectural-drawings",
      },
      config: {
        modelName: "gemini-2.5-pro-preview",
        promptTemplate: `You are an AI assistant specialized in analyzing architectural drawings. Your task is to examine a set of architectural drawings provided in a PDF format and identify the specific page that contains the window and door schedules.
          
Instructions:
1. Carefully examine each page of the provided PDF.
2. Look for a page that contains window and door schedules. These schedules typically list details about windows and doors used in the building, such as sizes, types, and quantities.
3. When you find the page with the schedules, note the PDF page number. This should be the actual page number in the PDF file, not the sheet number that might be printed on the drawing itself.
4. If you cannot find a page with window and door schedules, indicate that the schedules were not found.`,
        outputSchema: z.object({
          pageNumber: z.number(),
        }),
      },
    },
    {
      id: "extract-pdf-page",
      type: "pdf_page_extract",
      processingMessage: "Extracting the page with mechanical schedules...",
      processedMessage: "Mechanical schedules page extracted.",
      config: {
        pdfDataSource: "workflowInput.architectural-drawings",
        pageNumberSource: "find-schedules-page.pageNumber",
      },
    },
    {
      id: "schedule-data-object-detection",
      type: "object_detection",
      processingMessage: "Detecting schedule tables in the extracted page...",
      processedMessage: "Schedule tables detected successfully.",
      config: {
        imageDataSource: "extract-pdf-page.imageBase64",
        model: "gemini-2.5-pro-preview",
        promptTemplate: `Your task is to located all window and door schedule tables and place 2d bounding boxes around them. Each schedule table bounding box should contain the table title and all the rows of the table.
Output the bounding boxes in the [y_min, x_min, y_max, x_max] format.
The top left corner is (0,0). The x axis goes left→right, the y axis top→bottom.
Coordinate values must be normalized to 0–1000 for both width and height.
Each entry should contain { "box_2d": [y_min, x_min, y_max, x_max], "label": "..." }.`,
        outputSchema: z.object({
          screenshots: z.array(
            z.object({
              url: z.string(),
              mimeType: z.string(),
              fileName: z.string(),
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
        images: "schedule-data-object-detection.screenshots",
      },
      config: {
        modelName: "gemini-2.5-pro-preview",
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

Document your analysis process within <analysis_log> tags inside of your thinking block, including:
- Protocol selected (A or B) with justification
- Data extraction methodology
- Any assumptions or estimations made
- Conversion calculations performed
- Quality control checks applied

Output Format:
Generate a CSV artifact with proper escaping using the following structure:

Example of correct CSV formatting:
"WINDOW SCHEDULE"
"Item","Height","Width","Area (sq ft)"
"A","8'-0""","2'-4""","18.67"
"B","4'-8""","2'-8""","12.44"

"DOOR SCHEDULE"
"Item","Height","Width","Area (sq ft)"
"01A","8'-0""","3'-0""","24.00"
"01B","8'-0""","3'-0""","24.00"

CSV Formatting Rules:
1. Every field must be enclosed in double quotes: "field"
2. For measurements containing inches ("), add an additional " before the inches: "8'-0"""
3. Separate fields with single commas (no spaces): "field1","field2"
4. Each schedule should start with its title on a separate line
5. Headers should be quoted: "Item","Height","Width","Area (sq ft)"

Example of a single properly formatted line:
"A","8'-0""","2'-4""","18.67"

Quality Control:
- Verify all measurements are properly formatted (X'-Y""")
- Confirm area calculations are accurate and rounded
- Ensure unique identifiers are consistent and logical
- Validate that no required data fields are missing
- Check that all fields are properly quoted and escaped

Return only the final CSV artifact in the specified format, without any additional commentary or markup.

Do not make up any information. Only include information that is present in the drawings. If you are unsure about a measurement or detail, indicate it as "unknown" in the output. Do not attempt to fill in gaps with assumptions or estimates.`,
      },
    },
  ],
};
