import { Organization, User } from "./user";

export interface Project {
  id: string;
  name: string;
  description: string;
  organizationId: string;
  giteaRepoId: number;
  visibility: "private" | "public";
  createdAt: string;
  updatedAt: string;
  organization?: Organization;
  user?: User;
}

export interface ProjectContent {
  name: string;
  path: string;
  sha: string;
  lastModified: string;
  content: string;
  type: "file" | "dir";
}
