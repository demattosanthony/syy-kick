import { WorkflowRunner } from "./app/features/workflows/workflows.runnner";
import { ProgressUpdate } from "./app/features/workflows/workflows.schemas";

const docPath = "../workflows-dataset/equipment-serving/MechBinder.pdf";

// Read file and create base64 url
const file = await Bun.file(docPath).bytes();

const base64 = Buffer.from(file).toString("base64");

const processEvent = (update: ProgressUpdate) => {
  console.log(JSON.stringify(update));
};

const runner = new WorkflowRunner(
  "equipment-serving-builder",
  {
    mechanicalDrawings: {
      fileName: "MechBinder.pdf",
      mimeType: "application/pdf",
      url: base64,
    },
  },
  processEvent
);

const result = await runner.run();
// console.log(result.csvArtifact);
