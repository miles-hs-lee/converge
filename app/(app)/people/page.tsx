import { isMockMode } from "@/lib/mock-mode";
import { mockPeople } from "@/lib/mock-data";
import { PeopleSearchPanel } from "@/components/people-search-panel";
import { getServerLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { fetchPeopleSummaryData } from "@/lib/data/people-data";

type PersonRow = {
  id: string;
  displayName: string;
  mail: string;
  jobTitle: string;
  department: string;
  tenantName: string;
  tenantId?: string;
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
  const locale = await getServerLocale({ dbFallback: true });
  const tt = (key: Parameters<typeof t>[1], vars?: Parameters<typeof t>[2]) => t(locale, key, vars);

  let people: PersonRow[] = [];
  let totalPeopleCount = 0;
  let serverSearchEnabled = false;
  let initialHasMore = false;

  if (isMockMode) {
    people = mockPeople;
    totalPeopleCount = mockPeople.length;
  } else {
    serverSearchEnabled = true;
    const { connections, initialHasMore: hasMore, resolvedRows, totalPeopleCount: fetchedCount } = await fetchPeopleSummaryData();
    totalPeopleCount = fetchedCount;
    initialHasMore = hasMore;

    const tenantByConnection = new Map<string, string>();
    const tenantIdByConnection = new Map<string, string>();
    const sourceByConnection = new Map<string, string>();
    const providerByConnection = new Map<string, string>();
    (connections ?? []).forEach((connection) => {
      tenantByConnection.set(connection.id, connection.tenant_name ?? "Connected Account");
      tenantIdByConnection.set(connection.id, connection.tenant_id ?? "");
      sourceByConnection.set(connection.id, connection.m365_user_principal_name ?? "");
      providerByConnection.set(connection.id, connection.provider ?? "microsoft");
    });

    const initialRows = initialHasMore ? resolvedRows.slice(0, 80) : resolvedRows;

    people = initialRows.map((person) => ({
      id: person.id,
      displayName: person.display_name,
      mail: person.mail ?? "",
      jobTitle: person.job_title ?? tt("people.unknown.jobTitle"),
      department: person.department ?? tt("people.unknown.department"),
      tenantName: tenantByConnection.get(person.connection_id) ?? "Connected Account",
      tenantId: tenantIdByConnection.get(person.connection_id) ?? "",
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
