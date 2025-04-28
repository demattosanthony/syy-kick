import { ArtifactService } from "./app/features/workflows/artifact-service";
import util from "util";
import { WorkflowRunner } from "./app/features/workflows/workflows.runnner";
import { windowDoorScheduleGenWorkflow } from "./app/features/workflows/workflow-definitions/window-door-schedule-gen";

const filePath =
  "/Users/anthonydemattos/syy-kick/workflows-dataset/window-door-gen/20250318PacificStADUPermitSetProgress.pdf";
const file = Bun.file(filePath);
const pdf = await file.arrayBuffer();
const pdfBytes = new Uint8Array(pdf);

const workflowRunner = new WorkflowRunner(
  windowDoorScheduleGenWorkflow,
  (update) => {
    console.log(util.inspect(update, { depth: null, colors: true }));
    console.log("\n");
  },
  true
);

await workflowRunner.run({
  "architectural-drawings": {
    data: pdfBytes,
    mimeType: "application/pdf",
    filename: "architectural-drawings.pdf",
  },
});
