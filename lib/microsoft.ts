export const microsoftScopes = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "User.Read",
  "User.Read.All",
  "Calendars.Read",
  "Calendars.Read.Shared",
  "User.ReadBasic.All"
] as const;

export const requiredMicrosoftGraphScopes = ["User.Read", "User.Read.All", "Calendars.Read", "Calendars.Read.Shared"] as const;

export function getMicrosoftScopeString(): string {
  return microsoftScopes.join(" ");
}

export function decodeJwtPayload<T>(token: string): T | null {
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    const payload = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(payload) as T;
  } catch {
    return null;
  }
}
