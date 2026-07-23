import { describe, expect, it } from "vitest";
import { shouldRunByStaleness } from "../lib/sync-staleness";

describe("shouldRunByStaleness", () => {
  it("retries a failed sync even when its last attempt is recent", () => {
    expect(
      shouldRunByStaleness({
        state: {
          people: {
            ok: false,
            syncedAt: new Date().toISOString()
          }
        },
        key: "people",
        staleMs: 24 * 60 * 60 * 1000
      })
    ).toBe(true);
  });

  it("skips a recent successful sync", () => {
    expect(
      shouldRunByStaleness({
        state: {
          calendar: {
            ok: true,
            syncedAt: new Date().toISOString()
          }
        },
        key: "calendar",
        staleMs: 10 * 60 * 1000
      })
    ).toBe(false);
  });

  it("runs when a successful sync is stale", () => {
    expect(
      shouldRunByStaleness({
        state: {
          calendar: {
            ok: true,
            syncedAt: new Date(Date.now() - 11 * 60 * 1000).toISOString()
          }
        },
        key: "calendar",
        staleMs: 10 * 60 * 1000
      })
    ).toBe(true);
  });
});
