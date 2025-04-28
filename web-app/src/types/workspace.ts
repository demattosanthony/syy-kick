
export type WorkspaceProject = {
  id: string;
  name: string;
  slug: string;
};

export type WorkspaceSite = {
  id: string;
  address: string;
  projects: WorkspaceProject[];
};

export type Workspace = {
  id: string;
  name: string;
  type: "personal" | "organization";
  slug: string;
  logo?: string;
  subscriptionPlan?: string;
  subscriptionStatus?:
    | "active"
    | "canceled"
    | "incomplete"
    | "incomplete_expired"
    | "past_due"
    | "trialing"
    | "unpaid";
  sites: WorkspaceSite[];
};
