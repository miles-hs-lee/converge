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

type ServerEnv = {
  readonly supabaseServiceRoleKey: string;
  readonly azureClientId: string;
  readonly azureClientSecret: string;
  readonly azureTenantId: string;
  readonly azureRedirectUri: string;
  readonly googleClientId: string | undefined;
  readonly googleClientSecret: string | undefined;
  readonly googleRedirectUri: string | undefined;
  readonly posthogApiKey: string | undefined;
  readonly posthogHost: string | undefined;
  readonly vapidPublicKey: string | undefined;
  readonly vapidPrivateKey: string | undefined;
  readonly vapidSubject: string | undefined;
  readonly cronSecret: string | undefined;
  readonly oauthSecretsEncryptionKey: string | undefined;
};

export const serverEnv: ServerEnv = {
  get supabaseServiceRoleKey() {
    return getServerEnv("SUPABASE_SERVICE_ROLE_KEY");
  },
  get azureClientId() {
    return getServerEnv("AZURE_CLIENT_ID");
  },
  get azureClientSecret() {
    return getServerEnv("AZURE_CLIENT_SECRET");
  },
  get azureTenantId() {
    return getServerEnv("AZURE_TENANT_ID");
  },
  get azureRedirectUri() {
    return getServerEnv("AZURE_REDIRECT_URI");
  },
  get googleClientId() {
    return getOptionalServerEnv("GOOGLE_CLIENT_ID");
  },
  get googleClientSecret() {
    return getOptionalServerEnv("GOOGLE_CLIENT_SECRET");
  },
  get googleRedirectUri() {
    return getOptionalServerEnv("GOOGLE_REDIRECT_URI");
  },
  get posthogApiKey() {
    return getOptionalServerEnv("POSTHOG_API_KEY");
  },
  get posthogHost() {
    return getOptionalServerEnv("POSTHOG_HOST");
  },
  get vapidPublicKey() {
    return getOptionalServerEnv("VAPID_PUBLIC_KEY");
  },
  get vapidPrivateKey() {
    return getOptionalServerEnv("VAPID_PRIVATE_KEY");
  },
  get vapidSubject() {
    return getOptionalServerEnv("VAPID_SUBJECT");
  },
  get cronSecret() {
    return getOptionalServerEnv("CRON_SECRET");
  },
  get oauthSecretsEncryptionKey() {
    return getOptionalServerEnv("OAUTH_SECRETS_ENCRYPTION_KEY");
  }
};
