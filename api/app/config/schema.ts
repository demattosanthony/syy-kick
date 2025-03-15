import { or, relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
  vector,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { customType } from "drizzle-orm/pg-core";

const MESSAGE_ROLES = ["system", "user", "assistant", "tool"] as const;
const TOOL_CALL_STATUS = ["pending", "completed", "failed"] as const;
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
const IDENTITY_PROVIDER = ["google", "saml", "microsoft"] as const;
const DOCUMENT_TYPE = ["file", "folder"] as const;

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
  roleId: uuid("role_id").references(() => roles.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  invitedBy: uuid("invited_by").references(() => users.id, {
    onDelete: "cascade",
  }),
  token: text("token").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
export type Organization = typeof organizations.$inferSelect;

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
  microsoftId: varchar("microsoft_id", { length: 255 }).unique(),
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
export type User = typeof users.$inferSelect;

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  projectNumber: varchar("project_number", { length: 255 }),
  visibility: text("visibility", { enum: ["private", "public"] })
    .default("private")
    .notNull(),
  estimatedStartDate: timestamp("estimated_start_date"),
  estimatedEndDate: timestamp("estimated_end_date"),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  country: varchar("country", { length: 100 }),
  postalCode: varchar("postal_code", { length: 20 }),
  latitude: text("latitude"),
  longitude: text("longitude"),
  organizationId: uuid("organization_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  userId: uuid("user_id").references(() => users.id, {
    onDelete: "cascade",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type Project = typeof projects.$inferSelect;

export const documentEmbeddings = pgTable("document_embeddings", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  text: text("text"),
  metadata: jsonb("metadata"),
  embedding: vector("embedding", { dimensions: 768 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  fileHash: varchar("file_hash", { length: 255 }),
  type: text("type", { enum: DOCUMENT_TYPE }).notNull(),
  mimeType: varchar("mime_type", { length: 255 }),
  path: varchar("path", { length: 255 }).notNull(),
  fileKey: varchar("file_key", { length: 255 }),
  parentId: uuid("parent_id").references((): any => documents.id, {
    onDelete: "cascade",
  }),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "cascade",
  }),
  size: integer("size"), // size in bytes
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const documentProcessingJobs = pgTable("document_processing_jobs", {
  id: serial("id").primaryKey(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  fileKey: text("file_key").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  status: text("status", {
    enum: ["pending", "processing", "completed", "failed"],
  })
    .notNull()
    .default("pending"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow(),
  processAfter: timestamp("process_after").defaultNow(),
});

export const documentThumbnails = pgTable("document_thumbnails", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  fileKey: text("file_key").notNull(),
  pageNumber: integer("page_number"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export type DocumentThumbnail = typeof documentThumbnails.$inferSelect;

// Threads table with user association
export const threads = pgTable("threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  isPublic: boolean("is_public").default(false).notNull(),
  organizationId: uuid("organization_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "cascade",
  }),
});
export type Thread = typeof threads.$inferSelect;
export type ThreadWithRelations = Thread & {
  messages: Message[];
  project?: Project;
  organization?: Organization;
  user: User;
};

export const messageAttachments = pgTable("message_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["file", "image"] }).notNull(),
  fileKey: varchar("file_key", { length: 255 }).notNull(),
  fileName: varchar("file_name", { length: 255 }),
  mimeType: varchar("mime_type", { length: 255 }),
  size: integer("size"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Messages table with user association
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: MESSAGE_ROLES }).notNull(),
    text: text("text"),
    reasoning: text("reasoning"),
    model: text("model"),
    provider: text("provider"),
    embedding: vector("embedding", { dimensions: 1536 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("embeddingIndex").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops")
    ),
  ]
);
export type Message = typeof messages.$inferSelect;

// Tool calls table
export const toolCalls = pgTable("tool_calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  toolName: text("function_name").notNull(),
  toolCallId: text("tool_call_id").notNull(),
  args: jsonb("args"),
  status: text("status", { enum: TOOL_CALL_STATUS }).notNull(),
  result: jsonb("result"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** ---- Permissions ---- */
export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Organization, Project, Document, Message, User...
export const resources = pgTable("resources", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Create, Read, Update, Delete
export const actions = pgTable("actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// A permission is a combination of a role (org or project), resource, and action
export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgMemberRoleId: uuid("org_member_role_id").references(
      () => organizationMemberRoles.id,
      { onDelete: "cascade" }
    ),
    projectMemberRoleId: uuid("project_member_role_id").references(
      () => projectMemberRoles.id,
      { onDelete: "cascade" }
    ),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    actionId: uuid("action_id")
      .notNull()
      .references(() => actions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("unique_permission").on(
      table.orgMemberRoleId,
      table.projectMemberRoleId,
      table.resourceId,
      table.actionId
    ),
  ]
);

// Organization member roles
export const organizationMemberRoles = pgTable(
  "organization_member_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    organizationMemberId: uuid("organization_member_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("unique_org_member_role").on(
      table.organizationMemberId,
      table.roleId
    ),
  ]
);

// Project member roles
export const projectMemberRoles = pgTable(
  "project_member_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    projectId: uuid("project_id").notNull(),
    organizationId: uuid("organization_id").notNull(),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("unique_project_member_role").on(
      table.userId,
      table.projectId,
      table.roleId
    ),
  ]
);
/** ---- End Permissions ---- */

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  threads: many(threads),
  messages: many(messages),
  organizationMembers: many(organizationMembers),
  projects: many(projects),
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
  project: one(projects, {
    fields: [threads.projectId],
    references: [projects.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  parent: one(documents, {
    fields: [documents.parentId],
    references: [documents.id],
  }),
  children: many(documents),
  project: one(projects, {
    fields: [documents.projectId],
    references: [projects.id],
  }),
  processingJob: one(documentProcessingJobs, {
    fields: [documents.id],
    references: [documentProcessingJobs.documentId],
  }),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  thread: one(threads, {
    fields: [messages.threadId],
    references: [threads.id],
  }),
  user: one(users, {
    fields: [messages.userId],
    references: [users.id],
  }),
  attachments: many(messageAttachments),
  toolCalls: many(toolCalls),
}));

export const messageAttachmentsRelations = relations(
  messageAttachments,
  ({ one }) => ({
    message: one(messages, {
      fields: [messageAttachments.messageId],
      references: [messages.id],
    }),
  })
);

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
    role: one(roles, {
      fields: [organizationInvites.roleId],
      references: [roles.id],
    }),
    invitedBy: one(users, {
      fields: [organizationInvites.invitedBy],
      references: [users.id],
    }),
  })
);

export const samlConfigsRelations = relations(samlConfigs, ({ one }) => ({
  organization: one(organizations, {
    fields: [samlConfigs.organizationId],
    references: [organizations.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
}));

// Permissions relations
export const rolesRelations = relations(roles, ({ many }) => ({
  permissions: many(permissions),
  organizationMemberRoles: many(organizationMemberRoles),
  projectMemberRoles: many(projectMemberRoles),
}));
export const permissionsRelations = relations(permissions, ({ one }) => ({
  orgMemberRole: one(organizationMemberRoles, {
    fields: [permissions.orgMemberRoleId],
    references: [organizationMemberRoles.id],
  }),
  projectMemberRole: one(projectMemberRoles, {
    fields: [permissions.projectMemberRoleId],
    references: [projectMemberRoles.id],
  }),
  resource: one(resources, {
    fields: [permissions.resourceId],
    references: [resources.id],
  }),
  action: one(actions, {
    fields: [permissions.actionId],
    references: [actions.id],
  }),
}));

export const organizationMemberRolesRelations = relations(
  organizationMemberRoles,
  ({ one }) => ({
    role: one(roles, {
      fields: [organizationMemberRoles.roleId],
      references: [roles.id],
    }),
    user: one(users, {
      fields: [organizationMemberRoles.organizationMemberId],
      references: [users.id],
    }),
  })
);

export const projectMemberRolesRelations = relations(
  projectMemberRoles,
  ({ one }) => ({
    role: one(roles, {
      fields: [projectMemberRoles.roleId],
      references: [roles.id],
    }),
    project: one(projects, {
      fields: [projectMemberRoles.projectId],
      references: [projects.id],
    }),
    organization: one(organizations, {
      fields: [projectMemberRoles.organizationId],
      references: [organizations.id],
    }),
  })
);

export type MessageAttachment = {
  id: string;
  messageId: string;
  type: "file" | "image";
  fileKey: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  url?: string;
  createdAt: Date;
  updatedAt: Date;
};

// Response types
export type ApiResponse<T> = T | { error: string };
