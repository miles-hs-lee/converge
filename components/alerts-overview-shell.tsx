import type { CalendarConflict } from "@/lib/calendar-conflicts";
import type { CalendarEventRow } from "@/components/calendar-events-overview";
import { AlertsOverviewClient } from "@/components/alerts-overview-client";

type AlertsOverviewShellProps = {
  events: CalendarEventRow[];
  initialConflicts: CalendarConflict[];
  tenants: string[];
};

export function AlertsOverviewShell({ events, initialConflicts, tenants }: AlertsOverviewShellProps) {
  return <AlertsOverviewClient events={events} initialConflicts={initialConflicts} tenants={tenants} />;
}
