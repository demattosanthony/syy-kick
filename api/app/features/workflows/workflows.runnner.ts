import {
  getWorkflowDefinition,
  stepExecutorRegistry,
} from "./workflows.registry";
import {
  FileData,
  ProgressCallback,
  ProgressUpdate,
  StepExecutorUtilities,
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
  private utilities: StepExecutorUtilities;
  private progressCallback: ProgressCallback;
  private debug: boolean;

  constructor(
    workflowId: string,
    initialRequestInputs: Record<string, FileData>,
    progressCallback: ProgressCallback,
    debug: boolean = false
  ) {
    const definition = getWorkflowDefinition(workflowId);
    if (!definition) {
      throw new Error(`Workflow definition not found for ID: ${workflowId}`);
    }

    this.workflow = definition;
    this.initialRequestInputs = initialRequestInputs;
    this.progressCallback = progressCallback;
    this.state = { workflowInput: {}, stepOutputs: {} };
    this.utilities = {
      getDataSourceValue: this.getDataSourceValue,
    };
    this.debug = debug;
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
      // Emit workflow_start event
      this.progressCallback({
        type: "workflow_start",
        data: { workflowId: this.workflow.id, title: this.workflow.title },
      });

      // 1. Process inital inputs
      await this.processInitalInputs();

      for (const step of this.workflow.steps) {
        // Emit step_start event
        this.progressCallback({
          type: "step_start",
          data: { stepId: step.id, message: step.processingMessage },
        });

        let output: StepOutputData;

        const executor = stepExecutorRegistry.get(step.type);

        if (!executor) {
          const errorMsg = `No executor registered for step type '${step.type}' in step ${step.id}.`;
          this.progressCallback({
            type: "step_error",
            data: { stepId: step.id, error: errorMsg },
          });
          throw new Error(errorMsg);
        }

        // Prepare the inputs required by the executor
        const inputs = this.prepareStepInputs(step);

        try {
          output = await executor({
            state: this.state,
            inputs,
            step,
            workflow: this.workflow,
            utils: this.utilities,
            progressCallback: this.progressCallback,
            debug: this.debug,
          });

          // Emit step_complete event
          this.progressCallback({
            type: "step_complete",
            data: { stepId: step.id, message: step.processedMessage },
          });
        } catch (stepError: any) {
          // Emit step_error event
          this.progressCallback({
            type: "step_error",
            data: { stepId: step.id, error: stepError.message },
          });
          throw stepError; // Re-throw to stop execution
        }

        // Store the output
        this.state.stepOutputs[step.id] = output;

        // if (this.debug) {
        //   console.log(`State after step ${step.id}:`, {
        //     workflowInput: Object.keys(this.state.workflowInput),
        //     stepOutputs: Object.keys(this.state.stepOutputs),
        //   });
        // }
      }

      // Get the final output from the last step
      const finalOutput =
        this.state.stepOutputs[
          this.workflow.steps[this.workflow.steps.length - 1].id
        ] || {};

      // Determine the workflow output based on the output key
      let workflowOutput: any = finalOutput;
      const keys = this.workflow.output.outputKey.split(".");
      for (const key of keys) {
        if (
          workflowOutput &&
          typeof workflowOutput === "object" &&
          key in workflowOutput
        ) {
          workflowOutput = workflowOutput[key];
        } else {
          const errorMsg = `Output key '${this.workflow.output.outputKey}' not found in final output`;
          this.progressCallback({
            type: "workflow_error",
            data: { error: errorMsg },
          });
          throw new Error(errorMsg);
        }
      }

      // Emit workflow_complete event
      this.progressCallback({
        type: "workflow_complete",
        data: { output: workflowOutput, type: this.workflow.output.type },
      });

      return finalOutput;
    } catch (err: any) {
      this.progressCallback({
        type: "workflow_error",
        data: { error: err.message },
      });
      throw err;
    }
  }
}
