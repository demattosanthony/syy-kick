import util from "util";
import { WorkflowRunner } from "./app/features/workflows/workflows.runner";
import { equipmentServingListWorkflow } from "./app/features/workflows/workflow-definitions/equipment-serving-list";
import { billOfMaterialsWorkflow } from "./app/features/workflows/workflow-definitions/bill-of-materials";
import { windowDoorScheduleGenWorkflow } from "./app/features/workflows/workflow-definitions/window-door-schedule-gen";
import { randomUUID } from "crypto";
import fs from "fs";
import { appendFileSync } from "fs";
import { WorkflowProgressUpdate } from "./app/features/workflows/workflows.types";

const WORKFLOW_RUN_INDEX = 0;

const workflows = [
  equipmentServingListWorkflow,
  billOfMaterialsWorkflow,
  windowDoorScheduleGenWorkflow,
];
const workflowFilesPaths = [
  "/Users/anthonydemattos/syy-kick/workflows-dataset/equipment-serving/MechBinder.pdf",
  "/Users/anthonydemattos/syy-kick/workflows-dataset/bill-of-materials/BOM.pdf",
  "/Users/anthonydemattos/syy-kick/workflows-dataset/window-door-schedule-gen/WindowDoorSchedule.pdf",
];
const filesBytes = await Bun.file(
  workflowFilesPaths[WORKFLOW_RUN_INDEX]
).arrayBuffer();
const pdfBytes = new Uint8Array(filesBytes);
const workflowExecutionInputValues = {
  [workflowFilesPaths[WORKFLOW_RUN_INDEX].split("/").pop()!]: {
    type: "file" as const,
    value: {
      data: pdfBytes,
      mimeType: "application/pdf",
      filename: workflowFilesPaths[WORKFLOW_RUN_INDEX].split("/").pop()!,
    },
  },
};

// Clear the workflow txt file so its empty
fs.writeFileSync("workflow.txt", "");

const workflowProgressCallback = (update: WorkflowProgressUpdate) => {
  // Log to console for debugging
  console.log(util.inspect(update, { depth: null, colors: true }));
  console.log("\n");

  // Save update to workflow-specific file
  const content = JSON.stringify(update, null, 2) + "\n";
  appendFileSync("workflow.txt", content, "utf-8");
};

const workflowRunner = new WorkflowRunner(
  workflows[WORKFLOW_RUN_INDEX],
  workflowProgressCallback,
  true
);

await workflowRunner.run(workflowExecutionInputValues, randomUUID());
