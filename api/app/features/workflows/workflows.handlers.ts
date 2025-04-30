import { Request, Response } from "express";
import {
  getAuthorizedWorkflowDefinitions,
  getWorkflowDefinition,
} from "./workflows.registry";
import {
  WorkflowRun,
  WorkflowExecutionInputValuesSchema,
  WorkflowRunStep,
} from "./workflows.types";
import { workflowsOps } from "./workflows.ops";
import { ToolName } from "../tools/tools.types";

const workflowHandlers = {
  getAll: async (req: Request, res: Response) => {
    try {
      const orgWorkflows = getAuthorizedWorkflowDefinitions(
        req.workspace?.id as string
      );
      res.json(orgWorkflows);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  },

  getById: async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      // const isAllowedtoAcess = isWorkflowAuthorized(
      //   id as any,
      //   req.workspace?.id as string
      // );
      // if (!isAllowedtoAcess) {
      //   res.status(403).json({ error: "Unauthorized" });
      //   return;
      // }

      const workflow = getWorkflowDefinition(id as any);

      if (!workflow) {
        res.status(404).json({ error: "Workflow not found" });
        return;
      }

      res.json(workflow);
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  getEvents: async (req: Request, res: Response) => {
    const { workflowId } = req.params;

    const events = await workflowsOps.getEvents(workflowId as any);
    res.json(events);
  },

  createWorkflowRun: async (req: Request, res: Response) => {
    const { workflowId, inputValues } = req.body;

    // Validate inputValues using Zod
    const validationResult =
      WorkflowExecutionInputValuesSchema.safeParse(inputValues);

    if (!validationResult.success) {
      // Construct a user-friendly error message from Zod issues
      const errorMessages = validationResult.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ");
      res.status(400).json({ error: `Invalid inputValues: ${errorMessages}` });
      return;
    }

    // Use the validated data from Zod
    const validatedInputValues = validationResult.data;

    const workflowRun = await workflowsOps.createWorkflowRun(
      workflowId,
      validatedInputValues
    );
    res.json(workflowRun);
  },

  getWorkflowRun: async (req: Request, res: Response) => {
    const { workflowId, workflowRunId } = req.params;

    const workflowRun = await workflowsOps.getWorkflowRun(
      workflowId,
      workflowRunId
    );
    res.json(workflowRun);
  },

  // Kick off the workflow run that will be processed in the background
  run: async (req: Request, res: Response) => {
    const { workflowId, workflowRunId } = req.body;

    try {
      // Fetch the workflow run and all its steps
      const workflowRun = await workflowsOps.getWorkflowRun(
        workflowId,
        workflowRunId
      );

      if (!workflowRun.workflow) {
        res.status(404).json({ error: "Workflow not found" });
        return;
      }

      const workflowSteps: WorkflowRunStep[] = workflowRun.steps?.map(
        (step) => {
          const agent = step.workflowStep?.agents;
          const stepData = step.workflowStep;

          // If theres an agent use the agent info
          // If not that means its a custom step and we use the step data
          const name = agent?.name ?? stepData?.name ?? "";
          const description = agent?.description ?? stepData?.description ?? "";
          const instructions =
            agent?.instructions ?? stepData?.instructions ?? "";
          const model = agent?.model ?? stepData?.model ?? "";
          const activeTools = (agent?.activeTools ??
            stepData?.activeTools ??
            []) as ToolName[];

          return {
            id: step.id,
            name,
            description,
            instructions,
            model,
            activeTools,
          };
        }
      );

      const workflowRunData: WorkflowRun = {
        runId: workflowRun.id,
        workflowId: workflowRun.workflowId,
        name: workflowRun.workflow.name,
        description: workflowRun.workflow.description ?? undefined,
        workflowSteps,
        executionInputValues: workflowRun.executionInputValues,
      };

      workflowsOps.runWorkflow(workflowRunData);

      // Send a response indicating the workflow run has started
      res.status(202).json({
        message: "Workflow run initiated successfully.",
        workflowRunId: workflowRunId,
      });
    } catch (error) {
      console.error("Error running workflow:", error);
      res.status(500).json({ error: "Failed to process workflow" });
    }
  },
};

export default workflowHandlers;
