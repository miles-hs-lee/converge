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
};

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
      const { data: connections } = await supabase.from("m365_connections").select("id,tenant_name");
      const { data: dbPeople } = await supabase
        .from("people_cache")
        .select("id,display_name,mail,job_title,department,office_location,mobile_phone,business_phones,connection_id")
        .order("display_name", { ascending: true })
        .range(0, 4999);

      const tenantByConnection = new Map<string, string>();
      (connections ?? []).forEach((connection) => {
        tenantByConnection.set(connection.id, connection.tenant_name ?? "Connected Tenant");
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
        businessPhones: person.business_phones ?? []
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
