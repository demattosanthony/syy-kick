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
      title: "Document OCR",
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
      title: "AI Evaluation",
      type: "llm",
      inputMapping: {
        images: "doc-ocr.images",
      },
      config: {
        modelName: "gpt-4o",
        outputSchema: z.object({
          csvArtifact: z.string(),
        }),
        promptTemplate: `You are an AI assistant specialized in analyzing architectural PDF plans. Your primary task is to extract window and door schedules from these plans, calculate areas, and present the information in a structured CSV format.

Your goal is to create two separate schedules: one for windows and one for doors. Each schedule should include the following columns: Item, Height, Width, and Area (sq ft). Follow these steps:

1. Scan the PDF content for window and door schedules, dimensions, and relevant symbols.
2. Extract the necessary information for each window and door.
3. Convert all measurements to feet and inches if they're in a different unit.
4. Calculate the area in square feet for each item based on the height and width.
5. Round the calculated areas to two decimal places.
6. Organize the information into two separate tables: one for windows and one for doors.
7. Format the tables as CSV with proper formatting.

Before providing your final output, work through the following steps inside <extraction_and_calculation> tags in your thinking block:
- List all window and door items found in the PDF content.
- For each item, write down the extracted dimensions and perform any necessary unit conversions.
- Verify that all measurements are in feet and inches (e.g., 5'0").
- Show your area calculations for each item, ensuring they're in square feet and rounded to two decimal places.
- Note any challenges you encounter and how you resolve them.
- If any information is missing or unclear, explain what's missing and how you plan to address it (e.g., by prompting the user for clarification or making estimates based on similar elements).

Your final output should be a CSV text content containing both the window and door schedules. Use the following format for the CSV artifact:

<example_artifact>
WINDOW SCHEDULE
Item,Height,Width,Area (sq ft)
Window/Storefront A,7'0",10'0",70.00
Window/Storefront C,7'0",9'0",63.00
Window/Storefront D,7'0",7'0",49.00
Window/Storefront F,7'0",3'0",21.00
Window/Storefront G,7'0",2'0",14.00
Window/Storefront H,7'0",6'0",42.00
Window/Storefront I,2'0",6'0",12.00
Window/Storefront J,2'0",9'0",18.00
Window/Storefront K,2'0",10'0",20.00

DOOR SCHEDULE
Item,Height,Width,Area (sq ft)
Door Type A1,7'0",3'0",21.00
</example_artifact>

Ensure that your CSV content includes both the window and door schedules, with a clear separation between them.

Remember:
- All measurements must be in feet and inches (e.g., 7'0").
- Areas should be calculated in square feet and rounded to two decimal places.
- Make sure to include the double quotes in the height and width measurements (e.g., 7'0").
- Verify the accuracy of all extracted and calculated information before including it in the final output.
- Format exactly as shown in the example above, with no extra quotes around the entire values.

Your final output should consist only of the CSV artifact and should not duplicate or rehash any of the work you did in the thinking block.`,
      },
    },
  ],
};
