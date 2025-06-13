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

export {
  workflows,
  workflowOrganizations,
  workflowUsers,
  workflowRuns,
  workflowRunComments,
  workflowTags,
  tags,
  workflowRunCommentRelations,
  workflowRunRelations,
  workflowRelations,
  workflowTagsRelations,
  tagsRelations,
  workflowOrganizationsRelations,
  workflowUsersRelations,
  workflowRunUsers,
  workflowRunUserRelations,
} from "../features/workflows/workflows.schema";

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
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

// Users table with additional fields
export const users = pgTable("users", {
  id: uuid("id")
    .primaryKey()
    .default(sql`uuid_generate_v4()`),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  username: varchar("username", { length: 255 }),
  googleId: varchar("google_id", { length: 255 }).unique(),
  microsoftId: varchar("microsoft_id", { length: 255 }).unique(),
  identityProvider: text("identity_provider", {
    enum: IDENTITY_PROVIDER,
  }).default("google"),
  profilePicture: text("profile_picture"),
  refreshTokenVersion: integer("refresh_token_version").default(1).notNull(),
  lastActiveAt: timestamp("last_active_at").defaultNow(),
  sessionCount: integer("session_count").default(0).notNull(),
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

export const files = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size"),
  type: text("type", { enum: ["file", "folder"] }).notNull(),
  fileHash: varchar("file_hash", { length: 255 }),
  syyclops_path: text("syyclops_path"),
  sharepoint_path: text("sharepoint_path"),
  google_drive_path: text("google_drive_path"),
  file_origin_type: text("file_origin_type", {
    enum: ["syyclops", "sharepoint", "google_drive"],
  }).notNull(),
  category: text("category", {
    enum: ["drawing", "document"],
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userFiles = pgTable("user_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  fileId: uuid("file_id")
    .notNull()
    .references(() => files.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const filePages = pgTable("file_pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileId: uuid("file_id")
    .notNull()
    .references(() => files.id, { onDelete: "cascade" }),
  pageNumber: integer("page_number"), // Indexed at 1
  sheetName: text("sheet_name"),
});

export const filePageChunks = pgTable(
  "file_page_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    filePageId: uuid("file_page_id")
      .notNull()
      .references(() => filePages.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    position: integer("position"), // indexed at 0 and relative to the page
    embeddings: vector("embeddings", { dimensions: 1024 }),
  },
  (table) => [
    index("file_page_chunk_embeddings_index").using(
      "hnsw",
      table.embeddings.op("vector_cosine_ops")
    ),
  ]
);

export const filePageImages = pgTable(
  "file_page_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    filePageId: uuid("file_page_id")
      .notNull()
      .references(() => filePages.id, { onDelete: "cascade" }),
    chunkId: uuid("chunk_id").references(() => filePageChunks.id, {
      onDelete: "cascade",
    }),
    imagePath: text("image_path").notNull(),
    name: text("name"),
    embeddings: vector("embeddings", { dimensions: 1024 }),
  },
  (table) => [
    index("file_page_image_embeddings_index").using(
      "hnsw",
      table.embeddings.op("vector_cosine_ops")
    ),
  ]
);

export const messagesFiles = pgTable("messages_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  fileId: uuid("file_id")
    .notNull()
    .references(() => files.id, { onDelete: "cascade" }),
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
  isPublic: boolean("is_public").default(false).notNull(),
});
export type Thread = typeof threads.$inferSelect;
export type ThreadWithRelations = Thread & {
  messages: Message[];
  organization?: Organization;
  user: User;
};

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
    reasoningDurationSeconds: integer("reasoning_duration_seconds"),
    model: text("model"),
    provider: text("provider"),
    embedding: vector("embedding", { dimensions: 1536 }),
    status: text("status", {
      enum: ["streaming", "completed", "failed", "cancelled"],
    }).default("streaming"),
    error: text("error"),
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

// Organization, Document, Message, User...
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

// A permission is a combination of a role (org), resource, and action
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
  actionId: uuid("action_id")
    .references(() => actions.id, { onDelete: "cascade" })
    .notNull(),
  status: text("status", { enum: ["authorized", "unauthorized"] })
    .notNull()
    .default("authorized"),
  resourceId: uuid("resource_id")
    .references(() => resources.id, { onDelete: "cascade" })
    .notNull(),
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

export const logs = pgTable("logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  level: text("level", { enum: ["info", "error", "warn"] }).notNull(),
  message: text("message").notNull(),
  meta: jsonb("meta"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  threads: many(threads),
  messages: many(messages),
  organizationMembers: many(organizationMembers),
  accessTokens: many(accessTokens),
  userFiles: many(userFiles),
}));

export const threadsRelations = relations(threads, ({ one, many }) => ({
  user: one(users, {
    fields: [threads.userId],
    references: [users.id],
  }),
  messages: many(messages),
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
  files: many(messagesFiles),
  toolCalls: many(toolCalls),
}));

export const messagesFilesRelations = relations(messagesFiles, ({ one }) => ({
  message: one(messages, {
    fields: [messagesFiles.messageId],
    references: [messages.id],
  }),
  file: one(files, {
    fields: [messagesFiles.fileId],
    references: [files.id],
  }),
}));

export const toolCallsRelations = relations(toolCalls, ({ one }) => ({
  message: one(messages, {
    fields: [toolCalls.messageId],
    references: [messages.id],
  }),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  threads: many(threads),
}));

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
  action: one(actions, {
    fields: [accessLogs.actionId],
    references: [actions.id],
  }),
  resource: one(resources, {
    fields: [accessLogs.resourceId],
    references: [resources.id],
  }),
}));

export const accessTokensRelations = relations(accessTokens, ({ one }) => ({
  user: one(users, {
    fields: [accessTokens.userId],
    references: [users.id],
  }),
}));

export const filesRelations = relations(files, ({ one, many }) => ({
  pages: many(filePages),
  messages: many(messagesFiles),
  users: many(userFiles),
}));

export const filePagesRelations = relations(filePages, ({ one, many }) => ({
  file: one(files, {
    fields: [filePages.fileId],
    references: [files.id],
  }),
  chunks: many(filePageChunks),
  images: many(filePageImages),
}));

export const filePageChunksRelations = relations(
  filePageChunks,
  ({ one, many }) => ({
    page: one(filePages, {
      fields: [filePageChunks.filePageId],
      references: [filePages.id],
    }),
    images: many(filePageImages),
  })
);

export const filePageImagesRelations = relations(filePageImages, ({ one }) => ({
  page: one(filePages, {
    fields: [filePageImages.filePageId],
    references: [filePages.id],
  }),
  chunk: one(filePageChunks, {
    fields: [filePageImages.chunkId],
    references: [filePageChunks.id],
  }),
}));

export const userFilesRelations = relations(userFiles, ({ one }) => ({
  user: one(users, {
    fields: [userFiles.userId],
    references: [users.id],
  }),
  file: one(files, {
    fields: [userFiles.fileId],
    references: [files.id],
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
