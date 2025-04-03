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

// DB Schema

export const ISSUE_STATUS = ["open", "closed"] as const;

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
    pk: primaryKey({ columns: [table.issueId, table.userId] }), // Composite primary key
  })
);

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
