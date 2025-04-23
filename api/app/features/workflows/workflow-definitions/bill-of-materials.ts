import { Workflow } from "../workflows.schemas";
import { z } from "zod";

export const billOfMaterialsWorkflow: Workflow = {
  id: "controls-bom",
  title: "Project BOM Builder",
  description:
    "This workflow consolidates all the Bill of Materials tables from the provided controls drawings into a single, comprehensive BOM spreadsheet.",
  authorizedOrganizationIds: [
    "a58c6da2-4320-4aeb-8fc9-97fcfcae26d7",
    "a5b8c99d-9e1d-42a9-8473-b52471932d51",
    "cb9e9135-3f61-4b0b-a21f-1ecde3fcaf02",
    "282c0c89-85d7-4b94-bd31-6e87b0637cc1",
    "99b93b8d-0360-47af-bd74-0fd099f07c4e",
  ],
  inputs: [
    {
      id: "controls-drawings",
      type: "file",
      title: "Controls Drawings PDF",
      description: "Containing controls drawings",
      acceptedFileTypes: "application/pdf",
      required: true,
    },
  ],
  output: {
    type: "text/csv",
    title: "Project BOM",
    description: "View the generated Bill of Materials",
    outputKey: "bom",
  },
  steps: [
    {
      id: "find-bom-pages",
      type: "llm",
      processingMessage: "Finding the pages with BOM tables...",
      processedMessage: "BOM pages found.",
      inputMapping: {
        file: "workflowInput.controls-drawings",
      },
      config: {
        modelName: "gemini-2.5-pro-preview",
        promptTemplate: `You are an AI assistant specialized in analyzing control system drawings. Your task is to examine a set of control system drawings provided in a PDF format and identify the specific pages that contains the embedded Bill of Materials tables.
          
Instructions:
1. Carefully examine each page of the provided PDF.
2. Look for pages that contains Bill of Materials. These schedules typically list details about components used in the control system, such as sizes, types, and quantities.
3. When you find the page with the BOM, note the PDF page number. This should be the actual page number in the PDF file, not the sheet number that might be printed on the drawing itself.
4. If you cannot find a page with Bill of Materials, indicate that the BOM was not found and return an empty array for pageNumbers.`,
        outputSchema: z.object({
          pageNumbers: z.array(z.number()),
        }),
      },
    },
    {
      id: "extract-pdf-page",
      type: "pdf_page_extract",
      processingMessage: "Extracting the pages with BOM tables...",
      processedMessage: "BOM pages extracted.",
      config: {
        pdfDataSource: "workflowInput.controls-drawings",
        pageNumbersSource: "find-bom-pages.pageNumbers",
      },
    },
    {
      id: "bom-data-object-detection",
      type: "object_detection",
      processingMessage: "Detecting BOM tables in the extracted pages...",
      processedMessage: "BOM tables detected successfully.",
      config: {
        imageDataSource: "extract-pdf-page.extractedImagesBase64",
        model: "gemini-2.5-pro-preview",
        promptTemplate: `Your task is to located all Bill of Materials tables and place 2d bounding boxes around them. Each BOM table bounding box should contain the table title and all the rows of the table.
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
      id: "controls-bom",
      processingMessage: "Generating Bill of Materials...",
      processedMessage: "Bill of Materials generated successfully.",
      type: "llm",
      inputMapping: {
        images: "bom-data-object-detection.screenshots",
      },
      config: {
        modelName: "gemini-2.5-pro-preview",
        outputSchema: z.object({
          bom: z.string(),
        }),
        promptTemplate: `You are an expert engineer tasked with consolidating multiple Bill of Materials (BOM) tables into a single, comprehensive BOM spreadsheet. You will be provided with several screenshots of BOM tables, and your goal is to create a unified table that summarizes all the parts and their total quantities.

Your task is to create a consolidated BOM with the following specifications:

1. Extract all part numbers and their quantities from each BOM table.
2. Group the part numbers by their make (manufacturer).
3. Aggregate the quantities for any duplicate parts across all tables.
4. Create a final table with two columns: Part Number and Total Quantity.

Before presenting the final consolidated BOM, wrap your thought process in <bom_consolidation_process> tags inside your thinking block. This should include:

- A brief description of each BOM table you're analyzing
- The part numbers and quantities you extract from each table
- A list of all unique part numbers across all tables
- How you're grouping the part numbers by make
- A temporary table for each make, listing part numbers and quantities
- Your process for aggregating quantities for duplicate parts, showing your work
- Any challenges you encounter and how you resolve them

After your analysis, present the final consolidated BOM in the following format:

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

Remember to use your expertise to provide the most accurate and comprehensive consolidated BOM possible based on the given information. Your final output should consist only of the consolidated BOM table and should not duplicate or rehash any of the work you did in the thinking block.`,
      },
    },
  ],
};
