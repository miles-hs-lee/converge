import { createClient } from "@/lib/supabase/server";
import { isMockMode } from "@/lib/mock-mode";
import { mockPeople } from "@/lib/mock-data";
import { PeopleSearchPanel } from "@/components/people-search-panel";

type PersonRow = {
  id: string;
  displayName: string;
  mail: string;
  jobTitle: string;
  department: string;
  tenantName: string;
  officeLocation: string;
  mobilePhone: string;
};

export default async function PeoplePage() {
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
        .select("id,display_name,mail,job_title,department,office_location,mobile_phone,connection_id")
        .order("display_name", { ascending: true })
        .limit(150);

      const tenantByConnection = new Map<string, string>();
      (connections ?? []).forEach((connection) => {
        tenantByConnection.set(connection.id, connection.tenant_name ?? "Connected Tenant");
      });

      people = (dbPeople ?? []).map((person) => ({
        id: person.id,
        displayName: person.display_name,
        mail: person.mail ?? "",
        jobTitle: person.job_title ?? "(직책 없음)",
        department: person.department ?? "(부서 없음)",
        tenantName: tenantByConnection.get(person.connection_id) ?? "Connected Tenant",
        officeLocation: person.office_location ?? "(위치 없음)",
        mobilePhone: person.mobile_phone ?? "(연락처 없음)"
      }));
    }
  }

  return (
    <section className="panel-glass card p-5">
      <h1 className="text-xl font-semibold">조직도</h1>
      <p className="mt-1 text-sm text-muted">직원을 검색하고 상세 팝업에서 빠른 액션을 실행하세요.</p>
      <PeopleSearchPanel people={people} />
    </section>
  );
}
