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

export const serverEnv = {
  supabaseServiceRoleKey: getServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
  azureClientId: getServerEnv("AZURE_CLIENT_ID"),
  azureClientSecret: getServerEnv("AZURE_CLIENT_SECRET"),
  azureTenantId: getServerEnv("AZURE_TENANT_ID"),
  azureRedirectUri: getServerEnv("AZURE_REDIRECT_URI")
};
