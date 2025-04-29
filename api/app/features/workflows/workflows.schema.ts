import {
  uuid,
  varchar,
  timestamp,
  text,
  jsonb,
  pgTable,
} from "drizzle-orm/pg-core";
import { users, organizations } from "../../config/schema";
import { agents } from "../agents/agents.schema";
import { WorkflowStepFormSchema } from "./workflows.types";

const TOOL_CALL_STATUS = ["pending", "completed", "failed"] as const;
const MESSAGE_ROLES = ["system", "user", "assistant", "tool"] as const;
const WORKFLOW_RUN_STATUS = [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
  "waiting",
] as const;
const WORKFLOW_RUN_STEP_STATUS = [
  "pending",
  "running",
  "completed",
  "failed",
] as const;

export const workflows = pgTable("workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdBy: uuid("created_by").references(() => users.id),
  organizationId: uuid("organization_id").references(() => organizations.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workflowSteps = pgTable("workflow_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id")
    .references(() => workflows.id, {
      onDelete: "cascade",
    })
    .notNull(),
  agentId: uuid("agent_id").references(() => agents.id),
  name: varchar("name", { length: 255 }), // override the agent name if provided
  description: text("description"), // override the agent description if provided
  instructions: text("instructions"), // override the agent instructions if provided
  model: varchar("model", { length: 255 }), // override the agent model if provided
  activeTools: text("active_tools").array(), // override the agent active tools if provided
  formSchema: jsonb("form_schema").$type<WorkflowStepFormSchema>(), // override the agent form schema if provided
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workflowFiles = pgTable("workflow_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowStepId: uuid("workflow_step_id").references(() => workflowSteps.id, {
    onDelete: "cascade",
  }),
  name: varchar("name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 255 }),
  fileKey: varchar("file_key", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workflowRuns = pgTable("workflow_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id").references(() => workflows.id, {
    onDelete: "cascade",
  }),
  status: text("status", { enum: WORKFLOW_RUN_STATUS }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workflowRunSteps = pgTable("workflow_run_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowRunId: uuid("workflow_run_id").references(() => workflowRuns.id, {
    onDelete: "cascade",
  }),
  workflowStepId: uuid("workflow_step_id").references(() => workflowSteps.id, {
    onDelete: "cascade",
  }),
  status: text("status", { enum: WORKFLOW_RUN_STEP_STATUS }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workflowRunStepsInputs = pgTable("workflow_run_steps_inputs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowRunStepId: uuid("workflow_run_step_id").references(
    () => workflowRunSteps.id,
    {
      onDelete: "cascade",
    }
  ),
  parentStepId: uuid("parent_step_id").references(() => workflowRunSteps.id), // previous step output files
  fileId: uuid("file_id").references(() => workflowFiles.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workflowRunStepsOutputs = pgTable("workflow_run_steps_outputs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowRunStepId: uuid("workflow_run_step_id").references(
    () => workflowRunSteps.id
  ),
  fileId: uuid("file_id").references(() => workflowFiles.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workflowRunStepMessages = pgTable("workflow_run_step_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowRunStepId: uuid("workflow_run_step_id").references(
    () => workflowRunSteps.id,
    {
      onDelete: "cascade",
    }
  ),
  role: text("role", { enum: MESSAGE_ROLES }).notNull(),
  text: text("text"),
  reasoning: text("reasoning"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workflowRunStepToolCalls = pgTable(
  "workflow_run_step_tool_calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowRunStepMessageId: uuid("workflow_run_step_message_id").references(
      () => workflowRunStepMessages.id,
      {
        onDelete: "cascade",
      }
    ),
    toolName: text("function_name").notNull(),
    toolCallId: text("tool_call_id").notNull(),
    args: jsonb("args"),
    status: text("status", { enum: TOOL_CALL_STATUS }).notNull(),
    result: jsonb("result"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  }
);

export const workflowRunStepMessagesDocuments = pgTable(
  "workflow_run_step_messages_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowRunStepMessageId: uuid("workflow_run_step_message_id").references(
      () => workflowRunStepMessages.id,
      {
        onDelete: "cascade",
      }
    ),
    fileId: uuid("file_id").references(() => workflowFiles.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  }
);

// Equipments serving list
/**
 * Before running the workflow, we need to:
 * 1:
 * insert the workflow with name "Equipments serving list", description "Extract the equipments serving list from the PDF file", createdBy
 * inster the workflow run with workflowId, createdBy, status "waiting?"
 * insert 3 steps: pageExtractionAgent, tableExtractionAgent, csvGenerationAgent
 *
 * 2: for each step the user will have to fill a form
 * If the step has a file input, the user can refer to previous steps outputs (if it's not the first step) or user inputs
 *
 *
 * 3: insert the user input file
 *
 * 4: insert the 3 steps inputs
 */

/**
 * During the workflow run, we need to:
 * 1: pageExtractionAgent
 * - intert step messages
 * - insert step files outputs
 *
 * 2: tableExtractionAgent
 * - refer to pageExtractionAgent outputs
 * - intert step messages
 * - insert step files outputs
 *
 * 3: csvGenerationAgent
 * - refer to tableExtractionAgent outputs
 * - intert step messages
 * - insert step files outputs
 */

// Worflow > Run > Step > Message > Document
