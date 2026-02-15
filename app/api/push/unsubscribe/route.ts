import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError("auth_required", 401);
  }

  let body: { endpoint?: string } | null = null;
  try {
    body = (await request.json()) as { endpoint?: string };
  } catch {
    return jsonError("invalid_json");
  }

  const endpoint = body?.endpoint;
  if (!endpoint) {
    return jsonError("missing_endpoint");
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  if (error) {
    return jsonError("db_error", 500);
  }

  return NextResponse.json({ ok: true });
}

