import { generateObject, generateText } from "ai";
import { MODELS } from "./app/features/models";
import { z } from "zod";
import { PDFDocument } from "pdf-lib";
import { getPdfPageAsImage } from "./app/utils";
import { Jimp } from "jimp";

const docPath = "../workflows-dataset/equipment-serving/MechBinder.pdf";

// Read file and create base64 url
const file = await Bun.file(docPath).bytes();

const base64 = Buffer.from(file).toString("base64");

async function run() {
  const { object } = await generateObject({
    model: MODELS["gemini-2.5-pro-exp"].model,
    schema: z.object({
      page_number: z.number(),
    }),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "file",
            data: base64,
            mimeType: "application/pdf",
          },
          {
            type: "text",
            text: `Your job is to find the page number of the mechanical schedules sheet. Most mechanical drawings have a schedules sheet that has a bunch of tables with information about the mechanical equipment. If there is no schedules sheet, return -1. Make sure to select the schedules sheet that has the most information about the mechanical equipment, not the equations or other sheets. Make sure to return the actual page number of the pdf page, NOT the sheet number.`,
          },
        ],
      },
    ],
  });

  // Check if a valid page was found
  if (object.page_number < 0) {
    console.log("No schedules sheet found in the document.");
    return;
  }

  console.log(object.page_number);

  // Extract the specific page as a new PDF
  try {
    // Load the original PDF
    const pdfDoc = await PDFDocument.load(file);

    // Create a new PDF document
    const newPdfDoc = await PDFDocument.create();

    // Copy the specific page
    const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [
      object.page_number - 1,
    ]); // PDF pages are 0-indexed
    newPdfDoc.addPage(copiedPage);

    // Save the new PDF
    const newPdfBytes = await newPdfDoc.save();

    // Write to file
    const schedulesFilePath = `${docPath.replace(".pdf", "")}_schedules.pdf`;
    await Bun.write(schedulesFilePath, newPdfBytes);

    console.log(
      `Successfully extracted page ${object.page_number} to new PDF.`
    );

    // Use the full extracted PDF page for the image conversion
    const pageImage = await getPdfPageAsImage(newPdfBytes, 1, {
      format: "png",
      dpi: 150, // Higher DPI for better quality
      maxDimension: 8000,
    });

    // Write the image to a file
    const imageFilePath = `${docPath.replace(".pdf", "")}_schedules.png`;
    await Bun.write(imageFilePath, Buffer.from(pageImage, "base64"));

    console.log(`Successfully converted PDF page to image: ${imageFilePath}`);

    const { object: boundingBoxesObject } = await generateObject({
      model: MODELS["gemini-2.5-pro-exp"].model,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              image: pageImage,
              mimeType: "image/png",
            },
            {
              type: "text",
              text: `Detect all engineering equipment schedule tables, with no more than 20 items. Each schedule table bounding box should contain the table title and all the rows of the table.
Output the bounding boxes in the [y_min, x_min, y_max, x_max] format.
The top left corner is (0,0). The x axis goes left→right, the y axis top→bottom.
Coordinate values must be normalized to 0–1000 for both width and height.
Each entry should contain { "box_2d": [y_min, x_min, y_max, x_max], "label": "..." }.`,
            },
          ],
        },
      ],
      schema: z.object({
        bounding_boxes: z.array(
          z.object({
            box_2d: z.array(z.number()).length(4),
            label: z.string(),
          })
        ),
      }),
    });

    console.log(boundingBoxesObject.bounding_boxes);

    // Load the image
    const image = await Jimp.read(imageFilePath);
    const { width, height } = image.bitmap;
    let index = 0;

    // Save all bounding boxes as separate images
    let boundingBoxImages = [];

    for (const box of boundingBoxesObject.bounding_boxes) {
      const [y_min, x_min, y_max, x_max] = box.box_2d;
      const label = box.label;

      // Convert normalized [0..1000] → actual pixel coordinates
      const x1 = Math.round((x_min / 1000) * width);
      const y1 = Math.round((y_min / 1000) * height);
      const x2 = Math.round((x_max / 1000) * width);
      const y2 = Math.round((y_max / 1000) * height);

      // Extract the bounding box as a new image
      const boxWidth = x2 - x1;
      const boxHeight = y2 - y1;

      // Clone the original image and crop to the bounding box
      const boxImage = image.clone().crop({
        h: boxHeight,
        w: boxWidth,
        x: x1,
        y: y1,
      });

      // Get base64 representation
      const boxImageBuffer = await boxImage.getBuffer("image/jpeg");
      const boxImageBase64 = boxImageBuffer.toString("base64");

      boundingBoxImages.push(boxImageBase64);

      // Create a sanitized label for filename (replace spaces and special chars)
      const safeLabel = label.replace(/[^a-z0-9]/gi, "_").toLowerCase();

      // Save the cropped image
      await boxImage
        .write(`./ocr-results/box_${index}_${safeLabel}.jpeg`)
        .then(() => console.log(`Saved bounding box ${index}: ${label}`))
        .catch((err) => console.error(`Error saving box ${index}:`, err));
      index += 1;
    }

    console.log(`Generated ${boundingBoxImages.length} bounding box images.`);

    const { text } = await generateText({
      model: MODELS["gemini-2.5-pro-exp"].model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are tasked with creating an 'Equipment Serving' list based on mechanical drawings. Your objective is to identify which areas the large mechanical equipment (like AHUs, DOAS, etc.) serves using the provided drawings, prioritizing mechanical schedules within the drawings as the primary source. Smaller units or equipment without listed service areas on the schedules should be ignored and not included in the final list.

Most mechanical drawings have a dedicated schedules sheet. This sheet has multiple tables of equipment schedules, listing details like equipment IDs, types, and sometimes service areas. Your goal is to extract this information and create a table mapping each HVAC equipment ID to its corresponding service area(s).

Follow these steps to complete the task:

1. Extract information from the Mechanical Schedules Sheet:
    - Identify only large mechanical equipment (e.g., AHUs, DOAS) listed in the schedules.
    - Check if service areas are explicitly listed for each piece of large mechanical equipment.
    - Ignore smaller units with no listed service areas.

2. Determine Service Areas:
    - Primary Source: Use the information from the mechanical schedules whenever available.
    - Secondary Source: If service areas are not listed in the schedules for large mechanical equipment, analyze the mechanical floorplans to trace equipment locations and ductwork paths (only if necessary).

3. Create the HVAC Equipment Service Table:
    - List each large mechanical equipment ID.
    - Assign the corresponding service area(s) to each equipment ID.

4. Handle uncertainties and finalize the output:
    - Ensure all included large mechanical equipment has an assigned area.
    - If you're uncertain about any service area, flag it for user confirmation by adding "[NEEDS CONFIRMATION]" after the area description.

5. Format your final output as follows:
    - Use a table format with two columns: "Equipment ID" and "Service Area(s)"
    - List each piece of equipment on a separate row
    - If multiple areas are served by one piece of equipment, separate them with commas

Your final response to the user is a csv artifact with the equipment serving list.

<artifacts_info>
Artifacts are for self contained content that users will modify or reuse, displayed in a separate UI window for clarity.

<artifact_instructions>
    When creating the artifact you follow these steps:

    1. Wrap the content in opening and closing \`<antArtifact>\` tags.
    2. Assign an identifier to the \`identifier\` attribute of the opening \`<antArtifact>\` tag. For updates, reuse the prior identifier. For new artifacts, the identifier should be descriptive and relevant to the content, using kebab-case (e.g., "example-code-snippet"). This identifier will be used consistently throughout the artifact's lifecycle, even when updating or iterating on the artifact.
    3. Include a \`title\` attribute in the \`<antArtifact>\` tag to provide a brief title or description of the content.
    4. Add a \`type\` attribute to the opening \`<antArtifact>\` tag to specify the type of content the artifact represents. Since you are always creating a csv artifact the type should be:
    - type="application/vnd.ant.code" language="csv"
</artifact_instructions>

Here is a template of what the csv artifact result should look like:

<example_artifact>
    <user_query>Analyze the mechanical drawings and create an equipment serving list.</user_query>

    <assistant_response>
        Based on my analysis of the mechanical drawings, here is the equipment serving list:

        <antArtifact identifier="equipment-serving-list" type="application/vnd.ant.code" language="csv" title="HVAC Equipment Serving List">
            Equipment ID,Service Area(s)
            AHU-1,"First Floor Offices, Conference Room A"
            AHU-2,"Second Floor Open Office Area, Meeting Rooms 201-205"
            FCU-1,"Server Room 101"
            FCU-2,"IT Closet 202"
            FCU-3,"Second Floor, Room 201 [NEEDS CONFIRMATION]"
            RTU-1,"Cafeteria, Kitchen Area"
            RTU-2,"Third Floor, Open Plan Area"
            VAV-1-1,"First Floor North Zone"
            VAV-1-2,"First Floor South Zone"
            VAV-2-1,"Second Floor East Zone"
            VAV-2-2,"Second Floor West Zone"
            EF-1,"Restrooms 101, 102"
            EF-2,"Restrooms 201, 202"
            EF-3,"Kitchen Hood"
        </antArtifact>
    </assistant_response>
</example_artifact>
</artifacts_info>

Ensure all equipment is properly identified and mapped to their respective service areas before creating the artifact.`,
            },
            ...(boundingBoxImages.map((image) => ({
              type: "image",
              image: image,
              mimeType: "image/jpeg",
            })) as any),
          ],
        },
      ],
    });

    console.log(text);
  } catch (error) {
    console.error("Error creating PDF or image:", error);
  }
}

run();
