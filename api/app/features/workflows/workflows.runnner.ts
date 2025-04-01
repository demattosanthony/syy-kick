import { getWorkflowDefinition } from "./workflows.config";
import { stepExecutorRegistry } from "./workflows.processors";
import {
  FileData,
  StepInputData,
  StepOutputData,
  Workflow,
  WorkflowState,
  WorkflowStepConfig,
} from "./workflows.schemas";

export class WorkflowRunner {
  private workflow: Workflow;
  private initialRequestInputs: Record<string, FileData>;
  private state: WorkflowState;

  constructor(
    workflowId: string,
    initialRequestInputs: Record<string, FileData>
  ) {
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

      this.state.workflowInput[inputConfig.id] = inputData;
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

  private getDataSourceValue(state: WorkflowState, sourcePath: string) {
    if (!sourcePath) return undefined;

    const parts = sourcePath.split(".");
    const sourceKey = parts[0]; // e.g., 'workflowInput' or '{step-id}'
    const remainingPath = parts.slice(1); // e.g., ['file', 'url']

    let currentValue: any;

    if (sourceKey === "workflowInput") {
      currentValue = state.workflowInput;
    } else if (state.stepOutputs?.[sourceKey]) {
      currentValue = state.stepOutputs[sourceKey];
    }

    // Traverse the remaining path
    for (const key of remainingPath) {
      currentValue = currentValue?.[key];
      if (currentValue === undefined) break;
    }

    return currentValue;
  }

  private prepareStepInputs(step: WorkflowStepConfig): StepInputData {
    const stepInputs: StepInputData = {};
    const inputMapping = step.inputMapping;

    if (!inputMapping) return {};

    for (const inputKey in inputMapping) {
      const sourcePath = inputMapping[inputKey];
      const value = this.getDataSourceValue(this.state, sourcePath);
      stepInputs[inputKey] = value;
    }

    return stepInputs;
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

        // Prepare the inputs required by the executor
        const inputs = this.prepareStepInputs(step);

        output = await executor({
          state: this.state,
          inputs,
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
