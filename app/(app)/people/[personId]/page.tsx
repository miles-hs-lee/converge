import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, Mail, MessageSquareText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isMockMode } from "@/lib/mock-mode";
import { mockPeople } from "@/lib/mock-data";

type PageProps = {
  params: Promise<{ personId: string }>;
};

type PersonDetail = {
  id: string;
  displayName: string;
  mail: string;
  jobTitle: string;
  department: string;
  tenantName: string;
  officeLocation: string;
  mobilePhone: string;
};

function buildActionLinks(person: PersonDetail) {
  const email = person.mail;
  const mailto = email ? `mailto:${email}` : "#";
  const teams = email ? `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(email)}` : "#";

  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 30);

  const calendar = email
    ? `https://outlook.office.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(`${person.displayName} 미팅`)}&to=${encodeURIComponent(email)}&startdt=${encodeURIComponent(start.toISOString())}&enddt=${encodeURIComponent(end.toISOString())}`
    : "#";

  return { mailto, teams, calendar, disabled: !email };
}

export default async function PersonDetailPage({ params }: PageProps) {
  const { personId } = await params;

  let person: PersonDetail | null = null;

  if (isMockMode) {
    const found = mockPeople.find((item) => item.id === personId);
    if (found) {
      person = {
        id: found.id,
        displayName: found.displayName,
        mail: found.mail,
        jobTitle: found.jobTitle,
        department: found.department,
        tenantName: found.tenantName,
        officeLocation: found.officeLocation,
        mobilePhone: found.mobilePhone
      };
    }
  } else {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (user) {
      const { data: dbPerson } = await supabase
        .from("people_cache")
        .select("id,display_name,mail,job_title,department,office_location,mobile_phone,connection_id")
        .eq("id", personId)
        .maybeSingle();

      if (dbPerson) {
        const { data: connection } = await supabase
          .from("m365_connections")
          .select("tenant_name")
          .eq("id", dbPerson.connection_id)
          .maybeSingle();

        person = {
          id: dbPerson.id,
          displayName: dbPerson.display_name,
          mail: dbPerson.mail ?? "",
          jobTitle: dbPerson.job_title ?? "(직책 없음)",
          department: dbPerson.department ?? "(부서 없음)",
          tenantName: connection?.tenant_name ?? "Connected Tenant",
          officeLocation: dbPerson.office_location ?? "(위치 없음)",
          mobilePhone: dbPerson.mobile_phone ?? "(연락처 없음)"
        };
      }
    }
  }

  if (!person) {
    notFound();
  }

  const { mailto, teams, calendar, disabled } = buildActionLinks(person);

  return (
    <div className="space-y-4">
      <section className="panel-glass card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-accent">People Profile</p>
            <h1 className="mt-1 text-2xl font-semibold">{person.displayName}</h1>
            <p className="mt-1 text-sm text-muted">
              {person.jobTitle} · {person.department} · {person.tenantName}
            </p>
          </div>
          <Link className="rounded-xl border border-line bg-white px-4 py-2 text-sm" href="/people">
            목록으로
          </Link>
        </div>
      </section>

      <section className="panel-glass card p-5">
        <h2 className="text-base font-semibold">빠른 액션</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <a
            className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${disabled ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400" : "border-line bg-white hover:border-accent/50"}`}
            href={disabled ? undefined : mailto}
            rel="noreferrer"
            target="_blank"
          >
            <Mail size={16} />
            메일 작성
          </a>
          <a
            className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${disabled ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400" : "border-line bg-white hover:border-accent/50"}`}
            href={disabled ? undefined : teams}
            rel="noreferrer"
            target="_blank"
          >
            <MessageSquareText size={16} />
            Teams 채팅 열기
          </a>
          <a
            className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${disabled ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400" : "border-line bg-white hover:border-accent/50"}`}
            href={disabled ? undefined : calendar}
            rel="noreferrer"
            target="_blank"
          >
            <CalendarPlus size={16} />
            캘린더 약속 생성
          </a>
        </div>
        {disabled ? <p className="mt-2 text-xs text-muted">이메일 정보가 없어 빠른 액션을 사용할 수 없습니다.</p> : null}
      </section>

      <section className="panel-glass card p-5">
        <h2 className="text-base font-semibold">기본 정보</h2>
        <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
          <div className="rounded-xl border border-line bg-white/80 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-muted">이메일</p>
            <p className="mt-1 font-medium">{person.mail || "(email 없음)"}</p>
          </div>
          <div className="rounded-xl border border-line bg-white/80 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-muted">전화번호</p>
            <p className="mt-1 font-medium">{person.mobilePhone}</p>
          </div>
          <div className="rounded-xl border border-line bg-white/80 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-muted">오피스 위치</p>
            <p className="mt-1 font-medium">{person.officeLocation}</p>
          </div>
          <div className="rounded-xl border border-line bg-white/80 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-muted">소속 테넌트</p>
            <p className="mt-1 font-medium">{person.tenantName}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
