export type AccessToken = {
  id: string;
  accessToken: string;
  refreshToken: string;
  provider: "microsoft" | "google";
  type: "picker" | "graph";
  domain: string;
  createdAt: Date;
  updatedAt: Date;
};
