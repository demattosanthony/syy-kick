import {
  uuid,
  varchar,
  timestamp,
  text,
  jsonb,
  pgTable,
  integer,
} from "drizzle-orm/pg-core";
import { users, organizations } from "../../config/schema";
import { agents } from "./features/agents/agents.schema";
import { WorkflowStepFormSchema } from "./workflows.types";
import { relations } from "drizzle-orm";

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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workflowOrganizations = pgTable("workflow_organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id").references(() => workflows.id),
  organizationId: uuid("organization_id").references(() => organizations.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const workflowUsers = pgTable("workflow_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id").references(() => workflows.id),
  userId: uuid("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const workflowTags = pgTable("workflow_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id").references(() => workflows.id),
  tag: varchar("tag", { length: 255 }).notNull(),
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
  parentStepId: uuid("parent_step_id").references((): any => workflowSteps.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workflowFiles = pgTable("workflow_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowRunStepId: uuid("workflow_run_step_id")
    .references(() => workflowRunSteps.id, {
      onDelete: "cascade",
    })
    .notNull(),
  workflowRunId: uuid("workflow_run_id")
    .references(() => workflowRuns.id, {
      onDelete: "cascade",
    })
    .notNull(),
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
  type: text("type", { enum: ["file", "text", "date", "number"] }).notNull(),
  key: varchar("key", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workflowRunStepsInputsValue = pgTable("workflow_run_steps_inputs_value", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowRunStepInputId: uuid("workflow_run_step_input_id").references(() => workflowRunStepsInputs.id, {
    onDelete: "cascade",
  }),
  fileId: uuid("file_id").references(() => workflowFiles.id),
  text: text("text"),
  date: timestamp("date"),
  number: integer("number"),
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

export const workflowRelations = relations(workflows, ({ many }) => ({
  steps: many(workflowSteps),
  runs: many(workflowRuns),
  tags: many(workflowTags),
  organizations: many(workflowOrganizations),
  users: many(workflowUsers),
}));

export const workflowOrganizationRelations = relations(workflowOrganizations, ({ one }) => ({
  workflow: one(workflows),
  organization: one(organizations),
}));

export const workflowUserRelations = relations(workflowUsers, ({ one }) => ({
  workflow: one(workflows),
  user: one(users),
}));

export const workflowTagRelations = relations(workflowTags, ({ one }) => ({
  workflow: one(workflows),
}));

export const workflowStepRelations = relations(workflowSteps, ({ many, one }) => ({
  agents: one(agents),
  workflow: one(workflows),
  parentStep: one(workflowSteps),
}));

export const workflowRunRelations = relations(workflowRuns, ({ many, one }) => ({
  steps: many(workflowRunSteps),
  workflow: one(workflows),
}));

export const workflowRunStepRelations = relations(workflowRunSteps, ({ many, one }) => ({
  workflow: one(workflows),
  workflowRun: one(workflowRuns),
  workflowStep: one(workflowSteps),
}));

export const workflowRunStepInputsRelations = relations(workflowRunStepsInputs, ({ one }) => ({
  workflowRunStep: one(workflowRunSteps),
  file: one(workflowFiles),
  parentStep: one(workflowRunSteps),
}));

export const workflowRunStepOutputsRelations = relations(workflowRunStepsOutputs, ({ one }) => ({
  workflowRunStep: one(workflowRunSteps),
  file: one(workflowFiles),
}));

export const workflowRunStepMessagesRelations = relations(workflowRunStepMessages, ({ many, one }) => ({
  workflowRunStep: one(workflowRunSteps),
  documents: many(workflowRunStepMessagesDocuments),
  toolCalls: many(workflowRunStepToolCalls),
}));

export const workflowRunStepToolCallsRelations = relations(workflowRunStepToolCalls, ({ one }) => ({
  workflowRunStepMessage: one(workflowRunStepMessages),
}));

export const workflowRunStepMessagesDocumentsRelations = relations(workflowRunStepMessagesDocuments, ({ one }) => ({
  workflowRunStepMessage: one(workflowRunStepMessages),
  file: one(workflowFiles),
}));


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
