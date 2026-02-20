import { createClient } from "@/lib/supabase/server";
import { isMockMode } from "@/lib/mock-mode";
import { mockPeople } from "@/lib/mock-data";
import { PeopleSearchPanel } from "@/components/people-search-panel";
import { getServerLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

const NON_GUEST_FILTER =
  "and(user_type.is.null,user_principal_name.is.null),and(user_type.is.null,user_principal_name.not.ilike.%23EXT%23),and(user_type.not.ilike.guest,user_principal_name.is.null),and(user_type.not.ilike.guest,user_principal_name.not.ilike.%23EXT%23)";

type PersonRow = {
  id: string;
  displayName: string;
  mail: string;
  jobTitle: string;
  department: string;
  tenantName: string;
  officeLocation: string;
  mobilePhone: string;
  businessPhones: string[];
  sourceAccount: string;
  provider: string;
  upn: string;
  externalPersonId: string;
  managerExternalId: string;
  companyName: string;
  employeeId: string;
  preferredLanguage: string;
  city: string;
  state: string;
  country: string;
  userType: string;
  accountEnabled: boolean | null;
  detailLoaded?: boolean;
};

export default async function PeoplePage() {
  const locale = await getServerLocale();
  const tt = (key: Parameters<typeof t>[1], vars?: Parameters<typeof t>[2]) => t(locale, key, vars);

  let people: PersonRow[] = [];
  let totalPeopleCount = 0;
  let serverSearchEnabled = false;
  let initialHasMore = false;

  if (isMockMode) {
    people = mockPeople;
    totalPeopleCount = mockPeople.length;
  } else {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (user) {
      serverSearchEnabled = true;
      const { data: connections } = await supabase.from("m365_connections").select("id,provider,tenant_name,m365_user_principal_name");
      const connectionIds = (connections ?? []).map((connection) => connection.id);

      if (connectionIds.length > 0) {
        const countQuery = supabase
          .from("people_cache")
          .select("id", { count: "planned", head: true })
          .in("connection_id", connectionIds)
          .or(NON_GUEST_FILTER);
        const { count } = await countQuery;
        totalPeopleCount = count ?? 0;
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

      const tenantByConnection = new Map<string, string>();
      const sourceByConnection = new Map<string, string>();
      const providerByConnection = new Map<string, string>();
      (connections ?? []).forEach((connection) => {
        tenantByConnection.set(connection.id, connection.tenant_name ?? "Connected Tenant");
        sourceByConnection.set(connection.id, connection.m365_user_principal_name ?? "");
        providerByConnection.set(connection.id, connection.provider ?? "microsoft");
      });

      let resolvedRows: Array<Record<string, any>> = [];
      if (connectionIds.length > 0) {
        const summaryPeople = await queryPeople(peopleSelectSummary);
        if (summaryPeople.error) {
          const fallbackPeople = await queryPeople(peopleSelectFallback);
          resolvedRows = (fallbackPeople.data ?? []) as Array<Record<string, any>>;
        } else {
          resolvedRows = (summaryPeople.data ?? []) as Array<Record<string, any>>;
        }
      }

      initialHasMore = resolvedRows.length > 80;
      const initialRows = initialHasMore ? resolvedRows.slice(0, 80) : resolvedRows;

      people = initialRows.map((person) => ({
        id: person.id,
        displayName: person.display_name,
        mail: person.mail ?? "",
        jobTitle: person.job_title ?? tt("people.unknown.jobTitle"),
        department: person.department ?? tt("people.unknown.department"),
        tenantName: tenantByConnection.get(person.connection_id) ?? "Connected Tenant",
        officeLocation: "",
        mobilePhone: person.mobile_phone ?? "",
        businessPhones: person.business_phones ?? [],
        sourceAccount: sourceByConnection.get(person.connection_id) ?? "",
        provider: providerByConnection.get(person.connection_id) ?? "microsoft",
        upn: "user_principal_name" in person && typeof person.user_principal_name === "string" ? person.user_principal_name : "",
        externalPersonId: person.external_person_id,
        managerExternalId: person.manager_external_id ?? "",
        companyName: "",
        employeeId: "",
        preferredLanguage: "",
        city: "",
        state: "",
        country: "",
        userType: "user_type" in person && typeof person.user_type === "string" ? person.user_type : "",
        accountEnabled: null,
        detailLoaded: false
      }));
    }
  }

  return (
    <div className="space-y-4">
      <section className="panel-glass card p-5 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="title-xl">{tt("people.title")}</h1>
            <p className="muted mt-1">{tt("people.subtitle")}</p>
          </div>
          <span className="surface-chip">{tt("people.searchCount", { count: totalPeopleCount || people.length })}</span>
        </div>
      </section>

      <section className="panel-glass card p-5 md:p-6">
        <PeopleSearchPanel initialHasMore={initialHasMore} people={people} serverSearchEnabled={serverSearchEnabled} />
      </section>
    </div>
  );
}
