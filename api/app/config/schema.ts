import { relations, sql } from "drizzle-orm";
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
import { sites } from "../features/sites/sites.schema";

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

export { sites, sitesRelations } from "../features/sites/sites.schema";
export {
  issues,
  issueAssignees,
  issueComments,
  issueAssigneesRelations,
  issuesRelations,
  issueCommentsRelations,
} from "../features/projects/issues/issues.schema";

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
  username: varchar("username", { length: 255 }),
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
  slug: varchar("slug", { length: 255 }),
  projectNumber: varchar("project_number", { length: 255 }),
  visibility: text("visibility", { enum: ["private", "public"] })
    .default("private")
    .notNull(),
  estimatedStartDate: timestamp("estimated_start_date"),
  estimatedEndDate: timestamp("estimated_end_date"),
  siteId: uuid("site_id").references(() => sites.id, { onDelete: "cascade" }),
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
  contextualSummary: text("contextual_summary"),
  metadata: jsonb("metadata"),
  type: text("type", { enum: ["text", "image"] }),
  imageFileKey: text("image_file_key"),
  embedding: vector("embedding", { dimensions: 768 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type DocumentEmbedding = typeof documentEmbeddings.$inferSelect;

export const documents = pgTable(
  "documents",
  {
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
    knowledgeBaseId: uuid("knowledge_base_id").references(
      () => knowledgeBases.id,
      {
        onDelete: "cascade",
      }
    ),
    size: integer("size"), // size in bytes
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // Ensure a document belongs to either a project OR a knowledge base, not both
    sql`CONSTRAINT project_or_knowledge_base CHECK ((project_id IS NOT NULL AND knowledge_base_id IS NULL) OR (project_id IS NULL AND knowledge_base_id IS NOT NULL))`,
  ]
);
export type Document = typeof documents.$inferSelect;

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
  knowledgeBaseId: uuid("knowledge_base_id").references(
    () => knowledgeBases.id,
    { onDelete: "cascade" }
  ),
  workflowId: text("workflow_id"),
});
export type Thread = typeof threads.$inferSelect;
export type ThreadWithRelations = Thread & {
  messages: Message[];
  project?: Project;
  organization?: Organization;
  knowledgeBase?: KnowledgeBase;
  user: User;
};

export const messageAttachments = pgTable("message_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["file", "image", "markdown"] }).notNull(),
  fileKey: varchar("file_key", { length: 255 }).notNull(),
  fileName: varchar("file_name", { length: 255 }),
  mimeType: varchar("mime_type", { length: 255 }),
  size: integer("size"),
  markdown: text("markdown"),
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

export const knowledgeBases = pgTable(
  "knowledge_bases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }), // Optional
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
    }), // Optional
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // Ensure a knowledge base belongs to either a user OR an organization, not both
    sql`CONSTRAINT user_or_organization CHECK ((user_id IS NOT NULL AND organization_id IS NULL) OR (user_id IS NULL AND organization_id IS NOT NULL))`,
  ]
);
export type KnowledgeBase = typeof knowledgeBases.$inferSelect;

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
    memberRoleId: uuid("member_role_id")
      .notNull()
      .references(() => memberRoles.id, { onDelete: "cascade" }),
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
      table.memberRoleId,
      table.resourceId,
      table.actionId
    ),
  ]
);

export const memberRoles = pgTable("member_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "cascade",
  }),
  organizationId: uuid("organization_id")
    .references(() => organizations.id, {
      onDelete: "cascade",
    })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  roleId: uuid("role_id")
    .references(() => roles.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const accessLogs = pgTable("access_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  organizationId: uuid("organization_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "cascade",
  }),
  documentId: uuid("document_id").references(() => documents.id, {
    onDelete: "cascade",
  }),
  knowledgeBaseId: uuid("knowledge_base_id").references(
    () => knowledgeBases.id,
    {
      onDelete: "cascade",
    }
  ),
  actionId: uuid("action_id")
    .references(() => actions.id, { onDelete: "cascade" })
    .notNull(),
  status: text("status", { enum: ["authorized", "unauthorized"] })
    .notNull()
    .default("authorized"),
  resourceId: uuid("resource_id")
    .references(() => resources.id, { onDelete: "cascade" })
    .notNull(),
  siteId: uuid("site_id").references(() => sites.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** ---- End Permissions ---- */

export const accessTokens = pgTable("access_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  provider: text("provider", { enum: ["google", "microsoft"] }).notNull(),
  domain: text("domain"),
  type: text("type", { enum: ["picker", "graph"] }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  threads: many(threads),
  messages: many(messages),
  organizationMembers: many(organizationMembers),
  projects: many(projects),
  knowledgeBases: many(knowledgeBases),
  accessTokens: many(accessTokens),
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
  knowledgeBase: one(knowledgeBases, {
    fields: [threads.knowledgeBaseId],
    references: [knowledgeBases.id],
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
    sites: many(sites),
    knowledgeBases: many(knowledgeBases),
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
  site: one(sites, {
    fields: [projects.siteId],
    references: [sites.id],
  }),
}));

export const knowledgeBasesRelations = relations(
  knowledgeBases,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [knowledgeBases.organizationId],
      references: [organizations.id],
    }),
    user: one(users, {
      fields: [knowledgeBases.userId],
      references: [users.id],
    }),
    createdBy: one(users, {
      fields: [knowledgeBases.createdBy],
      references: [users.id],
    }),
    documents: many(documents),
    threads: many(threads),
  })
);

// Permissions relations
export const rolesRelations = relations(roles, ({ many }) => ({
  permissions: many(permissions),
  memberRoles: many(memberRoles),
}));
export const permissionsRelations = relations(permissions, ({ one }) => ({
  memberRole: one(memberRoles, {
    fields: [permissions.memberRoleId],
    references: [memberRoles.id],
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

export const memberRolesRelations = relations(memberRoles, ({ one, many }) => ({
  project: one(projects, {
    fields: [memberRoles.projectId],
    references: [projects.id],
  }),
  organization: one(organizations, {
    fields: [memberRoles.organizationId],
    references: [organizations.id],
  }),
  member: one(users, {
    fields: [memberRoles.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [memberRoles.roleId],
    references: [roles.id],
  }),
  permissions: many(permissions),
}));

export const accessLogsRelations = relations(accessLogs, ({ one }) => ({
  user: one(users, {
    fields: [accessLogs.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [accessLogs.organizationId],
    references: [organizations.id],
  }),
  project: one(projects, {
    fields: [accessLogs.projectId],
    references: [projects.id],
  }),
  document: one(documents, {
    fields: [accessLogs.documentId],
    references: [documents.id],
  }),
  action: one(actions, {
    fields: [accessLogs.actionId],
    references: [actions.id],
  }),
  resource: one(resources, {
    fields: [accessLogs.resourceId],
    references: [resources.id],
  }),
  site: one(sites, {
    fields: [accessLogs.siteId],
    references: [sites.id],
  }),
  knowledgeBase: one(knowledgeBases, {
    fields: [accessLogs.knowledgeBaseId],
    references: [knowledgeBases.id],
  }),
}));

export const accessTokensRelations = relations(accessTokens, ({ one }) => ({
  user: one(users, {
    fields: [accessTokens.userId],
    references: [users.id],
  }),
}));

export type MessageAttachment = {
  id: string;
  messageId: string;
  type: "file" | "image" | "markdown";
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
