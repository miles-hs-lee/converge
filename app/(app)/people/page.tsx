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
        .select("id,display_name,mail,job_title,department,connection_id")
        .order("display_name", { ascending: true })
        .limit(150);

      const nameByConnection = new Map<string, string>();
      (connections ?? []).forEach((connection) => {
        nameByConnection.set(connection.id, connection.tenant_name ?? "Connected Tenant");
      });

      people = (dbPeople ?? []).map((person) => ({
        id: person.id,
        displayName: person.display_name,
        mail: person.mail ?? "(email 없음)",
        jobTitle: person.job_title ?? "(직책 없음)",
        department: person.department ?? "(부서 없음)",
        tenantName: nameByConnection.get(person.connection_id) ?? "Connected Tenant"
      }));
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <section className="panel-glass card p-5">
        <p className="text-xs uppercase tracking-[0.18em] text-accent">People Finder</p>
        <h1 className="mt-2 text-xl font-semibold">조직도 / 직원 검색</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          여러 테넌트의 사용자 디렉터리를 통합 색인하여 이름, 이메일, 부서로 즉시 검색합니다. 검색 결과에서 소속
          테넌트를 함께 보여 중복 인원을 구분합니다.
        </p>

        {isMockMode ? (
          <p className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
            Mock 모드로 실행 중입니다. 실제 Graph 동기화 없이도 검색 UX를 테스트할 수 있습니다.
          </p>
        ) : null}

        <PeopleSearchPanel people={people} />
      </section>

      <aside className="panel-glass card p-5">
        <h2 className="text-base font-semibold">프로필 상세</h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          사용자를 선택하면 직책, 부서, 연락처, 매니저, 소속 테넌트를 우측 패널에 표시합니다.
        </p>

        <div className="mt-5 rounded-xl border border-line bg-white/80 p-4 text-sm">
          <p className="font-medium">빠른 액션(예정)</p>
          <ul className="mt-2 space-y-1 text-muted">
            <li>1. 메일 작성</li>
            <li>2. Teams 채팅 열기</li>
            <li>3. 캘린더 약속 생성</li>
          </ul>
        </div>

        <div className="mt-4 rounded-xl border border-line bg-white/80 p-4 text-xs text-muted">
          검색 성능 향상을 위해 `pg_trgm` 인덱스를 사용합니다.
        </div>
      </aside>
    </div>
  );
}
