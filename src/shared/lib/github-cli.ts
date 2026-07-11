export type GithubCliErrorType = "auth" | "cli" | "network" | "repo" | "unknown";

export interface GithubCliStatus {
  authenticated: boolean;
  cliAvailable: boolean;
  host: string;
  login: string | null;
  message: string;
}

export interface GithubCliErrorPayload {
  message: string;
  status: number | null;
  type: GithubCliErrorType;
}
