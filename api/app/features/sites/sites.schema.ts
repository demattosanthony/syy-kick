import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { users, organizations, projects } from "../../config/schema";
import { relations } from "drizzle-orm";

export const sites = pgTable("sites", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  description: text("description"),
  address: text("address").notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  state: varchar("state", { length: 100 }).notNull(),
  country: varchar("country", { length: 100 }).notNull(),
  postalCode: varchar("postal_code", { length: 20 }).notNull(),
  latitude: text("latitude"),
  longitude: text("longitude"),
  placeId: text("place_id"),
  organizationId: uuid("organization_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  userId: uuid("user_id").references(() => users.id, {
    onDelete: "cascade",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
});

export const sitesRelations = relations(sites, ({ one, many }) => ({
  projects: many(projects),
  organization: one(organizations),
  user: one(users),
}));
