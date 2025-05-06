/** Drizzle */
import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/** Schemas */
import { users } from "../../../config/schema";

export const workflowRequestInputs = pgTable("workflow_request_inputs", {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id").references(() => workflowRequests.id, {
        onDelete: "cascade",
    }),
    fileKey: varchar("file_key", { length: 255 }).notNull(),
    filename: varchar("filename", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workflowRequestStepsInputs = pgTable("workflow_request_steps_inputs", {
    id: uuid("id").primaryKey().defaultRandom(),
    stepId: uuid("step_id").references(() => workflowRequestSteps.id, {
        onDelete: "cascade",
    }),
    inputId: uuid("input_id").references(() => workflowRequestInputs.id, {
        onDelete: "cascade",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workflowRequestStepsDependsOn = pgTable("workflow_request_steps_depends_on", {
    id: uuid("id").primaryKey().defaultRandom(),
    stepId: uuid("step_id").references(() => workflowRequestSteps.id, {
        onDelete: "cascade",
    }),
    dependsOnId: uuid("depends_on_id").references(() => workflowRequestSteps.id, {
        onDelete: "cascade",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workflowRequestSteps = pgTable("workflow_request_steps", {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id").references(() => workflowRequests.id, {
        onDelete: "cascade",
    }),
    title: varchar("title", { length: 255 }).notNull(),
    details: text("details").notNull(),
    outputDescription: text("output_description").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workflowRequests = pgTable("workflow_requests", {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description").notNull(),
    requestedBy: uuid("requested_by").references(() => users.id, {
        onDelete: "cascade",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workflowRequestRelations = relations(workflowRequests, ({ many }) => ({
    steps: many(workflowRequestSteps),
    inputs: many(workflowRequestInputs),
    stepsInputs: many(workflowRequestStepsInputs),
    stepsDependsOn: many(workflowRequestStepsDependsOn),
}));

export const workflowRequestStepsRelations = relations(workflowRequestSteps, ({ many }) => ({
    inputs: many(workflowRequestStepsInputs),
    dependsOn: many(workflowRequestStepsDependsOn),
}));

export const workflowRequestInputsRelations = relations(workflowRequestInputs, ({ one }) => ({
    request: one(workflowRequests, {
        fields: [workflowRequestInputs.requestId],
        references: [workflowRequests.id],
    }),
}));

export const workflowRequestStepsInputsRelations = relations(workflowRequestStepsInputs, ({ one }) => ({
    step: one(workflowRequestSteps, {
        fields: [workflowRequestStepsInputs.stepId],
        references: [workflowRequestSteps.id],
    }),
    input: one(workflowRequestInputs, {
        fields: [workflowRequestStepsInputs.inputId],
        references: [workflowRequestInputs.id],
    }),
}));

export const workflowRequestStepsDependsOnRelations = relations(workflowRequestStepsDependsOn, ({ one }) => ({
    step: one(workflowRequestSteps, {
        fields: [workflowRequestStepsDependsOn.stepId],
        references: [workflowRequestSteps.id],
    }),
    dependsOn: one(workflowRequestSteps, {
        fields: [workflowRequestStepsDependsOn.dependsOnId],
        references: [workflowRequestSteps.id],
    }),
}));