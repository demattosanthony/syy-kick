import { Agent, Workflow } from "../workflows.types";

const pageExtractionAgent: Agent = {
  id: "page-extraction-agent",
  name: "Page Extraction Agent",
  description: "Extracts pages from a PDF file and converts them to images.",
  instructions: `1. Analyze the provided mechanical drawings PDF file.
2. Look for pages that contains mechanical schedules. These schedules typically list details about mechanical equipment used in the building, such as sizes, types, and quantities.
3. When you find the page with the schedules, note the PDF page number. This should be the actual page number in the PDF file, not the sheet number that might be printed on the drawing itself.
4. If you cannot find a page with mechanical schedules, indicate that there are no pages with mechanical schedules and stop.
5. If you find pages with mechanical schedules, use the "pdf-page-extraction" tool to extract the pages as images.`,
  model: "gemini-2.5-flash-preview",
  activeTools: ["pdf-page-extraction", "load-artifact"],
};

const tableExtractionAgent: Agent = {
  id: "table-extraction-agent",
  name: "Table Extraction Agent",
  description: "Extracts tables from images.",
  instructions: `Your task is to locate the mechanical schedule tables in the images and save them as image artifacts.

Steps:
1. Use the screenshots taken from the PDF to locate the mechanical schedule tables.
2. Use the "object-detection" tool to locate the mechanical schedule tables in each of the images. This will save the bounding boxes as image artifacts.

The label you want to detect is "Mechanical Schedule table".`,
  model: "gemini-2.5-flash-preview",
  activeTools: ["object-detection", "load-artifact"],
};

const csvGenerationAgent: Agent = {
  id: "csv-generation-agent",
  name: "CSV Generation Agent",
  description: "Generates a CSV file from the mechanical schedule tables.",
  instructions: `Your task is to analyze the mechanical schedule tables in the images and extract the data from them.

Steps:
1. Analyze the mechanical schedule tables in the images.
2. Extract the data from the tables and save it as a CSV file.

Output Format:
Generate a CSV artifact with proper escaping using the following structure:

Example of correct CSV formatting:
"Equipment ID","Location,Service Area(s)"
"AHU-1","Mechanical Room 101","1st Floor Offices","2nd Floor Laboratories"
"DOAS-1","Roof","3rd Floor [NEEDS CONFIRMATION]"

`,
  model: "gpt-4.1",
  activeTools: ["create-artifact", "load-artifact"],
};

export const equipmentServingListWorkflow: Workflow = {
  id: "equipment-serving-list",
  name: "Equipment Serving List Generator",
  description:
    "This workflow generates a equipment serving list based on mechanical drawings.",
  inputs: [
    {
      id: "mechanical-drawings",
      type: "file",
      title: "Mechanical Drawings",
      description: "Upload the document you want to analyze",
      required: true,
      acceptedFileTypes: ["application/pdf"],
    },
  ],
  agents: [pageExtractionAgent, tableExtractionAgent, csvGenerationAgent],
  authorizedOrganizationIds: [
    "a58c6da2-4320-4aeb-8fc9-97fcfcae26d7",
    "a5b8c99d-9e1d-42a9-8473-b52471932d51",
    "cb9e9135-3f61-4b0b-a21f-1ecde3fcaf02",
    "282c0c89-85d7-4b94-bd31-6e87b0637cc1",
    "99b93b8d-0360-47af-bd74-0fd099f07c4e",
  ],
};
