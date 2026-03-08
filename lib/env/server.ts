function getServerEnv(
  key:
    | "SUPABASE_SERVICE_ROLE_KEY"
    | "AZURE_CLIENT_ID"
    | "AZURE_CLIENT_SECRET"
    | "AZURE_TENANT_ID"
    | "AZURE_REDIRECT_URI"
): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env: ${key}`);
  }
  return value;
}

function getOptionalServerEnv(
  key:
    | "GOOGLE_CLIENT_ID"
    | "GOOGLE_CLIENT_SECRET"
    | "GOOGLE_REDIRECT_URI"
    | "POSTHOG_API_KEY"
    | "POSTHOG_HOST"
    | "VAPID_PUBLIC_KEY"
    | "VAPID_PRIVATE_KEY"
    | "VAPID_SUBJECT"
    | "CRON_SECRET"
    | "OAUTH_SECRETS_ENCRYPTION_KEY"
): string | undefined {
  const value = process.env[key];
  if (!value) {
    return undefined;
  }
  return value;
}

export const serverEnv = {
  supabaseServiceRoleKey: getServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
  azureClientId: getServerEnv("AZURE_CLIENT_ID"),
  azureClientSecret: getServerEnv("AZURE_CLIENT_SECRET"),
  azureTenantId: getServerEnv("AZURE_TENANT_ID"),
  azureRedirectUri: getServerEnv("AZURE_REDIRECT_URI"),
  googleClientId: getOptionalServerEnv("GOOGLE_CLIENT_ID"),
  googleClientSecret: getOptionalServerEnv("GOOGLE_CLIENT_SECRET"),
  googleRedirectUri: getOptionalServerEnv("GOOGLE_REDIRECT_URI"),
  posthogApiKey: getOptionalServerEnv("POSTHOG_API_KEY"),
  posthogHost: getOptionalServerEnv("POSTHOG_HOST"),
  vapidPublicKey: getOptionalServerEnv("VAPID_PUBLIC_KEY"),
  vapidPrivateKey: getOptionalServerEnv("VAPID_PRIVATE_KEY"),
  vapidSubject: getOptionalServerEnv("VAPID_SUBJECT"),
  cronSecret: getOptionalServerEnv("CRON_SECRET"),
  oauthSecretsEncryptionKey: getOptionalServerEnv("OAUTH_SECRETS_ENCRYPTION_KEY")
};
