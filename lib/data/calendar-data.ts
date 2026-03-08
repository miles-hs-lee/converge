import { getRscSupabase } from "@/lib/server/request-context";

export type CalendarConnectionRecord = {
  id: string;
  provider: string | null;
  tenant_name: string | null;
  m365_user_principal_name: string | null;
};

export type CalendarSourceRecord = {
  id: string;
  name: string;
  connection_id: string;
  is_selected: boolean;
};

type FetchCalendarWindowDataParams = {
  fromIso: string;
  toIso: string;
  eventSelectSummary: string;
  eventSelectFallback: string;
  eventLimit?: number;
};

export async function fetchCalendarWindowData(params: FetchCalendarWindowDataParams): Promise<{
  connections: CalendarConnectionRecord[];
  sourceRows: CalendarSourceRecord[];
  eventRows: Array<Record<string, any>>;
}> {
  const supabase = await getRscSupabase();
  const eventLimit = params.eventLimit ?? 500;

  const { data: connectionRows } = await supabase.from("m365_connections").select("id,provider,tenant_name,m365_user_principal_name");
  const connections = (connectionRows ?? []) as CalendarConnectionRecord[];
  const connectionIds = connections.map((connection) => connection.id);

  if (connectionIds.length === 0) {
    return { connections, sourceRows: [], eventRows: [] };
  }

  const { data: sourceRowsRaw } = await supabase
    .from("calendar_sources")
    .select("id,name,connection_id,is_selected")
    .in("connection_id", connectionIds);
  const sourceRows = (sourceRowsRaw ?? []) as CalendarSourceRecord[];
  const selectedSourceIds = sourceRows.filter((source) => source.is_selected).map((source) => source.id);

  if (selectedSourceIds.length === 0) {
    return { connections, sourceRows, eventRows: [] };
  }

  const queryEvents = (selectText: string) =>
    supabase
      .from("calendar_events_cache")
      .select(selectText)
      .lte("start_at", params.toIso)
      .gte("end_at", params.fromIso)
      .order("start_at", { ascending: true })
      .limit(eventLimit)
      .in("connection_id", connectionIds)
      .in("calendar_source_id", selectedSourceIds);

  const summaryResult = await queryEvents(params.eventSelectSummary);
  const fallbackResult = summaryResult.error ? await queryEvents(params.eventSelectFallback) : null;

  const eventRows = ((fallbackResult?.data ?? summaryResult.data ?? []) as Array<Record<string, any>>);
  return { connections, sourceRows, eventRows };
}
