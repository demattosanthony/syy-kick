import util from "util";
import { WorkflowRunner } from "../app/features/workflows/runs/workflows.runner";
import { equipmentServingListWorkflow } from "../app/features/workflows/workflow-definitions/equipment-serving-list";
import { billOfMaterialsWorkflow } from "../app/features/workflows/workflow-definitions/bill-of-materials";
import { windowDoorScheduleGenWorkflow } from "../app/features/workflows/workflow-definitions/window-door-schedule-gen";
import { randomUUID } from "crypto";
import fs, { existsSync, mkdirSync } from "fs";
import { appendFileSync } from "fs";
import { WorkflowProgressUpdate } from "../app/features/workflows/workflows.types";
import { fileURLToPath } from "url";
import path from "path";
import s3 from "../app/config/s3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

const WORKFLOW_RUN_INDEX = 0;

const workflows = [
  equipmentServingListWorkflow,
  billOfMaterialsWorkflow,
  windowDoorScheduleGenWorkflow,
];
const workflowFilesPaths = [
  `${projectRoot}/workflows-dataset/equipment-serving/MechBinder.pdf`,
  `${projectRoot}/workflows-dataset/bom-consolidator/rev1-rod-n-reel/Rev1_RodnReelCasino_CtrlDwgs_04222025.pdf`,
  `${projectRoot}/workflows-dataset/window-door-gen/2023-0710SUNNYSLOPET24ENERGY.pdf`,
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

// Make sure the debug-workflows directory exists
fs.mkdirSync(`debug-workflows/${workflows[WORKFLOW_RUN_INDEX].name}`, {
  recursive: true,
});

// Clear the workflow txt file so its empty
fs.writeFileSync(
  `debug-workflows/${workflows[WORKFLOW_RUN_INDEX].name}/log.txt`,
  ""
);

const workflowProgressCallback = async (update: WorkflowProgressUpdate) => {
  // Log to console for debugging
  console.log(util.inspect(update, { depth: null, colors: true }));
  console.log("\n");

  // Save update to workflow-specific file
  const content = JSON.stringify(update, null, 2) + "\n";
  appendFileSync(
    `debug-workflows/${workflows[WORKFLOW_RUN_INDEX].name}/log.txt`,
    content,
    "utf-8"
  );

  if (update.type === "workflow_step_finish") {
    const stepName = update.data.stepName;
    const artifacts = update.data.artifacts;

    // Save the artifacts to the workflow-specific directory
    for (const artifact of artifacts) {
      const artifactName = artifact.filename;
      const artifactFileKey = artifact.fileKey;

      const artifactData = await s3.file(artifactFileKey).arrayBuffer();
      const artifactBytes = new Uint8Array(artifactData);

      const dir = `debug-workflows/${workflows[WORKFLOW_RUN_INDEX].name}/${stepName}`;
      // Ensure the directory exists (this might need a library or platform-specific API in a real scenario)
      // For Bun, you might need to handle directory creation manually if Bun.write doesn't create parent dirs.
      try {
        // Basic check/creation - replace with more robust logic if needed
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
      } catch (e) {
        console.warn(`Could not ensure debug directory ${dir} exists:`, e);
      }

      // Save the artifact to the workflow-specific directory
      fs.writeFileSync(`${dir}/${artifactName}`, artifactBytes, "utf-8");
    }
  }
};

const workflowRunner = new WorkflowRunner(
  workflows[WORKFLOW_RUN_INDEX],
  workflowProgressCallback
);

await workflowRunner.run(workflowExecutionInputValues, randomUUID());
