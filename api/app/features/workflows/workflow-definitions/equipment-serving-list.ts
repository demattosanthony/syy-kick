import { Workflow } from "../workflows.schemas";
import { z } from "zod";

export const equipmentServingListWorkflow: Workflow = {
  id: "equipment-serving-builder",
  title: "Equipment Serving List Builder",
  description:
    "Creates HVAC equipment service area tables from mechanical drawings by extracting data from schedules and floorplans. Maps equipment IDs to service areas and returns excel spreadsheet.",
  authorizedOrganizationIds: [
    "a58c6da2-4320-4aeb-8fc9-97fcfcae26d7",
    "a5b8c99d-9e1d-42a9-8473-b52471932d51",
    "cb9e9135-3f61-4b0b-a21f-1ecde3fcaf02",
    "282c0c89-85d7-4b94-bd31-6e87b0637cc1",
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
      processingMessage: "Finding the page with mechanical schedules...",
      processedMessage: "Mechanical schedules page found.",
      inputMapping: {
        file: "workflowInput.mechanicalDrawings",
      },
      config: {
        modelName: "gemini-2.5-pro-preview",
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
      processingMessage: "Extracting the page with mechanical schedules...",
      processedMessage: "Mechanical schedules page extracted.",
      config: {
        pdfDataSource: "workflowInput.mechanicalDrawings",
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
      processingMessage:
        "Creating the equipment serving list from the detected schedule tables...",
      processedMessage: "Equipment serving list created successfully.",
      inputMapping: {
        images: "schedule-data-object-detection.screenshots",
      },
      config: {
        modelName: "gemini-2.5-pro-preview",
        outputSchema: z.object({
          csvArtifact: z.string(),
        }),
        promptTemplate: `You are an expert in interpreting mechanical schedules for building systems. Your task is to create an 'Equipment Serving' list in CSV format based on the provided mechanical schedules images.

Your objective is to identify equipment and their corresponding service areas using the provided drawings. Focus on the tables within the mechanical schedules that contain service area location information.

Instructions:
1. Carefully analyze the mechanical schedules in the provided images.
2. Identify all equipment that has service area information listed in the schedules.
3. For each piece of equipment with service area information:
   a. Extract the Equipment ID
   b. Determine its location
   c. List the area(s) it serves
   d. Note any uncertainties or missing information
   e. Explain your reasoning for including this equipment
4. Format the information into a CSV structure

Before creating the final CSV output, work inside <schedule_analysis> tags in your thinking block to break down your interpretation of the mechanical schedules. This will help ensure accuracy and adherence to the guidelines. Include the following in your analysis:
- List all equipment mentioned in the schedules
- Categorize equipment based on whether they have service area information
- List of equipment identified with service area information
- Note any patterns in how service areas are described
- Any patterns or notable observations in the schedules
- Challenges or ambiguities encountered
- Reasoning for including or excluding specific equipment

Output Format:
Provide your final output as a CSV artifact with the following structure:
- Three columns: "Equipment ID", "Location", and "Service Area(s)"
- List each piece of equipment on a separate row
- If multiple areas are served by one piece of equipment, separate them with commas
- If you are uncertain about a service area, add "[NEEDS CONFIRMATION]" after the area description

Example format (do not use this content, it's just to illustrate the structure):

"Equipment ID","Location,Service Area(s)"
"AHU-1","Mechanical Room 101","1st Floor Offices","2nd Floor Laboratories"
"DOAS-1","Roof","3rd Floor [NEEDS CONFIRMATION]"

Important guidelines:
1. Focus on equipment with listed service areas in the schedules.
2. Do not make up any information or fill in gaps with assumptions.
3. If you are unsure about any detail, indicate it as "unknown" or use "[NEEDS CONFIRMATION]" as appropriate.
4. Double-check your work for accuracy and completeness before providing the final CSV output.

Your final output should consist only of the CSV and should not duplicate or rehash any of the work you did in the schedule analysis section.`,
      },
    },
  ],
};
