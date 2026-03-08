const DAY_MS = 24 * 60 * 60 * 1000;

function parsePositiveInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = raw ? Number(raw) : fallback;
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  const value = Math.floor(parsed);
  if (value < min || value > max) {
    return fallback;
  }
  return value;
}

export const CALENDAR_LOOKBACK_DAYS = parsePositiveInt(process.env.CALENDAR_LOOKBACK_DAYS, 14, 1, 180);
export const CALENDAR_LOOKAHEAD_DAYS = parsePositiveInt(process.env.CALENDAR_LOOKAHEAD_DAYS, 60, 7, 365);

export function buildCalendarWindow(nowTs = Date.now()): { fromIso: string; toIso: string } {
  return {
    fromIso: new Date(nowTs - DAY_MS * CALENDAR_LOOKBACK_DAYS).toISOString(),
    toIso: new Date(nowTs + DAY_MS * CALENDAR_LOOKAHEAD_DAYS).toISOString()
  };
}
