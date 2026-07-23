import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: true, needsReauth: false });
  }

  const { data } = await supabase
    .from("m365_connections")
    .select("status,sync_state")
    .eq("user_id", user.id);
  const needsReauth = (data ?? []).some((connection) => {
    if (connection.status === "revoked") {
      return true;
    }
    const syncState = connection.sync_state;
    if (!syncState || typeof syncState !== "object" || Array.isArray(syncState)) {
      return false;
    }
    const security = (syncState as Record<string, unknown>).security;
    return Boolean(
      security &&
        typeof security === "object" &&
        !Array.isArray(security) &&
        (security as Record<string, unknown>).reauthRequired === true
    );
  });
  return NextResponse.json({ ok: true, needsReauth });
}
