import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

function digitsOnly(value: string): string {
  return (value ?? "").replace(/[^\d]/g, "");
}

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

function toPersonRow(params: {
  person: Record<string, any>;
  tenantByConnection: Map<string, string>;
  sourceByConnection: Map<string, string>;
  providerByConnection: Map<string, string>;
}): PersonRow {
  const { person, tenantByConnection, sourceByConnection, providerByConnection } = params;

  return {
    id: person.id,
    displayName: person.display_name ?? "",
    mail: person.mail ?? "",
    jobTitle: person.job_title ?? "",
    department: person.department ?? "",
    tenantName: tenantByConnection.get(person.connection_id) ?? "Connected Tenant",
    officeLocation: person.office_location ?? "",
    mobilePhone: person.mobile_phone ?? "",
    businessPhones: person.business_phones ?? [],
    sourceAccount: sourceByConnection.get(person.connection_id) ?? "",
    provider: providerByConnection.get(person.connection_id) ?? "microsoft",
    upn: ("user_principal_name" in person && typeof person.user_principal_name === "string" ? person.user_principal_name : "") || rawString(person.raw, "userPrincipalName"),
    externalPersonId: person.external_person_id ?? "",
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
  };
}

function passesQuery(person: PersonRow, q: string): boolean {
  if (!q) return true;

  const qDigits = digitsOnly(q);
  if (qDigits.length > 0) {
    const mobileDigits = digitsOnly(person.mobilePhone);
    const businessDigits = (person.businessPhones ?? []).map((phone) => digitsOnly(phone));
    if (mobileDigits.includes(qDigits) || businessDigits.some((digits) => digits.includes(qDigits))) {
      return true;
    }
  }

  return (
    person.displayName.toLowerCase().includes(q) ||
    person.mail.toLowerCase().includes(q) ||
    person.upn.toLowerCase().includes(q) ||
    person.department.toLowerCase().includes(q) ||
    person.tenantName.toLowerCase().includes(q) ||
    person.sourceAccount.toLowerCase().includes(q)
  );
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = normalizeQuery(url.searchParams.get("q") ?? "");
  const offsetRaw = Number(url.searchParams.get("offset") ?? "0");
  const limitRaw = Number(url.searchParams.get("limit") ?? "60");
  const externalPersonId = (url.searchParams.get("externalPersonId") ?? "").trim();

  const offset = Number.isFinite(offsetRaw) ? Math.max(0, Math.floor(offsetRaw)) : 0;
  const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, Math.floor(limitRaw))) : 60;

  const { data: connections } = await supabase
    .from("m365_connections")
    .select("id,provider,tenant_name,m365_user_principal_name")
    .order("created_at", { ascending: true });

  const connectionIds = (connections ?? []).map((connection) => connection.id);
  if (connectionIds.length === 0) {
    return NextResponse.json({ ok: true, items: [], offset, limit, hasMore: false, total: 0 });
  }

  const tenantByConnection = new Map<string, string>();
  const sourceByConnection = new Map<string, string>();
  const providerByConnection = new Map<string, string>();
  (connections ?? []).forEach((connection) => {
    tenantByConnection.set(connection.id, connection.tenant_name ?? "Connected Tenant");
    sourceByConnection.set(connection.id, connection.m365_user_principal_name ?? "");
    providerByConnection.set(connection.id, connection.provider ?? "microsoft");
  });

  const peopleSelectExpanded =
    "id,external_person_id,display_name,mail,job_title,department,office_location,mobile_phone,business_phones,manager_external_id,given_name,surname,user_principal_name,company_name,employee_id,preferred_language,city,state,country,user_type,account_enabled,raw,connection_id";
  const peopleSelectFallback =
    "id,external_person_id,display_name,mail,job_title,department,office_location,mobile_phone,business_phones,manager_external_id,raw,connection_id";

  const queryPeople = (selectText: string) => {
    let query = supabase
      .from("people_cache")
      .select(selectText)
      .in("connection_id", connectionIds)
      .order("display_name", { ascending: true })
      .range(offset, offset + limit - 1);

    if (externalPersonId) {
      query = query.eq("external_person_id", externalPersonId).limit(1);
    } else if (q) {
      const safe = q.replace(/[%_,]/g, " ").trim();
      if (safe) {
        const pattern = `%${safe}%`;
        query = query.or(
          [
            `display_name.ilike.${pattern}`,
            `mail.ilike.${pattern}`,
            `department.ilike.${pattern}`,
            `job_title.ilike.${pattern}`,
            `office_location.ilike.${pattern}`,
            `mobile_phone.ilike.${pattern}`
          ].join(",")
        );
      }
    }

    return query;
  };

  const expandedPeople = await queryPeople(peopleSelectExpanded);
  const { data: dbPeople, error } = expandedPeople.error ? await queryPeople(peopleSelectFallback) : expandedPeople;

  if (error) {
    return NextResponse.json({ ok: false, error: "people_query_failed" }, { status: 500 });
  }

  const rows = (dbPeople ?? []) as Array<Record<string, any>>;
  const rowCount = rows.length;
  let items = rows.map((person) =>
    toPersonRow({ person, tenantByConnection, sourceByConnection, providerByConnection })
  );

  if (!externalPersonId && q) {
    items = items.filter((person) => passesQuery(person, q));
  }

  const hasMore = !externalPersonId && rowCount >= limit;

  return NextResponse.json({
    ok: true,
    items,
    offset,
    limit,
    hasMore,
    total: null
  });
}
