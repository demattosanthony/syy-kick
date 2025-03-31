import { Mistral } from "@mistralai/mistralai";

const mistral = new Mistral({
  apiKey: process.env["MISTRAL_API_KEY"] ?? "",
});

const docPath = "../workflows-dataset/equipment-serving/MechBinder.pdf";

// Read file and create base64 url
const file = await Bun.file(docPath).bytes();

const base64 = Buffer.from(file).toString("base64");

async function run() {
  const result = await mistral.ocr.process({
    model: "mistral-ocr-latest",
    document: {
      documentUrl: `data:application/pdf;base64,${base64}`,
      type: "document_url",
    },
    includeImageBase64: true,
  });

  // Handle the result
  console.log(result);

  let markdown = "";

  for (const item of result.pages) {
    if (item.markdown) {
      markdown += item.markdown + "\n\n";
    }

    item.images.forEach(async (image, index) => {
      if (!image.imageBase64) {
        return;
      }

      // Extract base64 data, removing any prefix if present
      let imageBase64 = image.imageBase64;
      if (imageBase64.includes(",")) {
        imageBase64 = imageBase64.split(",", 2)[1];
      }

      try {
        // Decode base64 to binary data
        const imageData = Buffer.from(imageBase64, "base64");

        // Determine file extension based on image signature
        let ext = "bin";
        if (imageData[0] === 0xff && imageData[1] === 0xd8) {
          ext = "jpeg";
        } else if (
          imageData[0] === 0x89 &&
          imageData[1] === 0x50 &&
          imageData[2] === 0x4e &&
          imageData[3] === 0x47
        ) {
          ext = "png";
        } else {
          console.log(`❌ Image has unknown format for item ${index}`);
        }

        // Format filename and save
        const imageFilename = "./ocr-results/" + image.id;
        await Bun.write(imageFilename, imageData);
        console.log(`Saved image: ${imageFilename}`);
      } catch (error) {
        console.error(`Failed to process image ${index}:`, error);
      }
    });
  }

  await Bun.write("./ocr-results/markdown.md", markdown);
  console.log("Saved markdown file");
}

run();
