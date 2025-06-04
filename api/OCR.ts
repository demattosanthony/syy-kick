import { processFile } from "./app/doc-processor-v2";

// const filePath = "/Users/anthonydemattos/workflows-dataset/dunbar-mech-set.pdf";
const filePath = "/Users/anthonydemattos/Downloads/Niagara Web API Guide.pdf";

const file = Bun.file(filePath);

const arrayBuffer = await file.arrayBuffer();
const buffer = Buffer.from(arrayBuffer);

const fileContentChunks = await processFile(
  buffer,
  "Niagara Web API Guide.pdf",
  "application/pdf"
);

console.log(JSON.stringify(fileContentChunks, null, 2));
