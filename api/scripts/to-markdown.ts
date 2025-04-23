import { markitdown } from "../app/doc-processor";

const filePath =
  "/Users/anthonydemattos/Downloads/Worksheet ATUs_03262025.xlsx";

const file = await Bun.file(filePath).arrayBuffer();

const markdown = await markitdown(file, "test.xlsx");

console.log(markdown);
