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

function normalizeKeyPart(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function compareText(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function compareEvents(a: CalendarEventLike, b: CalendarEventLike): number {
  return (
    compareText(normalizeKeyPart(a.tenantName), normalizeKeyPart(b.tenantName)) ||
    compareText(a.startAt, b.startAt) ||
    compareText(a.endAt, b.endAt) ||
    compareText(normalizeKeyPart(a.subject), normalizeKeyPart(b.subject)) ||
    compareText(a.id, b.id)
  );
}

function orderConflictPair(a: CalendarEventLike, b: CalendarEventLike): [CalendarEventLike, CalendarEventLike] {
  return compareEvents(a, b) <= 0 ? [a, b] : [b, a];
}

function eventFingerprint(event: CalendarEventLike): string {
  return [
    normalizeKeyPart(event.tenantName),
    normalizeKeyPart(event.subject),
    new Date(event.startAt).getTime(),
    new Date(event.endAt).getTime()
  ].join("|");
}

function toTs(iso: string): number | null {
  const dt = new Date(iso);
  const ts = dt.getTime();
  return Number.isNaN(ts) ? null : ts;
}

function isSameTitleAndTime(a: { subject: string; start: number; end: number }, b: { subject: string; start: number; end: number }): boolean {
  return (
    a.start === b.start &&
    a.end === b.end &&
    normalizeKeyPart(a.subject) === normalizeKeyPart(b.subject)
  );
}

export function detectTenantConflicts(events: CalendarEventLike[], opts?: { minOverlapMs?: number }): CalendarConflict[] {
  const minOverlapMs = Math.max(1, opts?.minOverlapMs ?? 60 * 1000); // default: >= 1 minute overlap

  // Basic sweep: sort by start time.
  const normalized = events
    .map((e) => ({ e, start: toTs(e.startAt), end: toTs(e.endAt) }))
    .filter((row): row is { e: CalendarEventLike; start: number; end: number } => row.start !== null && row.end !== null && row.end > row.start)
    .sort((x, y) => x.start - y.start);

  const conflictByKey = new Map<string, CalendarConflict>();

  for (let i = 0; i < normalized.length; i += 1) {
    const cur = normalized[i]!;
    for (let j = i + 1; j < normalized.length; j += 1) {
      const next = normalized[j]!;

      // Since sorted by start, if next starts after cur ends, no further overlaps for cur.
      if (next.start >= cur.end) break;

      // Different tenant only.
      if (cur.e.tenantName === next.e.tenantName) continue;

      // If title + time are identical across tenants, treat it as the same shared meeting.
      if (
        isSameTitleAndTime(
          { subject: cur.e.subject, start: cur.start, end: cur.end },
          { subject: next.e.subject, start: next.start, end: next.end }
        )
      ) {
        continue;
      }

      const overlapStartTs = Math.max(cur.start, next.start);
      const overlapEndTs = Math.min(cur.end, next.end);
      const overlapMs = overlapEndTs - overlapStartTs;
      if (overlapMs < minOverlapMs) continue;

      const [a, b] = orderConflictPair(cur.e, next.e);
      const [fpLow, fpHigh] = sortPair(eventFingerprint(a), eventFingerprint(b));
      const key = `${fpLow}|${fpHigh}|${overlapStartTs}|${overlapEndTs}`;

      if (conflictByKey.has(key)) continue;

      conflictByKey.set(key, {
        key,
        overlapStart: new Date(overlapStartTs).toISOString(),
        overlapEnd: new Date(overlapEndTs).toISOString(),
        a,
        b
      });
    }
  }

  // Stable ordering: earliest overlap first.
  const conflicts = [...conflictByKey.values()];
  conflicts.sort((x, y) => new Date(x.overlapStart).getTime() - new Date(y.overlapStart).getTime());
  return conflicts;
}
