import s3 from "./app/config/s3";
import { DocumentProcessor } from "./app/doc-processor-v2";

// const filePath =
//   "/Users/anthonydemattos/Downloads/brickschema-readthedocs-io-en-latest.pdf";

const filePath =
  "/Users/anthonydemattos/Downloads/Worksheet ATUs_03262025.xlsx";

const file = await Bun.file(filePath).arrayBuffer();

const fileKey = `doc-extract-testing/${Date.now()}-test.xlsx`;
await s3.write(fileKey, file);

const docProcessor = new DocumentProcessor(
  fileKey,
  "test.xlsx",
  "application/xlsx",
  undefined,
  true
);

docProcessor.getMarkdown().then((result) => {
  //   console.log(result?.markdown);

  Bun.write(`./${Date.now()}-test.md`, result || "");
});
