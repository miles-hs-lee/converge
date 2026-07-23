import { getRscSupabase, getRscUser } from "@/lib/server/request-context";

export type SettingsConnectionRecord = {
  id: string;
  provider: string;
  tenant_name: string | null;
  m365_user_principal_name: string | null;
  status: string;
  token_expires_at: string;
  scopes: string[] | null;
  sync_state: Record<string, unknown> | null;
};

export type SessionLoginTimestamps = {
  lastLoginAt: string | null;
  prevLoginAt: string | null;
};

export async function fetchSettingsPageData(): Promise<{
  user: Awaited<ReturnType<typeof getRscUser>>;
  connections: SettingsConnectionRecord[];
  sessionLogins: SessionLoginTimestamps;
}> {
  const supabase = await getRscSupabase();
  const user = await getRscUser();

  if (!user) {
    return {
      user: null,
      connections: [],
      sessionLogins: { lastLoginAt: null, prevLoginAt: null }
    };
  }

  const [connectionsResult, appUserResult] = await Promise.all([
    supabase
      .from("m365_connections")
      .select("id,provider,tenant_name,m365_user_principal_name,status,token_expires_at,scopes,sync_state")
      .order("updated_at", { ascending: false }),
    supabase.from("app_users").select("last_login_at,prev_login_at").eq("id", user.id).maybeSingle()
  ]);

  return {
    user,
    connections: (connectionsResult.data ?? []) as SettingsConnectionRecord[],
    sessionLogins: {
      lastLoginAt: appUserResult.data?.last_login_at ?? null,
      prevLoginAt: appUserResult.data?.prev_login_at ?? null
    }
  };
}
