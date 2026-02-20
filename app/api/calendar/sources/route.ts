import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Payload = {
  sourceId?: string;
  isSelected?: boolean;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  let body: Payload;
  try {
    body = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const sourceId = (body.sourceId ?? "").trim();
  const isSelected = body.isSelected;
  if (!sourceId || typeof isSelected !== "boolean") {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("calendar_sources")
    .update({ is_selected: isSelected, last_synced_at: new Date().toISOString() })
    .eq("id", sourceId)
    .select("id,is_selected")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: "source_update_failed" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, item: data });
}
