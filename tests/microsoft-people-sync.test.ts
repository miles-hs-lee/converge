import { describe, expect, it, vi } from "vitest";
import { syncMicrosoftPeopleSnapshot } from "../lib/microsoft-sync";

describe("syncMicrosoftPeopleSnapshot", () => {
  it("reports a directory permission failure instead of falling back to /me", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "Authorization_RequestDenied",
            message: "Insufficient privileges to complete the operation."
          }
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" }
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncMicrosoftPeopleSnapshot({
      accessToken: "access-token",
      connectionId: "connection-id",
      adminClient: {} as Parameters<typeof syncMicrosoftPeopleSnapshot>[0]["adminClient"]
    });

    expect(result).toEqual({
      ok: false,
      partial: false,
      syncedCount: 0,
      statePatch: { error: "graph_users_failed:403" }
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/v1.0/users");
  });
});
