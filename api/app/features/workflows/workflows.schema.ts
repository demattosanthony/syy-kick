import { uuid, timestamp, pgTable, varchar, text } from "drizzle-orm/pg-core";
import { users, organizations } from "../../config/schema";
import { relations } from "drizzle-orm";

export const workflows = pgTable("workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  mastraId: varchar("mastra_id", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workflowOrganizations = pgTable("workflow_organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id")
    .references(() => workflows.id, { onDelete: "cascade" })
    .notNull(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const workflowUsers = pgTable("workflow_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id")
    .references(() => workflows.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  hexBgColor: varchar("bg_color", { length: 7 }).notNull(),
  hexTextColor: varchar("text_color", { length: 7 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type Tag = typeof tags.$inferSelect;

export const workflowRuns = pgTable("workflow_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id")
    .references(() => workflows.id, { onDelete: "cascade" })
    .notNull(),
  mastraRunId: varchar("mastra_run_id", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const workflowRunUsers = pgTable("workflow_run_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowRunId: uuid("workflow_run_id")
    .references(() => workflowRuns.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const workflowTags = pgTable("workflow_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id")
    .references(() => workflows.id, { onDelete: "cascade" })
    .notNull(),
  tagId: uuid("tag_id")
    .references(() => tags.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const workflowRunComments = pgTable("workflow_run_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowRunId: uuid("workflow_run_id")
    .references(() => workflowRuns.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  comment: text("comment").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const workflowRelations = relations(workflows, ({ many }) => ({
  organizations: many(workflowOrganizations),
  users: many(workflowUsers),
  runs: many(workflowRuns),
  tags: many(workflowTags),
}));

export const workflowTagsRelations = relations(workflowTags, ({ one }) => ({
  workflow: one(workflows, {
    fields: [workflowTags.workflowId],
    references: [workflows.id],
  }),
  tag: one(tags, {
    fields: [workflowTags.tagId],
    references: [tags.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  workflows: many(workflowTags),
}));

export const workflowOrganizationsRelations = relations(
  workflowOrganizations,
  ({ one }) => ({
    workflow: one(workflows, {
      fields: [workflowOrganizations.workflowId],
      references: [workflows.id],
    }),
    organization: one(organizations, {
      fields: [workflowOrganizations.organizationId],
      references: [organizations.id],
    }),
  })
);

export const workflowUsersRelations = relations(workflowUsers, ({ one }) => ({
  workflow: one(workflows, {
    fields: [workflowUsers.workflowId],
    references: [workflows.id],
  }),
  user: one(users, {
    fields: [workflowUsers.userId],
    references: [users.id],
  }),
}));

export const workflowRunRelations = relations(
  workflowRuns,
  ({ many, one }) => ({
    comments: many(workflowRunComments),
    users: many(workflowRunUsers),
    workflow: one(workflows, {
      fields: [workflowRuns.workflowId],
      references: [workflows.id],
    }),
  })
);

export const workflowRunCommentRelations = relations(
  workflowRunComments,
  ({ one }) => ({
    workflowRun: one(workflowRuns, {
      fields: [workflowRunComments.workflowRunId],
      references: [workflowRuns.id],
    }),
    user: one(users, {
      fields: [workflowRunComments.userId],
      references: [users.id],
    }),
  })
);

export const workflowRunUserRelations = relations(
  workflowRunUsers,
  ({ one }) => ({
    workflowRun: one(workflowRuns, {
      fields: [workflowRunUsers.workflowRunId],
      references: [workflowRuns.id],
    }),
    user: one(users, {
      fields: [workflowRunUsers.userId],
      references: [users.id],
    }),
  })
);
