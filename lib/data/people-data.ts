import { getRscSupabase } from "@/lib/server/request-context";

export const NON_GUEST_FILTER =
  "and(user_type.is.null,user_principal_name.is.null),and(user_type.is.null,user_principal_name.not.ilike.%23EXT%23),and(user_type.not.ilike.guest,user_principal_name.is.null),and(user_type.not.ilike.guest,user_principal_name.not.ilike.%23EXT%23)";

export type PeopleConnectionRecord = {
  id: string;
  provider: string | null;
  tenant_id: string | null;
  tenant_name: string | null;
  m365_user_principal_name: string | null;
};

export async function fetchPeopleSummaryData(): Promise<{
  connections: PeopleConnectionRecord[];
  totalPeopleCount: number;
  initialHasMore: boolean;
  resolvedRows: Array<Record<string, any>>;
}> {
  const supabase = await getRscSupabase();
  const { data: connectionRows } = await supabase.from("m365_connections").select("id,provider,tenant_id,tenant_name,m365_user_principal_name");
  const connections = (connectionRows ?? []) as PeopleConnectionRecord[];
  const connectionIds = connections.map((connection) => connection.id);

  if (connectionIds.length === 0) {
    return {
      connections,
      totalPeopleCount: 0,
      initialHasMore: false,
      resolvedRows: []
    };
  }

  const peopleSelectSummary =
    "id,external_person_id,display_name,mail,job_title,department,mobile_phone,business_phones,manager_external_id,user_principal_name,user_type,connection_id";
  const peopleSelectFallback =
    "id,external_person_id,display_name,mail,job_title,department,mobile_phone,business_phones,manager_external_id,raw,connection_id";

  const queryPeople = (selectText: string) =>
    supabase
      .from("people_cache")
      .select(selectText)
      .in("connection_id", connectionIds)
      .or(NON_GUEST_FILTER)
      .order("display_name", { ascending: true })
      .range(0, 80);

  const countQuery = supabase
    .from("people_cache")
    .select("id", { count: "planned", head: true })
    .in("connection_id", connectionIds)
    .or(NON_GUEST_FILTER);

  const [countResult, summaryPeople] = await Promise.all([countQuery, queryPeople(peopleSelectSummary)]);
  const totalPeopleCount = countResult.count ?? 0;

  let resolvedRows: Array<Record<string, any>> = [];
  if (summaryPeople.error) {
    const fallbackPeople = await queryPeople(peopleSelectFallback);
    resolvedRows = (fallbackPeople.data ?? []) as Array<Record<string, any>>;
  } else {
    resolvedRows = (summaryPeople.data ?? []) as Array<Record<string, any>>;
  }

  return {
    connections,
    totalPeopleCount,
    initialHasMore: resolvedRows.length > 80,
    resolvedRows
  };
}
