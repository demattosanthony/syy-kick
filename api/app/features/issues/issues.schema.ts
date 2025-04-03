import {
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { projects, users } from "../../config/schema";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const ISSUE_STATUS = ["open", "closed"] as const;

// DB Schema
export const issues = pgTable("issues", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  creatorId: uuid("creator_id")
    .notNull()
    .references(() => users.id, { onDelete: "set null" }), // Keep issue even if creator deleted
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: text("status", { enum: ISSUE_STATUS }).default("open").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type Issue = typeof issues.$inferSelect;

export const issueAssignees = pgTable(
  "issue_assignees",
  {
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  },
  (table) => ({
    // Define composite primary key using the callback syntax
    pk: primaryKey({
      name: "issue_assignees_pk",
      columns: [table.issueId, table.userId],
    }),
  })
);

export const issuesRelations = relations(issues, ({ one, many }) => ({
  // Relation: Issue -> Creator (User)
  creator: one(users, {
    fields: [issues.creatorId],
    references: [users.id],
  }),
  // Relation: Issue -> Project
  project: one(projects, {
    fields: [issues.projectId],
    references: [projects.id],
  }),
  // Relation: Issue -> IssueAssignees (Join Table Records)
  // Renamed 'assigneeLinks' to 'assignees' to match the query in issue.ops.ts
  assignees: many(issueAssignees),
  // Relation: Issue -> Comments
  comments: many(issueComments),
}));

export const issueAssigneesRelations = relations(issueAssignees, ({ one }) => ({
  // Relation: IssueAssignee -> Issue
  issue: one(issues, {
    fields: [issueAssignees.issueId],
    references: [issues.id],
  }),
  // Relation: IssueAssignee -> User
  user: one(users, {
    fields: [issueAssignees.userId],
    references: [users.id],
  }),
}));

export const issueComments = pgTable("issue_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  issueId: uuid("issue_id")
    .notNull()
    .references(() => issues.id, { onDelete: "cascade" }),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "set null" }), // Keep comment even if author deleted
  comment: text("comment").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const issueCommentsRelations = relations(issueComments, ({ one }) => ({
  // Relation: IssueComment -> Issue
  issue: one(issues, {
    fields: [issueComments.issueId],
    references: [issues.id],
  }),
  // Relation: IssueComment -> Author (User)
  author: one(users, {
    fields: [issueComments.authorId],
    references: [users.id],
  }),
}));

// Validation Schemas
export const createIssueSchema = z.object({
  projectId: z.string().uuid(),
  creatorId: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
});

export const updateIssueSchema = z.object({
  issueId: z.string(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  status: z.enum(ISSUE_STATUS).optional(),
});
