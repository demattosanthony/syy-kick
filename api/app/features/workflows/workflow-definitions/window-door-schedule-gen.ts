import { Agent, Workflow } from "../workflows.types";

// PDF extraction agent to find pages with window and door schedules
const pageExtractionAgent: Agent = {
  id: "page-extraction-agent",
  name: "Page Extraction Agent",
  description: "Extracts pages from a PDF file and converts them to images.",
  instructions: `You are an AI assistant specialized in analyzing architectural drawings. Your task is to examine a set of architectural drawings provided in a PDF format, identify the specific pages that contains the embedded window and door schedules tables, and extract the pages as images.
          
Instructions:
1. Use the "list-artifacts" tool to get the file name of the PDF file.
2. Use the "load-artifact" tool to load the PDF file into your context.
3. Carefully examine each page of the provided PDF.
4. Look for pages that contains window and door schedules. These schedules typically list details about windows and doors used in the building, such as sizes, types, and quantities.
5. When you find the page with the schedules, note the PDF page number. This should be the actual page number in the PDF file, not the sheet number that might be printed on the drawing itself.
6. If you cannot find a page with window and door schedules, indicate that the schedules were not found and return an empty array for pageNumbers.
7. Use the "pdf-page-extraction" tool to extract the pages as images.

I've placed the pdf file in the artifact service. Use the list artifacts tool to get the file name and then use the load artifact tool to load the file into your context.`,
  model: "gemini-2.5-flash-preview",
  activeTools: ["pdf-page-extraction", "load-artifact", "list-artifacts"],
};

// Table extraction agent to locate the window and door schedule tables in the images and save them as image artifacts
const tableExtractionAgent: Agent = {
  id: "table-extraction-agent",
  name: "Table Extraction Agent",
  description: "Extracts tables from images.",
  instructions: `You are a table extraction agent. Your task is to locate the window and door schedule tables in the images and save them as image artifacts.

Steps:
1. Use the "list-artifacts" tool to get the file names of the image artifacts.
2. Use the "object-detection" tool to locate the window and door schedule tables in each of the images. This will save the bounding boxes as image artifacts.

The label you want to detect is "Window or Door Schedule table".`,
  model: "gemini-2.5-flash-preview",
  activeTools: ["object-detection", "load-artifact", "list-artifacts"],
};

// CSV generation agent to analyze cropped images of window and door schedule tables and extract the data from them
const csvGenerationAgent: Agent = {
  id: "csv-generation-agent",
  name: "CSV Generation Agent",
  description: "Generates a CSV file from the window and door schedule tables.",
  instructions: `You are a CSV generation agent. Your task is to too analyze cropped images of window and door schedule tables and extract the data from them. You are able to see images so once you load the image artifacts you will able to analyze them and create an accurate CSV file.

Steps:
1. Use the "list-artifacts" tool to get the file names of the image artifacts.
2. Use the "load-artifact" tool to load the image artifact into your context. (Only load the image artifacts that contain the window and door schedule tables.)
3. Use the "create-artifact" tool to create a CSV file.

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

Do not make up any information. Only include information that is present in the cropped images. If you are unsure about a measurement or detail, indicate it as "unknown" in the output. Do not attempt to fill in gaps with assumptions or estimates.`,
  model: "gemini-2.5-pro-preview",
  activeTools: ["create-artifact", "load-artifact", "list-artifacts"],
};

export const windowDoorScheduleGenWorkflow: Workflow = {
  id: "window-door-schedule-gen",
  name: "Window & Door Schedule Generator",
  description:
    "This workflow generates a window and door schedule based on architectural drawings.",
  inputs: [
    {
      id: "architectural-drawings",
      type: "file",
      title: "Architectural Drawings",
      description: "Upload the document you want to analyze",
      required: true,
      acceptedFileTypes: ["application/pdf"],
    },
  ],
  agents: [pageExtractionAgent, tableExtractionAgent, csvGenerationAgent],
};
