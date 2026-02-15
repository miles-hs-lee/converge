export const googleScopes = ["openid", "profile", "email", "https://www.googleapis.com/auth/calendar.readonly"] as const;

export function getGoogleScopeString(): string {
  return googleScopes.join(" ");
}
