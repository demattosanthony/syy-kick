export type Role = "owner" | "member";
export type AccessLogStatus = "authorized" | "unauthorized";
export interface SamlConfig {
  entryPoint?: string;
  issuer?: string;
  cert?: string;
  callbackUrl?: string;
}
