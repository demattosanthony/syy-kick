import { getWorkflowDefinition } from "./workflows.config";
import { stepExecutorRegistry } from "./workflows.processors";
import {
  FileData,
  StepOutputData,
  Workflow,
  WorkflowState,
} from "./workflows.schemas";

export class WorkflowRunner {
  private workflow: Workflow;
  private initialRequestInputs: Record<string, any>;
  private state: WorkflowState;

  constructor(workflowId: string, initialRequestInputs: Record<string, any>) {
    const definition = getWorkflowDefinition(workflowId);
    if (!definition) {
      throw new Error(`Workflow definition not found for ID: ${workflowId}`);
    }

    this.workflow = definition;
    this.initialRequestInputs = initialRequestInputs;
    this.state = { workflowInput: {}, stepOutputs: {} };
  }

  private async processInitalInputs(): Promise<void> {
    for (const inputConfig of this.workflow.inputs) {
      const inputData = this.initialRequestInputs[inputConfig.id];

      if (inputConfig.required && !inputData) {
        throw new Error(
          `Missing required input: ${inputConfig.title} (ID: ${inputConfig.id})`
        );
      }
      if (!inputData) continue;

      if (inputConfig.type === "file") {
        const fileDataObject: FileData = {
          fileName: inputData.name,
          mimeType: inputData.contentType,
          url: inputData.url,
        };

        this.state.workflowInput[inputConfig.id] = fileDataObject;
      } else if (inputConfig.type === "text") {
        this.state.workflowInput[inputConfig.id] = inputData;
      }
    }
  }

  private logState(): void {
    const stateCopy = JSON.parse(JSON.stringify(this.state));
    for (const key in stateCopy.workflowInput) {
      if (stateCopy.workflowInput[key].url) {
        stateCopy.workflowInput[key].url = "[URL hidden]";
      }
    }
    console.log(stateCopy);
  }

  // Main execution loop
  public async run(): Promise<StepOutputData> {
    try {
      // 1. Process inital inputs
      await this.processInitalInputs();

      //   this.logState();

      for (const step of this.workflow.steps) {
        let output: StepOutputData;

        const executor = stepExecutorRegistry.get(step.type);

        if (!executor) {
          throw new Error(
            `No executor registered for step type '${step.type}' in step ${step.id}.`
          );
        }

        output = await executor({
          state: this.state,
          step,
          workflow: this.workflow,
        });

        // Store the output
        this.state.stepOutputs[step.id] = output;
        console.log(`Step ${step.id} completed`);
      }

      // Workflow complete
      const finalOutput =
        this.state.stepOutputs[
          this.workflow.steps[this.workflow.steps.length - 1].id
        ] || {};

      return finalOutput;
    } catch (err) {
      throw err;
    }
  }
}
