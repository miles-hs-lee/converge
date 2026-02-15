export type CalendarEventLike = {
  id: string;
  tenantName: string;
  subject: string;
  startAt: string;
  endAt: string;
  location?: string;
  sourceAccount?: string;
};

export type CalendarConflict = {
  key: string;
  overlapStart: string;
  overlapEnd: string;
  a: CalendarEventLike;
  b: CalendarEventLike;
};

function sortPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function toTs(iso: string): number | null {
  const dt = new Date(iso);
  const ts = dt.getTime();
  return Number.isNaN(ts) ? null : ts;
}

export function detectTenantConflicts(events: CalendarEventLike[], opts?: { minOverlapMs?: number }): CalendarConflict[] {
  const minOverlapMs = Math.max(1, opts?.minOverlapMs ?? 60 * 1000); // default: >= 1 minute overlap

  // Basic sweep: sort by start time.
  const normalized = events
    .map((e) => ({ e, start: toTs(e.startAt), end: toTs(e.endAt) }))
    .filter((row): row is { e: CalendarEventLike; start: number; end: number } => row.start !== null && row.end !== null && row.end > row.start)
    .sort((x, y) => x.start - y.start);

  const conflicts: CalendarConflict[] = [];

  for (let i = 0; i < normalized.length; i += 1) {
    const cur = normalized[i]!;
    for (let j = i + 1; j < normalized.length; j += 1) {
      const next = normalized[j]!;

      // Since sorted by start, if next starts after cur ends, no further overlaps for cur.
      if (next.start >= cur.end) break;

      // Different tenant only.
      if (cur.e.tenantName === next.e.tenantName) continue;

      const overlapStartTs = Math.max(cur.start, next.start);
      const overlapEndTs = Math.min(cur.end, next.end);
      const overlapMs = overlapEndTs - overlapStartTs;
      if (overlapMs < minOverlapMs) continue;

      const [idLow, idHigh] = sortPair(cur.e.id, next.e.id);
      const key = `${idLow}|${idHigh}`;

      conflicts.push({
        key,
        overlapStart: new Date(overlapStartTs).toISOString(),
        overlapEnd: new Date(overlapEndTs).toISOString(),
        a: cur.e,
        b: next.e
      });
    }
  }

  // Stable ordering: earliest overlap first.
  conflicts.sort((x, y) => new Date(x.overlapStart).getTime() - new Date(y.overlapStart).getTime());
  return conflicts;
}

