/** Drizzle */
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  instructions: text("instructions"),
  model: varchar("model", { length: 255 }).notNull(),
  activeTools: text("active_tools").array(),
  requiredTools: text("required_tools").array(),
  formSchema: jsonb("form_schema"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
