export type AccessTokenProvider = "google" | "microsoft";

export type Workspace = {
    id: string; // User ID or organization ID
    name: string;
    type: "personal" | "organization";
  };

export type StateEntry = {
    redirectUrl: string;
    expiresAt: number;
};