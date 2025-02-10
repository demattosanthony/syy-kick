export interface Project {
  id: string;
  name: string;
  description: string;
  organizationId: string;
  giteaRepoId: number;
  visibility: "private" | "public";
  createdAt: string;
  updatedAt: string;
}
