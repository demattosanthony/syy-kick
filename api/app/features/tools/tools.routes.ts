import { Router } from "express";
import { z } from "zod";

const router = Router();

const tools = [
  {
    id: "web-search",
    name: "Web Search",
    description: "Search the web for information",
  },
  {
    id: "pdf-page-extraction",
    name: "PDF Page Extraction",
    description:
      "Extract pages from a PDF document and converts them to images",
  },
  {
    id: "object-detection",
    name: "Object Detection",
    description: "Detect objects in an image and returns the bounding boxes",
  },
  {
    id: "doc-ocr",
    name: "Document OCR",
    description: "Extract text from a document and returns the text",
  },
  {
    id: "sharepoint-files-finder",
    name: "Sharepoint Files Finder",
    description: "Find files in a Sharepoint site",
    parameters: z.object({
      folderPath: z.string().describe("The path to the folder to search in").optional(),
    }),
  },
];

router.get("/", (req, res) => {
  res.json(tools);
});

export default router;
