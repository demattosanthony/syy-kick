import { WorkflowStep, Workflow } from "../workflows.types";

// PDF extraction agent to find pages with window and door schedules
const pageExtractionAgent: WorkflowStep = {
  id: "page-extraction-agent",
  name: "Page Extraction Agent",
  description: "Extracts pages from a PDF file and converts them to images.",
  instructions: `You goal is to analyze a architectural drawings PDF file and identify which pages contain window and door schedules, then convert those pages to images.
  
1. Analyze the provided architectural drawings PDF file.
2. Look for pages that contains window and door schedules. These schedules typically list details about windows and doors used in the building, such as sizes, types, and quantities.
3. When you find the page with the schedules, note the PDF page number. This should be the actual page number in the PDF file, not the sheet number that might be printed on the drawing itself.
4. If you cannot find a page with window and door schedules, indicate that there are no pages with window and door schedules. and stop.
5. If you find pages with window and door schedules, use the "pdf-page-extraction" tool to extract the pages as images.`,
  model: "gemini-2.5-flash-preview",
  activeTools: ["pdf-page-extraction"],
  formSchema: {
    fields: {
      "architectural-drawings": {
        type: "file",
        label: "Architectural Drawings",
        required: true,
        acceptedFileTypes: ["application/pdf"],
      },
    },
  },
};
// Table extraction agent to locate the window and door schedule tables in the images and save them as image artifacts
const tableExtractionAgent: WorkflowStep = {
  id: "table-extraction-agent",
  name: "Table Extraction Agent",
  description: "Extracts tables from images.",
  instructions: `Your task is to locate the window and door schedule tables in the images and save them as image artifacts.

Steps:
1. Use the screenshots taken from the PDF to locate the window and door schedule tables.
2. Use the "object-detection" tool to locate the window and door schedule tables in each of the images. This will save the bounding boxes as image artifacts.

The label you want to detect is "Window or Door Schedule table".`,
  model: "gemini-2.5-flash-preview",
  activeTools: ["object-detection"],
};

// CSV generation agent to analyze cropped images of window and door schedule tables and extract the data from them
const csvGenerationAgent: WorkflowStep = {
  id: "csv-generation-agent",
  name: "CSV Generation Agent",
  description: "Generates a CSV file from the window and door schedule tables.",
  instructions: `Your task is to too analyze cropped images of window and door schedule tables and extract the data from them.

Steps:
1. Analyze the cropped images of the window and door schedule tables.
2. Extract the data from the tables and save it as a CSV file.

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

Return only the final CSV in the specified format, without any additional commentary or markup.

Do not make up any information. Only include information that is present in the cropped images. If you are unsure about a measurement or detail, indicate it as "unknown" in the output. Do not attempt to fill in gaps with assumptions or estimates.`,
  model: "gpt-4.1",
  activeTools: [],
};

export const windowDoorScheduleGenWorkflow: Workflow = {
  id: "window-door-schedule-gen",
  name: "Window & Door Schedule Generator",
  description:
    "This workflow generates a window and door schedule based on architectural drawings.",
  workflowSteps: [
    pageExtractionAgent,
    tableExtractionAgent,
    csvGenerationAgent,
  ],
  authorizedOrganizationIds: [
    "a58c6da2-4320-4aeb-8fc9-97fcfcae26d7",
    "a5b8c99d-9e1d-42a9-8473-b52471932d51",
    "cb9e9135-3f61-4b0b-a21f-1ecde3fcaf02",
    "99b93b8d-0360-47af-bd74-0fd099f07c4e",
  ],
};
