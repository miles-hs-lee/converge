import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { accountCountBucket, applyStandardSentryScopeTags } from "@/lib/observability/sentry-tags";

const NON_GUEST_FILTER =
  "and(user_type.is.null,user_principal_name.is.null),and(user_type.is.null,user_principal_name.not.ilike.%23EXT%23),and(user_type.not.ilike.guest,user_principal_name.is.null),and(user_type.not.ilike.guest,user_principal_name.not.ilike.%23EXT%23)";

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

function parseBoolean(raw: string | null, fallback: boolean): boolean {
  if (raw === null) return fallback;
  const v = raw.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return fallback;
}

function parseLocaleHeader(request: NextRequest): string | undefined {
  const raw = request.headers.get("accept-language");
  if (!raw) {
    return undefined;
  }
  return (
    raw
      .split(",")
      .map((token) => token.split(";")[0]?.trim())
      .find((token): token is string => Boolean(token && token.length > 0)) ?? undefined
  );
}

function toPersonRow(params: {
  person: Record<string, any>;
  tenantByConnection: Map<string, string>;
  tenantIdByConnection: Map<string, string>;
  sourceByConnection: Map<string, string>;
  providerByConnection: Map<string, string>;
  includeDetail: boolean;
}): PersonRow {
  const { person, tenantByConnection, tenantIdByConnection, sourceByConnection, providerByConnection, includeDetail } = params;

  const upn =
    ("user_principal_name" in person && typeof person.user_principal_name === "string" ? person.user_principal_name : "") ||
    rawString(person.raw, "userPrincipalName");
  const userType = ("user_type" in person && typeof person.user_type === "string" ? person.user_type : "") || rawString(person.raw, "userType");

  return {
    id: person.id,
    displayName: person.display_name ?? "",
    mail: person.mail ?? "",
    jobTitle: person.job_title ?? "",
    department: person.department ?? "",
    tenantName: tenantByConnection.get(person.connection_id) ?? "Connected Account",
    tenantId: tenantIdByConnection.get(person.connection_id) ?? "",
    officeLocation: includeDetail ? person.office_location ?? "" : "",
    mobilePhone: person.mobile_phone ?? "",
    businessPhones: person.business_phones ?? [],
    sourceAccount: sourceByConnection.get(person.connection_id) ?? "",
    provider: providerByConnection.get(person.connection_id) ?? "microsoft",
    upn,
    externalPersonId: person.external_person_id ?? "",
    managerExternalId: person.manager_external_id ?? "",
    companyName: includeDetail ? ("company_name" in person && typeof person.company_name === "string" ? person.company_name : "") || rawString(person.raw, "companyName") : "",
    employeeId: includeDetail ? ("employee_id" in person && typeof person.employee_id === "string" ? person.employee_id : "") || rawString(person.raw, "employeeId") : "",
    preferredLanguage:
      includeDetail
        ? ("preferred_language" in person && typeof person.preferred_language === "string" ? person.preferred_language : "") || rawString(person.raw, "preferredLanguage")
        : "",
    city: includeDetail ? ("city" in person && typeof person.city === "string" ? person.city : "") || rawString(person.raw, "city") : "",
    state: includeDetail ? ("state" in person && typeof person.state === "string" ? person.state : "") || rawString(person.raw, "state") : "",
    country: includeDetail ? ("country" in person && typeof person.country === "string" ? person.country : "") || rawString(person.raw, "country") : "",
    userType,
    accountEnabled:
      includeDetail
        ? ("account_enabled" in person && typeof person.account_enabled === "boolean" ? person.account_enabled : null) ?? rawBoolean(person.raw, "accountEnabled")
        : null,
    detailLoaded: includeDetail
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

function matchesConnectionQuery(connection: {
  tenant_name?: string | null;
  m365_user_principal_name?: string | null;
}, q: string): boolean {
  if (!q) {
    return false;
  }

  return (
    (connection.tenant_name ?? "").toLowerCase().includes(q) ||
    (connection.m365_user_principal_name ?? "").toLowerCase().includes(q)
  );
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const locale = parseLocaleHeader(request);
  const url = new URL(request.url);
  const q = normalizeQuery(url.searchParams.get("q") ?? "");
  const id = (url.searchParams.get("id") ?? "").trim();
  const externalPersonId = (url.searchParams.get("externalPersonId") ?? "").trim();
  const modeRaw = (url.searchParams.get("mode") ?? "summary").trim().toLowerCase();
  const includeDetail = modeRaw === "detail";
  const includeGuests = parseBoolean(url.searchParams.get("includeGuests"), false);
  const offsetRaw = Number(url.searchParams.get("offset") ?? "0");
  const limitRaw = Number(url.searchParams.get("limit") ?? "60");

  const offset = Number.isFinite(offsetRaw) ? Math.max(0, Math.floor(offsetRaw)) : 0;
  const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, Math.floor(limitRaw))) : 60;

  return Sentry.startSpan(
    {
      name: "people.search.request",
      op: "converge.people.search",
      attributes: {
        "converge.route": "/api/people/search",
        "converge.provider": "mixed",
        "converge.sync_mode": "people",
        "converge.locale": locale ?? "unknown",
        "converge.query_length": q.length,
        "converge.include_guests": includeGuests,
        "converge.include_detail": includeDetail
      }
    },
    async () => {
      const supabase = await createClient();
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
      }

      const { data: connections } = await Sentry.startSpan(
        {
          name: "people.search.connections_query",
          op: "db.query",
          attributes: {
            "converge.route": "/api/people/search"
          }
        },
        () =>
          supabase
            .from("m365_connections")
            .select("id,provider,tenant_id,tenant_name,m365_user_principal_name")
      );

      const connectionIds = (connections ?? []).map((connection) => connection.id);
      if (connectionIds.length === 0) {
        return NextResponse.json({ ok: true, items: [], offset, limit, hasMore: false, total: 0 });
      }

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

      const matchingConnectionIds = q ? (connections ?? []).filter((connection) => matchesConnectionQuery(connection, q)).map((connection) => connection.id) : [];

      const summarySelect =
        "id,external_person_id,display_name,mail,job_title,department,mobile_phone,business_phones,manager_external_id,user_principal_name,user_type,connection_id";
      const summaryFallback =
        "id,external_person_id,display_name,mail,job_title,department,mobile_phone,business_phones,manager_external_id,raw,connection_id";
      const detailSelect =
        "id,external_person_id,display_name,mail,job_title,department,office_location,mobile_phone,business_phones,manager_external_id,user_principal_name,company_name,employee_id,preferred_language,city,state,country,user_type,account_enabled,raw,connection_id";
      const detailFallback =
        "id,external_person_id,display_name,mail,job_title,department,office_location,mobile_phone,business_phones,manager_external_id,raw,connection_id";

      const windowSize = id || externalPersonId ? limit : q ? Math.min(180, limit * 3) : limit + 1;

      const queryPeople = (params: { selectText: string; scopedConnectionIds: string[]; applySearchFilter: boolean }) => {
        const rangeEnd = offset + Math.max(1, windowSize) - 1;
        let query = supabase
          .from("people_cache")
          .select(params.selectText)
          .in("connection_id", params.scopedConnectionIds)
          .order("display_name", { ascending: true })
          .range(offset, rangeEnd);

        if (!includeGuests) {
          query = query.or(NON_GUEST_FILTER);
        }

        if (id) {
          query = query.eq("id", id).limit(1);
        } else if (externalPersonId) {
          query = query.eq("external_person_id", externalPersonId).limit(1);
        } else if (params.applySearchFilter && q) {
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

      const runPeopleQuery = async (params: { scopedConnectionIds: string[]; applySearchFilter: boolean; queryKind: "primary" | "account" }) => {
        const attributes = {
          "converge.route": "/api/people/search",
          "converge.query_length": q.length,
          "converge.account_count_bucket": accountCountBucket(params.scopedConnectionIds.length),
          "converge.include_detail": includeDetail
        };

        const primaryResult = await Sentry.startSpan(
          {
            name: `people.search.people_query.${params.queryKind}.primary`,
            op: "db.query",
            attributes
          },
          () =>
            queryPeople({
              selectText: includeDetail ? detailSelect : summarySelect,
              scopedConnectionIds: params.scopedConnectionIds,
              applySearchFilter: params.applySearchFilter
            })
        );

        if (!primaryResult.error) {
          return { data: (primaryResult.data ?? []) as Array<Record<string, any>>, error: null };
        }

        const fallbackResult = await Sentry.startSpan(
          {
            name: `people.search.people_query.${params.queryKind}.fallback`,
            op: "db.query",
            attributes
          },
          () =>
            queryPeople({
              selectText: includeDetail ? detailFallback : summaryFallback,
              scopedConnectionIds: params.scopedConnectionIds,
              applySearchFilter: params.applySearchFilter
            })
        );

        return {
          data: (fallbackResult.data ?? []) as Array<Record<string, any>>,
          error: fallbackResult.error
        };
      };

      const [primaryQuery, accountQuery] = await Promise.all([
        runPeopleQuery({
          scopedConnectionIds: connectionIds,
          applySearchFilter: Boolean(q) && !id && !externalPersonId,
          queryKind: "primary"
        }),
        !id && !externalPersonId && q && matchingConnectionIds.length > 0
          ? runPeopleQuery({
              scopedConnectionIds: matchingConnectionIds,
              applySearchFilter: false,
              queryKind: "account"
            })
          : Promise.resolve({ data: [] as Array<Record<string, any>>, error: null })
      ]);

      const error = primaryQuery.error ?? accountQuery.error;

      if (error) {
        Sentry.withScope((scope) => {
          applyStandardSentryScopeTags(scope, {
            route: "/api/people/search",
            provider: "mixed",
            syncMode: "people",
            locale,
            accountCount: connectionIds.length
          });
          scope.setUser({ id: user.id });
          scope.setContext("people_search", {
            includeDetail,
            includeGuests,
            queryLength: q.length,
            offset,
            limit
          });
          Sentry.captureException(error);
        });
        return NextResponse.json({ ok: false, error: "people_query_failed" }, { status: 500 });
      }

      const rowMap = new Map<string, Record<string, any>>();
      [...primaryQuery.data, ...accountQuery.data].forEach((row) => {
        if (row.id && !rowMap.has(row.id)) {
          rowMap.set(row.id, row);
        }
      });

      let items = Sentry.startSpan(
        {
          name: "people.search.transform",
          op: "converge.people.search.transform",
          attributes: {
            "converge.route": "/api/people/search",
            "converge.rows": rowMap.size
          }
        },
        () =>
          [...rowMap.values()].map((person) =>
            toPersonRow({ person, tenantByConnection, tenantIdByConnection, sourceByConnection, providerByConnection, includeDetail })
          )
      );

      if (!id && !externalPersonId && q) {
        items = Sentry.startSpan(
          {
            name: "people.search.filter_local",
            op: "converge.people.search.filter",
            attributes: {
              "converge.route": "/api/people/search",
              "converge.query_length": q.length
            }
          },
          () => items.filter((person) => passesQuery(person, q))
        );
      }

      const hasMore = !id && !externalPersonId && items.length > limit;
      const effectiveItems = hasMore ? items.slice(0, limit) : items;
      const cacheControl = id || externalPersonId ? "private, max-age=300, stale-while-revalidate=600" : q ? "private, max-age=30, stale-while-revalidate=120" : "private, max-age=60, stale-while-revalidate=300";

      return NextResponse.json(
        {
          ok: true,
          items: effectiveItems,
          offset,
          limit,
          hasMore,
          total: null
        },
        {
          headers: {
            "Cache-Control": cacheControl
          }
        }
      );
    }
  );
}
