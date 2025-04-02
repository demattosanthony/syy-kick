import { Workflow } from "../workflows.schemas";
import { z } from "zod";

export const equipmentServingListWorkflow: Workflow = {
  id: "equipment-serving-builder",
  title: "Equipment Serving List Builder",
  description:
    "Creates HVAC equipment service area tables from mechanical drawings by extracting data from schedules and floorplans. Maps equipment IDs to service areas in a structured format for facility management.",
  authorizedOrganizationIds: [
    "a58c6da2-4320-4aeb-8fc9-97fcfcae26d7",
    "a5b8c99d-9e1d-42a9-8473-b52471932d51",
    "cb9e9135-3f61-4b0b-a21f-1ecde3fcaf02",
  ],
  inputs: [
    {
      id: "mechanicalDrawings",
      type: "file",
      title: "Mechanical Drawings PDF",
      description: "Containing mechanical schedules and floorplans",
      acceptedFileTypes: "application/pdf",
      required: true,
    },
    {
      id: "mechanical-schedule",
      type: "file",
      title: "Mechanical Schedule PDF",
      description: "Primary source for areas served",
      acceptedFileTypes: "application/pdf",
      required: false,
    },
    {
      id: "mechanical-floorplans",
      type: "file",
      title: "Mechanical Floorplans PDF",
      description: "Secondary source if schedules do not list service areas",
      acceptedFileTypes: "application/pdf",
      required: false,
    },
  ],
  output: {
    type: "text/csv",
    title: "Equipment Serving List",
    description: "View the generated equipment serving list",
    outputKey: "csvArtifact",
  },
  steps: [
    {
      id: "find-schedules-page",
      type: "llm",
      title: "Find Mechanical Schedules Page",
      inputMapping: {
        file: "workflowInput.mechanicalDrawings",
      },
      config: {
        modelName: "gemini-2.5-pro-exp",
        promptTemplate:
          "Find the page containing mechanical schedules in the provided PDF.",
        outputSchema: z.object({
          pageNumber: z.number(),
        }),
      },
    },
    {
      id: "extract-pdf-page",
      type: "pdf_page_extract",
      title: "Extract Mechanical Schedules Page",
      config: {
        pdfDataSource: "workflowInput.mechanicalDrawings",
        pageNumberSource: "find-schedules-page.pageNumber",
      },
    },
    {
      id: "schedule-data-object-detection",
      type: "object_detection",
      title: "Detect Schedule Tables",
      config: {
        imageDataSource: "extract-pdf-page.imageBase64",
        model: "gemini-2.5-pro-exp",
        promptTemplate: `Detect all engineering equipment schedule tables, with no more than 20 items. Each schedule table bounding box should contain the table title and all the rows of the table.
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
      id: "spreadsheet-creation",
      type: "llm",
      title: "Create Equipment Serving List",
      inputMapping: {
        images: "schedule-data-object-detection.screenshots",
      },
      config: {
        modelName: "gemini-2.5-pro-exp",
        outputSchema: z.object({
          csvArtifact: z.string(),
        }),
        promptTemplate: `You are tasked with creating an 'Equipment Serving' list csv file based on mechanical schedules images. Your objective is to identify which areas the large mechanical equipment (like AHUs, DOAS, etc.) serves using the provided drawings, prioritizing mechanical schedules within the drawings as the primary source. Smaller units or equipment without listed service areas on the schedules should be ignored and not included in the final list.

Format your final output as a csv artifact using the following structure:
- Two columns: "Equipment ID" and "Service Area(s)"
- List each piece of equipment on a separate row.
- If multiple areas are served by one piece of equipment, separate them with commas.
- If you are uncertain about a service area, add "[NEEDS CONFIRMATION]" after the area description.

Your final response to the user must be only the csv artifact.`,
      },
    },
  ],
};
