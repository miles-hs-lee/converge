import { createClient } from "@/lib/supabase/server";
import { isMockMode } from "@/lib/mock-mode";
import { mockPeople } from "@/lib/mock-data";
import { PeopleSearchPanel } from "@/components/people-search-panel";
import { getServerLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

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
};

function rawString(raw: unknown, key: string): string {
  if (!raw || typeof raw !== "object") return "";
  const value = (raw as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function rawBoolean(raw: unknown, key: string): boolean | null {
  if (!raw || typeof raw !== "object") return null;
  const value = (raw as Record<string, unknown>)[key];
  return typeof value === "boolean" ? value : null;
}

export default async function PeoplePage() {
  const locale = await getServerLocale();
  const tt = (key: Parameters<typeof t>[1], vars?: Parameters<typeof t>[2]) => t(locale, key, vars);

  let people: PersonRow[] = [];
  let totalPeopleCount = 0;
  let serverSearchEnabled = false;

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
        const { count } = await supabase.from("people_cache").select("id", { count: "exact", head: true }).in("connection_id", connectionIds);
        totalPeopleCount = count ?? 0;
      }

      const peopleSelectExpanded =
        "id,external_person_id,display_name,mail,job_title,department,office_location,mobile_phone,business_phones,manager_external_id,given_name,surname,user_principal_name,company_name,employee_id,preferred_language,city,state,country,user_type,account_enabled,raw,connection_id";
      const peopleSelectFallback =
        "id,external_person_id,display_name,mail,job_title,department,office_location,mobile_phone,business_phones,manager_external_id,raw,connection_id";
      const queryPeople = (selectText: string) =>
        supabase.from("people_cache").select(selectText).in("connection_id", connectionIds).order("display_name", { ascending: true }).range(0, 79);

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
        const expandedPeople = await queryPeople(peopleSelectExpanded);
        if (expandedPeople.error) {
          const fallbackPeople = await queryPeople(peopleSelectFallback);
          resolvedRows = (fallbackPeople.data ?? []) as Array<Record<string, any>>;
        } else {
          resolvedRows = (expandedPeople.data ?? []) as Array<Record<string, any>>;
        }
      }

      people = resolvedRows.map((person) => ({
        id: person.id,
        displayName: person.display_name,
        mail: person.mail ?? "",
        jobTitle: person.job_title ?? tt("people.unknown.jobTitle"),
        department: person.department ?? tt("people.unknown.department"),
        tenantName: tenantByConnection.get(person.connection_id) ?? "Connected Tenant",
        officeLocation: person.office_location ?? tt("people.unknown.office"),
        mobilePhone: person.mobile_phone ?? tt("people.unknown.phone"),
        businessPhones: person.business_phones ?? [],
        sourceAccount: sourceByConnection.get(person.connection_id) ?? "",
        provider: providerByConnection.get(person.connection_id) ?? "microsoft",
        upn: ("user_principal_name" in person && typeof person.user_principal_name === "string" ? person.user_principal_name : "") || rawString(person.raw, "userPrincipalName"),
        externalPersonId: person.external_person_id,
        managerExternalId: person.manager_external_id ?? "",
        companyName: ("company_name" in person && typeof person.company_name === "string" ? person.company_name : "") || rawString(person.raw, "companyName"),
        employeeId: ("employee_id" in person && typeof person.employee_id === "string" ? person.employee_id : "") || rawString(person.raw, "employeeId"),
        preferredLanguage:
          ("preferred_language" in person && typeof person.preferred_language === "string" ? person.preferred_language : "") || rawString(person.raw, "preferredLanguage"),
        city: ("city" in person && typeof person.city === "string" ? person.city : "") || rawString(person.raw, "city"),
        state: ("state" in person && typeof person.state === "string" ? person.state : "") || rawString(person.raw, "state"),
        country: ("country" in person && typeof person.country === "string" ? person.country : "") || rawString(person.raw, "country"),
        userType: ("user_type" in person && typeof person.user_type === "string" ? person.user_type : "") || rawString(person.raw, "userType"),
        accountEnabled:
          ("account_enabled" in person && typeof person.account_enabled === "boolean" ? person.account_enabled : null) ?? rawBoolean(person.raw, "accountEnabled")
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
        <PeopleSearchPanel people={people} serverSearchEnabled={serverSearchEnabled} />
      </section>
    </div>
  );
}
