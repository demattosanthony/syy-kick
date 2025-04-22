import { Workflow } from "../workflows.schemas";
import { z } from "zod";

export const billOfMaterialsWorkflow: Workflow = {
  id: "controls-bom",
  title: "Project BOM Builder",
  description:
    "This workflow generates a Bill of Materials (BOM) for a project based on engineering drawings.",
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
      id: "doc-ocr",
      processingMessage: "Performing Optical Character Recognition (OCR)...",
      processedMessage:
        "Optical Character Recognition (OCR) completed successfully.",
      type: "document_ocr",
      config: {
        documentDataSource: "workflowInput.controls-drawings",
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
      id: "controls-bom",
      processingMessage: "Generating Bill of Materials...",
      processedMessage: "Bill of Materials generated successfully.",
      type: "llm",
      inputMapping: {
        file: "doc-ocr.images",
      },
      config: {
        modelName: "gemini-2.5-pro-preview",
        outputSchema: z.object({
          bom: z.string(),
        }),
        promptTemplate: `You are an expert electrical controls engineer tasked with extracting a comprehensive Bill of Materials (BOM) from a control system drawing. The drawing could be a wiring schematic, panel layout, or similar technical document. Your goal is to create a structured BOM that can be easily understood and exported to Excel.

First, carefully examine the attached control system drawing.

Using your expertise as an electrical controls engineer, analyze the drawing and extract all relevant components to create a Bill of Materials. Follow these steps:

1. Identify each unique component in the drawing.
2. For each component, determine the following information:
   a. Item Number
   b. Component Description
   c. Manufacturer
   d. Part Number
   e. Quantity
   f. Location or Sheet Reference (if available)
3. Aggregate quantities for any duplicate items to avoid redundancy in the final BOM.
4. If any details are missing (e.g., manufacturer or part number), use your industry knowledge to infer the most likely information. Clearly indicate any inferred data.
5. Organize the extracted information into a clean, tabular format suitable for Excel export.

Before presenting the final BOM, wrap your thought process and information extraction in <component_extraction> tags inside your thinking block. This should include:

- A numbered list of each component you identify
- For each component, write down the information you can extract directly from the drawing
- Note any missing information and explain how you plan to infer or estimate it
- Check for duplicate components and explain how you will aggregate quantities
- Any challenges you encounter and how you resolve them

It's OK for this section to be quite long.

After your analysis, present the final BOM in the following format:

| Item Number | Component Description | Manufacturer | Part Number | Quantity | Location/Sheet Reference |
|-------------|----------------------|--------------|-------------|----------|--------------------------|
| 1           | [Description]        | [Manufacturer] | [Part No.] | [Qty]    | [Location]               |
| 2           | [Description]        | [Manufacturer] | [Part No.] | [Qty]    | [Location]               |
| ...         | ...                  | ...            | ...        | ...      | ...                      |

Ensure that your final BOM:
- Includes all unique components from the drawing
- Has no duplicate items (quantities should be aggregated)
- Is complete and accurately reflects the control system drawing
- Is presented in a clear, easily readable format

Remember to use your expertise to provide the most accurate and comprehensive BOM possible based on the given information.

CSV Formatting Rules:
1. Every field must be enclosed in double quotes: "field"
2. For measurements containing inches ("), add an additional " before the inches: "8'-0"""
3. Separate fields with single commas (no spaces): "field1","field2"
4. Each schedule should start with its title on a separate line
5. Headers should be quoted: "Item","Height","Width","Area (sq ft)"

Your final output should consist only of the BOM table and should not duplicate or rehash any of the work you did in the thinking block.`,
      },
    },
  ],
};
