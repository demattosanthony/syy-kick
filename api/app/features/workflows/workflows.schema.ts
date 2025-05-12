import {
  uuid,
  timestamp,
  pgTable,
  varchar,
} from "drizzle-orm/pg-core";
import { users, organizations } from "../../config/schema";

export const workflows = pgTable("workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  mastraId: varchar("mastra_id", { length: 255 }).notNull(),
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