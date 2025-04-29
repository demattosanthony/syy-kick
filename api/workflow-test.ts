import util from "util";
import { WorkflowRunner } from "./app/features/workflows/workflows.runner";
import { equipmentServingListWorkflow } from "./app/features/workflows/workflow-definitions/equipment-serving-list";
import { billOfMaterialsWorkflow } from "./app/features/workflows/workflow-definitions/bill-of-materials";
import { windowDoorScheduleGenWorkflow } from "./app/features/workflows/workflow-definitions/window-door-schedule-gen";

// const filePath =
//   "/Users/anthonydemattos/syy-kick/workflows-dataset/window-door-gen/20250318PacificStADUPermitSetProgress.pdf";
// const file = Bun.file(filePath);
// const pdf = await file.arrayBuffer();
// const pdfBytes = new Uint8Array(pdf);

// const workflowRunner = new WorkflowRunner(
//   windowDoorScheduleGenWorkflow,
//   (update) => {
//     console.log(util.inspect(update, { depth: null, colors: true }));
//     console.log("\n");
//   },
//   true
// );

// await workflowRunner.run({
//   "architectural-drawings": {
//     data: pdfBytes,
//     mimeType: "application/pdf",
//     filename: "architectural-drawings.pdf",
//   },
// });

// const filePath =
//   "/Users/anthonydemattos/syy-kick/workflows-dataset/equipment-serving/MechBinder.pdf";
// const file = Bun.file(filePath);
// const pdf = await file.arrayBuffer();
// const pdfBytes = new Uint8Array(pdf);

// const workflowRunner = new WorkflowRunner(
//   equipmentServingListWorkflow,
//   (update) => {
//     console.log(util.inspect(update, { depth: null, colors: true }));
//     console.log("\n");
//   },
//   true
// );

// await workflowRunner.run({
//   "mechanical-drawings": {
//     data: pdfBytes,
//     mimeType: "application/pdf",
//     filename: "mechanical-drawings.pdf",
//   },
// });

const filePath =
  "/Users/anthonydemattos/syy-kick/workflows-dataset/bom-consolidator/rev1-rod-n-reel/Rev1_RodnReelCasino_CtrlDwgs_04222025.pdf";
const file = Bun.file(filePath);
const pdf = await file.arrayBuffer();
const pdfBytes = new Uint8Array(pdf);

const workflowRunner = new WorkflowRunner(
  billOfMaterialsWorkflow,
  (update) => {
    console.log(util.inspect(update, { depth: null, colors: true }));
    console.log("\n");
  },
  true
);

await workflowRunner.run({
  "controls-drawings": {
    data: pdfBytes,
    mimeType: "application/pdf",
    filename: "controls-drawings.pdf",
  },
});
