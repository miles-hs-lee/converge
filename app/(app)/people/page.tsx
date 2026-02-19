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

  if (isMockMode) {
    people = mockPeople;
  } else {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (user) {
      const { data: connections } = await supabase.from("m365_connections").select("id,provider,tenant_name,m365_user_principal_name");
      const { data: dbPeople } = await supabase
        .from("people_cache")
        .select("id,external_person_id,display_name,mail,job_title,department,office_location,mobile_phone,business_phones,manager_external_id,raw,connection_id")
        .order("display_name", { ascending: true })
        .range(0, 4999);

      const tenantByConnection = new Map<string, string>();
      const sourceByConnection = new Map<string, string>();
      const providerByConnection = new Map<string, string>();
      (connections ?? []).forEach((connection) => {
        tenantByConnection.set(connection.id, connection.tenant_name ?? "Connected Tenant");
        sourceByConnection.set(connection.id, connection.m365_user_principal_name ?? "");
        providerByConnection.set(connection.id, connection.provider ?? "microsoft");
      });

      people = (dbPeople ?? []).map((person) => ({
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
        upn: rawString(person.raw, "userPrincipalName"),
        externalPersonId: person.external_person_id,
        managerExternalId: person.manager_external_id ?? "",
        companyName: rawString(person.raw, "companyName"),
        employeeId: rawString(person.raw, "employeeId"),
        preferredLanguage: rawString(person.raw, "preferredLanguage"),
        city: rawString(person.raw, "city"),
        state: rawString(person.raw, "state"),
        country: rawString(person.raw, "country"),
        userType: rawString(person.raw, "userType"),
        accountEnabled: rawBoolean(person.raw, "accountEnabled")
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
          <span className="surface-chip">{tt("people.searchCount", { count: people.length })}</span>
        </div>
      </section>

      <section className="panel-glass card p-5 md:p-6">
        <PeopleSearchPanel people={people} />
      </section>
    </div>
  );
}
