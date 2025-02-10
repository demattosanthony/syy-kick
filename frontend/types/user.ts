export interface User {
  id: string;
  name: string;
  email: string;
  profilePicture: string;
  subscriptionStatus:
    | "active"
    | "inactive"
    | "canceled"
    | "incomplete"
    | "incomplete_expired"
    | "past_due"
    | "trialing"
    | "unpaid";
  subscriptionPlan?: "basic";
  stripeCustomerId?: string;
  systemRole?: "super_admin";
  organizationMembers?: {
    organization: Organization;
    role: "owner" | "member";
    id: string;
  }[];
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  seats: number;
  stripeCustomerId: string;
  subscriptionStatus:
    | "active"
    | "canceled"
    | "incomplete"
    | "incomplete_expired"
    | "past_due"
    | "trialing"
    | "unpaid";
  domain?: string;
  logo?: string;
  createdAt: string;
  updatedAt: string;
  logoUrl?: string;
  samlConfig?: {
    entryPoint: string;
    issuer: string;
    cert: string;
  };
}
