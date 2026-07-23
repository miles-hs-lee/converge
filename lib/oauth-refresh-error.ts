export type OAuthRefreshProvider = "microsoft" | "google";

export type OAuthRefreshFailure = {
  error: string;
  reauthRequired: boolean;
};

const REAUTH_ERROR_CODES = new Set([
  "consent_required",
  "interaction_required",
  "invalid_grant",
  "login_required"
]);

const MICROSOFT_REAUTH_CODES = new Set([
  "AADSTS50076",
  "AADSTS50078",
  "AADSTS50173",
  "AADSTS700082",
  "AADSTS700084"
]);

function readErrorPayload(rawBody: string): { code: string; description: string } {
  try {
    const parsed = JSON.parse(rawBody) as { error?: unknown; error_description?: unknown };
    return {
      code: typeof parsed.error === "string" ? parsed.error.trim().toLowerCase() : "unknown",
      description: typeof parsed.error_description === "string" ? parsed.error_description : ""
    };
  } catch {
    return { code: "unknown", description: "" };
  }
}

export function classifyOAuthRefreshFailure(provider: OAuthRefreshProvider, rawBody: string): OAuthRefreshFailure {
  const { code, description } = readErrorPayload(rawBody);
  const microsoftCode = description.match(/\bAADSTS\d+\b/i)?.[0]?.toUpperCase();
  const reauthRequired =
    REAUTH_ERROR_CODES.has(code) ||
    (provider === "microsoft" && Boolean(microsoftCode && MICROSOFT_REAUTH_CODES.has(microsoftCode)));
  const providerPrefix = provider === "microsoft" ? "ms" : "google";
  const normalizedCode = code.replace(/[^a-z0-9_-]/g, "").slice(0, 80);
  const reasonCode = microsoftCode ?? (normalizedCode || "unknown");

  return {
    error: `${providerPrefix}_refresh_failed:${reasonCode}`,
    reauthRequired
  };
}
