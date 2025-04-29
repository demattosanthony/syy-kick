import {
  uuid,
  varchar,
  timestamp,
  text,
  jsonb,
  pgTable,
} from "drizzle-orm/pg-core";
import { documents } from "../../config/schema";

export const workflows = pgTable("workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workflowSteps = pgTable("workflow_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  instructions: text("instructions"),
  model: varchar("model", { length: 255 }).notNull(),
  activeTools: text("active_tools").array(),
  formSchema: jsonb("form_schema"), // the user can refer to previous steps outputs or user inputs
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workflowRuns = pgTable("workflow_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id").references(() => workflows.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workflowRunSteps = pgTable("workflow_run_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowRunId: uuid("workflow_run_id").references(() => workflowRuns.id),
  workflowStepId: uuid("workflow_step_id").references(() => workflowSteps.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workflowRunStepsFilesOutputs = pgTable(
  "workflow_run_steps_files_outputs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowRunStepId: uuid("workflow_run_step_id").references(
      () => workflowRunSteps.id
    ),
    fileId: uuid("file_id").references(() => documents.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  }
);

export const workflowRunStepsArgs = pgTable("workflow_run_steps_args", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowRunStepId: uuid("workflow_run_step_id").references(
    () => workflowRunSteps.id
  ),
  parentStepId: uuid("parent_step_id").references(() => workflowRunSteps.id), // step output files
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workflowRunStepsArgsInputsFiles = pgTable(
  "workflow_run_steps_args_inputs_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowRunStepId: uuid("workflow_run_step_id").references(
      () => workflowRunSteps.id
    ),
    documentId: uuid("document_id").references(() => documents.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  }
);

export const workflowRunStepMessages = pgTable("workflow_run_step_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowRunStepId: uuid("workflow_run_step_id").references(
    () => workflowRunSteps.id
  ),
  documentId: uuid("document_id").references(() => documents.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Equipments serving list
/**
 * Before running the workflow, we need to:
 * 1: insert 3 steps: pageExtractionAgent, tableExtractionAgent, csvGenerationAgent
 *
 * 2: for each step the user will have to fill a form
 * If the step has a file input, the user can refer to previous steps outputs (if it's not the first step) or user inputs
 * For now we would have :
 * instructions: text
 * model: text
 * activeTools: id[]
 *
 *
 * 3: insert the user input file
 *
 * 4: insert the 3 steps args
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
