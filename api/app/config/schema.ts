import { relations, sql } from "drizzle-orm";
import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { customType } from "drizzle-orm/pg-core";

const MESSAGE_ROLES = ["system", "user", "assistant", "tool"] as const;
const TOOL_CALL_STATUS = ["pending", "completed", "failed"] as const;
const CONTENT_TYPES = ["text", "image", "file"] as const;
const SUBSCRIPTION_STATUS = [
  "active",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "past_due",
  "trialing",
  "unpaid",
] as const;
const SUBSCRIPTION_PLAN = ["free", "pro", "teams", "enterprise"] as const;
const IDENTITY_PROVIDER = ["google", "saml"] as const;

// Custom type for bytea columns (pgcrypto extension)
export const bytea = customType<{
  data: Buffer;
}>({
  dataType() {
    return "bytea";
  },
});

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }),
  slug: varchar("slug", { length: 255 }).unique(), // for subdomains or URLs
  domain: varchar("domain", { length: 255 }), // for email matching & auto-assignment
  logo: varchar("logo", { length: 255 }), // file key for s3
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }).unique(),
  subscriptionStatus: text("subscription_status", {
    enum: SUBSCRIPTION_STATUS,
  }).default("incomplete"),
  seats: integer("seats").default(0),
});

export const organizationMembers = pgTable("organization_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["owner", "member"] }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const organizationInvites = pgTable("organization_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  token: text("token").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const samlConfigs = pgTable("saml_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  entryPoint: bytea("entry_point").notNull(),
  issuer: bytea("issuer").notNull(),
  cert: bytea("cert").notNull(),
  callbackUrl: text("callback_url").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Users table with additional fields
export const users = pgTable("users", {
  id: uuid("id")
    .primaryKey()
    .default(sql`uuid_generate_v4()`),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  googleId: varchar("google_id", { length: 255 }).unique(),
  identityProvider: text("identity_provider", {
    enum: IDENTITY_PROVIDER,
  }).default("google"),
  profilePicture: text("profile_picture"),
  refreshTokenVersion: integer("refresh_token_version").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }).unique(),
  subscriptionStatus: text("subscription_status", {
    enum: SUBSCRIPTION_STATUS,
  }).default("incomplete"),
  subscriptionPlan: text("subscription_plan", {
    enum: SUBSCRIPTION_PLAN,
  }).default("free"),
  systemRole: text("system_role", { enum: ["super_admin"] }), // identify system super admins
});

// Threads table with user association
export const threads = pgTable("threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  organizationId: uuid("organization_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
});

// Messages table with user association
export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  threadId: uuid("thread_id")
    .notNull()
    .references(() => threads.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: MESSAGE_ROLES }).notNull(),
  content: jsonb("content").notNull(),
  reasoning: text("reasoning"),
  model: text("model"),
  provider: text("provider"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tool calls table
export const toolCalls = pgTable("tool_calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  functionName: text("function_name").notNull(),
  functionArguments: text("function_arguments"),
  status: text("status", { enum: TOOL_CALL_STATUS }).notNull(),
  result: text("result"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  threads: many(threads),
  messages: many(messages),
  organizationMembers: many(organizationMembers),
}));

export const threadsRelations = relations(threads, ({ one, many }) => ({
  user: one(users, {
    fields: [threads.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [threads.organizationId],
    references: [organizations.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  thread: one(threads, {
    fields: [messages.threadId],
    references: [threads.id],
  }),
  user: one(users, {
    fields: [messages.userId],
    references: [users.id],
  }),
}));

export const toolCallsRelations = relations(toolCalls, ({ one }) => ({
  message: one(messages, {
    fields: [toolCalls.messageId],
    references: [messages.id],
  }),
}));

export const organizationsRelations = relations(
  organizations,
  ({ many, one }) => ({
    members: many(organizationMembers),
    threads: many(threads),
    samlConfig: one(samlConfigs),
  })
);

export const organizationMembersRelations = relations(
  organizationMembers,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationMembers.organizationId],
      references: [organizations.id],
    }),
    user: one(users, {
      fields: [organizationMembers.userId],
      references: [users.id],
    }),
  })
);

export const organizationInvitesRelations = relations(
  organizationInvites,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationInvites.organizationId],
      references: [organizations.id],
    }),
  })
);

export const samlConfigsRelations = relations(samlConfigs, ({ one }) => ({
  organization: one(organizations, {
    fields: [samlConfigs.organizationId],
    references: [organizations.id],
  }),
}));

// Types
type BaseContentPart = {
  type: (typeof CONTENT_TYPES)[number];
};

type TextContent = BaseContentPart & {
  type: "text";
  text: string;
};

export type FileContent = BaseContentPart & {
  type: "file" | "image";
  data?: string;
  image?: string;
  file_metadata: {
    filename: string;
    mime_type: string;
    file_key: string;
    size?: number;
  };
};

export type ContentPart = TextContent | FileContent;

// Response types
export type ApiResponse<T> = T | { error: string };
