import { WorkflowRun, WorkflowRunState } from "@mastra/core";

/** @todo: use their type when available */
export interface VNextWorkflowRunState extends Omit<WorkflowRunState, 'context'> {
    context: {
      inputs: Record<string, any>;
      [stepId: string]: Record<string, {
        status: 'success' | 'failed' | 'suspended' | 'waiting' | 'skipped';
        output?: any;
        error?: string;
      }>;
    }
  }
  
  export interface CustomWorkflowRun extends Omit<WorkflowRun, 'snapshot'> {
    snapshot: VNextWorkflowRunState;
  }
  