/** Drizzle */
import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

/** Schema */
import { workflowSteps } from "../../workflows.schema";

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  instructions: text("instructions"),
  model: varchar("model", { length: 255 }).notNull(),
  activeTools: text("active_tools").array(),
  requiredTools: text("required_tools").array(),
  formSchema: jsonb("form_schema"),
  type: varchar("type", { length: 255 }).notNull(), // Mechanical, Electrical, Plumbing, ? etc...
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const agentTags = pgTable("agent_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").references(() => agents.id),
  tag: varchar("tag", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const agentRelations = relations(agents, ({ many }) => ({
  steps: many(workflowSteps),
  tags: many(agentTags),
}));

export const agentTagsRelations = relations(agentTags, ({ one }) => ({
  agent: one(agents),
}));
