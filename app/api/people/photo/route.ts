import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env/server";
import { getMicrosoftScopeString, requiredMicrosoftGraphScopes } from "@/lib/microsoft";

type ConnectionTokenRow = {
  id: string;
  provider: string;
  access_token_enc: string;
  refresh_token_enc: string;
  token_expires_at: string;
  scopes: string[] | null;
};

function tokenStillValid(tokenExpiresAt: string): boolean {
  const expiresAt = Date.parse(tokenExpiresAt);
  if (!Number.isFinite(expiresAt)) {
    return false;
  }
  return expiresAt > Date.now() + 1000 * 60;
}

async function refreshMicrosoftAccessToken(supabase: Awaited<ReturnType<typeof createClient>>, connection: ConnectionTokenRow): Promise<string | null> {
  const mergedScopes = new Set<string>(connection.scopes?.length ? connection.scopes : getMicrosoftScopeString().split(" "));
  requiredMicrosoftGraphScopes.forEach((scope) => mergedScopes.add(scope));
  const scope = [...mergedScopes].join(" ");

  const response = await fetch(`https://login.microsoftonline.com/${serverEnv.azureTenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: serverEnv.azureClientId,
      client_secret: serverEnv.azureClientSecret,
      grant_type: "refresh_token",
      refresh_token: connection.refresh_token_enc,
      scope
    })
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  if (!payload.access_token) {
    return null;
  }

  const expiresIn = Number(payload.expires_in || 3600);
  const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  const scopes = (payload.scope ?? "").split(" ").filter(Boolean);

  await supabase
    .from("m365_connections")
    .update({
      access_token_enc: payload.access_token,
      refresh_token_enc: payload.refresh_token ?? connection.refresh_token_enc,
      token_expires_at: tokenExpiresAt,
      scopes: scopes.length > 0 ? scopes : connection.scopes ?? [],
      status: "active",
      updated_at: new Date().toISOString()
    })
    .eq("id", connection.id);

  return payload.access_token;
}

async function ensureMicrosoftAccessToken(supabase: Awaited<ReturnType<typeof createClient>>, connection: ConnectionTokenRow): Promise<string | null> {
  if (tokenStillValid(connection.token_expires_at) && connection.access_token_enc) {
    return connection.access_token_enc;
  }
  return refreshMicrosoftAccessToken(supabase, connection);
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  const personId = (new URL(request.url).searchParams.get("id") ?? "").trim();
  if (!personId) {
    return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });
  }

  const { data: person } = await supabase
    .from("people_cache")
    .select("id,connection_id,external_person_id,user_principal_name")
    .eq("id", personId)
    .maybeSingle();
  if (!person) {
    return NextResponse.json({ ok: false, error: "person_not_found" }, { status: 404 });
  }

  const { data: connection } = await supabase
    .from("m365_connections")
    .select("id,provider,access_token_enc,refresh_token_enc,token_expires_at,scopes")
    .eq("id", person.connection_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!connection || connection.provider !== "microsoft") {
    return NextResponse.json({ ok: false, error: "unsupported_provider" }, { status: 404 });
  }

  const accessToken = await ensureMicrosoftAccessToken(supabase, connection as ConnectionTokenRow);
  if (!accessToken) {
    return NextResponse.json({ ok: false, error: "token_unavailable" }, { status: 401 });
  }

  const targetUser = (person.external_person_id || person.user_principal_name || "").trim();
  if (!targetUser) {
    return NextResponse.json({ ok: false, error: "target_user_missing" }, { status: 404 });
  }

  const photoResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(targetUser)}/photo/$value`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "image/*" }
  });

  if (photoResponse.status === 404) {
    return NextResponse.json({ ok: false, error: "photo_not_found" }, { status: 404 });
  }
  if (!photoResponse.ok) {
    return NextResponse.json({ ok: false, error: "photo_fetch_failed" }, { status: photoResponse.status });
  }

  const bytes = await photoResponse.arrayBuffer();
  if (bytes.byteLength === 0) {
    return NextResponse.json({ ok: false, error: "photo_empty" }, { status: 404 });
  }

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": photoResponse.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "private, max-age=3600"
    }
  });
}
