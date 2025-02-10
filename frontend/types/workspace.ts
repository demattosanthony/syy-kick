export type Workspace = {
  id: string;
  name: string;
  type: "personal" | "organization";
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
};
