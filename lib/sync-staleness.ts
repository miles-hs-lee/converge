function readSyncedAt(raw: unknown): number | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const syncedAt = (raw as Record<string, unknown>).syncedAt;
  if (typeof syncedAt !== "string") {
    return null;
  }
  const parsed = Date.parse(syncedAt);
  return Number.isFinite(parsed) ? parsed : null;
}

export function shouldRunByStaleness(params: {
  state: Record<string, unknown>;
  key: "calendar" | "people";
  staleMs?: number;
}): boolean {
  const { state, key, staleMs } = params;
  if (!staleMs || staleMs <= 0) {
    return true;
  }

  const section = state[key];
  if (section && typeof section === "object" && !Array.isArray(section) && (section as Record<string, unknown>).ok === false) {
    return true;
  }
  const syncedAt = readSyncedAt(section);
  if (!syncedAt) {
    return true;
  }
  return Date.now() - syncedAt >= staleMs;
}
