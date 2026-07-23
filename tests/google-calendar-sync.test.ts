import { describe, expect, it, vi } from "vitest";
import { syncGoogleCalendarSnapshot } from "../lib/google-sync";

type StoredSource = {
  id: string;
  connection_id: string;
  external_calendar_id: string;
  is_selected: boolean;
};

type StoredEvent = {
  id: string;
  calendar_source_id: string;
  external_event_id: string;
};

function createAdminMock() {
  const sources: StoredSource[] = [
    {
      id: "source-c1",
      connection_id: "connection-id",
      external_calendar_id: "c1",
      is_selected: true
    }
  ];
  const events: StoredEvent[] = [
    {
      id: "stale-cancelled-row",
      calendar_source_id: "source-c1",
      external_event_id: "c1:cancelled"
    }
  ];
  const upsertedEventIds: string[] = [];
  const deletedEventRowIds: string[] = [];

  const adminClient = {
    from(table: string) {
      let operation: "select" | "upsert" | "delete" = "select";
      let payload: Array<Record<string, unknown>> = [];
      const filters = new Map<string, unknown>();

      const builder = {
        select() {
          operation = "select";
          return builder;
        },
        upsert(rows: Array<Record<string, unknown>>) {
          operation = "upsert";
          payload = rows;
          return builder;
        },
        delete() {
          operation = "delete";
          return builder;
        },
        eq(column: string, value: unknown) {
          filters.set(column, value);
          return builder;
        },
        in(column: string, value: unknown[]) {
          filters.set(column, value);
          return builder;
        },
        lte() {
          return builder;
        },
        gte() {
          return builder;
        },
        order() {
          return builder;
        },
        range() {
          return builder;
        },
        then<TResult1 = unknown, TResult2 = never>(
          onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
          onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
        ) {
          let result: { data?: unknown[]; error: null } = { error: null };

          if (table === "calendar_sources" && operation === "select") {
            result = {
              data: sources.filter((source) => {
                const connectionId = filters.get("connection_id");
                const externalIds = filters.get("external_calendar_id");
                return (
                  (!connectionId || source.connection_id === connectionId) &&
                  (!Array.isArray(externalIds) || externalIds.includes(source.external_calendar_id))
                );
              }),
              error: null
            };
          } else if (table === "calendar_sources" && operation === "upsert") {
            payload.forEach((row) => {
              const externalId = String(row.external_calendar_id);
              const existing = sources.find((source) => source.external_calendar_id === externalId);
              const next = {
                id: existing?.id ?? `source-${externalId}`,
                connection_id: String(row.connection_id),
                external_calendar_id: externalId,
                is_selected: Boolean(row.is_selected)
              };
              if (existing) {
                Object.assign(existing, next);
              } else {
                sources.push(next);
              }
            });
          } else if (table === "calendar_events_cache" && operation === "upsert") {
            payload.forEach((row) => upsertedEventIds.push(String(row.external_event_id)));
          } else if (table === "calendar_events_cache" && operation === "select") {
            const sourceId = filters.get("calendar_source_id");
            result = {
              data: events.filter((event) => !sourceId || event.calendar_source_id === sourceId),
              error: null
            };
          } else if (table === "calendar_events_cache" && operation === "delete") {
            const rowIds = filters.get("id");
            if (Array.isArray(rowIds)) {
              deletedEventRowIds.push(...rowIds.map(String));
            }
          }

          return Promise.resolve(result).then(onfulfilled, onrejected);
        }
      };

      return builder;
    }
  };

  return { adminClient, deletedEventRowIds, upsertedEventIds };
}

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

describe("syncGoogleCalendarSnapshot", () => {
  it("follows calendar and event pages and removes cancelled cached events", async () => {
    const requestedUrls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = new URL(String(input));
        requestedUrls.push(url.toString());

        if (url.pathname.endsWith("/calendarList")) {
          if (url.searchParams.get("pageToken") === "calendar-next") {
            return jsonResponse({ items: [{ id: "c2", summary: "Secondary" }] });
          }
          return jsonResponse({
            items: [{ id: "c1", summary: "Primary", primary: true }],
            nextPageToken: "calendar-next"
          });
        }

        if (url.pathname.includes("/calendars/c1/events")) {
          if (url.searchParams.get("pageToken") === "event-next") {
            return jsonResponse({
              items: [
                {
                  id: "e2",
                  status: "confirmed",
                  summary: "Second page",
                  start: { dateTime: "2026-07-25T01:00:00Z" },
                  end: { dateTime: "2026-07-25T02:00:00Z" }
                },
                { id: "cancelled", status: "cancelled" }
              ]
            });
          }
          return jsonResponse({
            items: [
              {
                id: "e1",
                status: "confirmed",
                summary: "First page",
                start: { dateTime: "2026-07-24T01:00:00Z" },
                end: { dateTime: "2026-07-24T02:00:00Z" }
              }
            ],
            nextPageToken: "event-next"
          });
        }

        return jsonResponse({ items: [] });
      })
    );

    const { adminClient, deletedEventRowIds, upsertedEventIds } = createAdminMock();
    const result = await syncGoogleCalendarSnapshot({
      accessToken: "access-token",
      accountEmail: "user@example.com",
      connectionId: "connection-id",
      calendarState: { sourceSelectionInitialized: true },
      adminClient: adminClient as unknown as Parameters<typeof syncGoogleCalendarSnapshot>[0]["adminClient"]
    });

    expect(result).toMatchObject({ ok: true, partial: false, syncedCount: 3 });
    expect(upsertedEventIds).toEqual(["c1:e1", "c1:e2"]);
    expect(deletedEventRowIds).toContain("stale-cancelled-row");
    expect(requestedUrls.some((url) => url.includes("pageToken=calendar-next"))).toBe(true);
    expect(requestedUrls.some((url) => url.includes("pageToken=event-next"))).toBe(true);
  });
});
