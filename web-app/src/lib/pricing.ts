export const PRICING_PLANS = {
  PRO: {
    name: "Pro",
    price: "$20",
    cost: 20,
    priceDetail: undefined,
    features: [
      "Chat with all the top AI models",
      "Upload images and PDFs",
      "Unlimited messages",
      "Priority support",
      "Custom integrations",
    ],
    lookup_key: "yo-pro-plan",
  },
  TEAMS: {
    name: "Team",
    price: "$30",
    cost: 30,
    priceDetail: "per seat/month",
    features: [
      "Everything in Pro",
      "Team collaboration features",
      "Admin dashboard",
      "Centralized billing",
    ],
    lookup_key: "yo-teams-plan",
  },
} as const;
