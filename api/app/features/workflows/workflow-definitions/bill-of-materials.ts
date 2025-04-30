import { WorkflowStep, Workflow } from "../workflows.types";

const pageExtractionAgent: WorkflowStep = {
  id: "page-extraction-agent",
  name: "Page Extraction Agent",
  description: "Extracts pages from a PDF file and converts them to images.",
  instructions: `You task is to analyze a controls drawings PDF file and identify which pages contain Bill of Materials tables, then convert those pages to images.
  
1. Analyze the controls drawings PDF file.
2. Look for pages that contains embedded Bill of Materials tables. These tables typically list details about components used in the control system, such as sizes, types, and quantities. The table header should also be Bill of Materials.
3. When you find the pages with the BOM tables, note the PDF page number. This should be the actual page number in the PDF file, not the sheet number that might be printed on the drawing itself.
4. If you cannot find a page with Bill of Materials tables, indicate that there are no pages with Bill of Materials tables and stop.
5. If you find pages with bill of materials tables, use the "pdf-page-extraction" tool to convert the pages to images.`,
  model: "gemini-2.5-pro-preview",
  activeTools: ["pdf-page-extraction"],
  formSchema: {
    fields: {
      "controls-drawings": {
        type: "file",
        label: "Controls Drawings",
        required: true,
        acceptedFileTypes: ["application/pdf"],
      },
    },
  },
};

const tableExtractionAgent: WorkflowStep = {
  id: "table-extraction-agent",
  name: "Table Extraction Agent",
  description: "Extracts tables from images.",
  instructions: `Your task is to locate the Bill of Materials tables in the images and save them as image artifacts.

Steps:
1. Use the screenshots taken from the PDF to locate the Bill of Materials tables.
2. Use the "object-detection" tool to locate the Bill of Materials tables in each of the images. This will save the bounding boxes as image artifacts.

The label you want to detect is "Bill of Materials table".`,
  model: "gemini-2.5-flash-preview",
  activeTools: ["object-detection"],
};

const tableToTextAgent: WorkflowStep = {
  id: "table-to-text-agent",
  name: "Table to Text Agent",
  description: "Converts images to text.",
  instructions: `Your task is to convert screenshots of bill of materials tables into plain text files. Go through each image individually and convert the table to text.
  
Steps: 
1. Open an image
2. Analyze the image to properly extract the table.
3. Create a text file that represents it. Use markdown formatting to make it easy to read.
4. Save the text file

Make sure you process all of the images. Don't load any files that don't exist. Once you have processed all of the images you can stop.`,
  model: "gemini-2.5-flash-preview",
  activeTools: [],
};

const csvGenerationAgent: WorkflowStep = {
  id: "csv-generation-agent",
  name: "CSV Generation Agent",
  description: "Generates a CSV file from the Bill of Materials tables.",
  instructions: `Your goal is to create a totalzed BOM CSV file that consolidates all bill of materials tables from a controls pdf into a single table.

Steps:
1. Read all the text files that are available.
2. Extract all part numbers and their quantities from each BOM table.
3. Group the part numbers by their make (manufacturer).
4. Aggregate the quantities for any duplicate parts across all tables.
5. Create a final table with two columns: Part Number and Total Quantity.

CSV Formatting:

| Part Number | Total Quantity |
|-------------|----------------|
| [MAKE 1] |                |
| [Part No. 1] | [Quantity]     |
| [Part No. 2] | [Quantity]     |
| [MAKE 2] |                |
| [Part No. 3] | [Quantity]     |
| ...         | ...            |

Ensure that your final consolidated BOM:
- Includes all unique part numbers from all BOM tables
- Groups part numbers by their make
- Shows the total quantity for each part number
- Is presented in a clear, easily readable format

CSV Formatting Rules:
1. Every field must be enclosed in double quotes: "field"
2. For measurements containing inches ("), add an additional " before the inches: "8'-0"""
3. Separate fields with single commas (no spaces): "field1","field2"
4. Each schedule should start with its title on a separate line
5. Headers should be quoted: "Item","Height","Width","Area (sq ft)"
6. Use all caps for the make names

Remember to use your expertise to provide the most accurate and comprehensive consolidated BOM possible based on the given information.`,
  model: "gpt-4.1",
  activeTools: [],
};

export const billOfMaterialsWorkflow: Workflow = {
  id: "bill-of-materials",
  name: "Bill of Materials Generator",
  description:
    "This workflow generates a Bill of Materials based on control system drawings.",
  workflowSteps: [
    pageExtractionAgent,
    tableExtractionAgent,
    tableToTextAgent,
    csvGenerationAgent,
  ],
  authorizedOrganizationIds: [
    "a58c6da2-4320-4aeb-8fc9-97fcfcae26d7",
    "a5b8c99d-9e1d-42a9-8473-b52471932d51",
    "cb9e9135-3f61-4b0b-a21f-1ecde3fcaf02",
    "282c0c89-85d7-4b94-bd31-6e87b0637cc1",
    "99b93b8d-0360-47af-bd74-0fd099f07c4e",
  ],
};
