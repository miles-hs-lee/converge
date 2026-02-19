import { NextRequest, NextResponse } from "next/server";
import { syncAllUsers } from "@/lib/connection-sync";
import { serverEnv } from "@/lib/env/server";

function isAuthorized(request: NextRequest): boolean {
  const configured = serverEnv.cronSecret;
  if (!configured) {
    return process.env.NODE_ENV !== "production";
  }
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${configured}`;
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return jsonError("unauthorized", 401);
  }

  const summary = await syncAllUsers({
    mode: "calendar",
    calendarStaleMs: 1000 * 60 * 10,
    maxUsers: 200
  });

  return NextResponse.json({ ok: true, ...summary });
}
