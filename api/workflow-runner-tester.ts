import { WorkflowRunner } from "./app/features/workflows/workflows.runnner";

const docPath = "../workflows-dataset/equipment-serving/MechBinder.pdf";

// Read file and create base64 url
const file = await Bun.file(docPath).bytes();

const base64 = Buffer.from(file).toString("base64");

const runner = new WorkflowRunner("equipment-serving-builder", {
  mechanicalDrawings: {
    name: "MechBinder.pdf",
    contentType: "application/pdf",
    url: base64,
  },
});

const result = await runner.run();
