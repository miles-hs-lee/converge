export const analyticsEvents = {
  onboardingViewed: "converge.onboarding_viewed",
  loginViewed: "converge.login_viewed",
  navTabOpened: "converge.nav.tab_opened",
  oauthStart: "converge.auth.oauth_start",
  oauthFailed: "converge.auth.oauth_failed",
  oauthConnected: "converge.auth.oauth_connected",
  manualSyncStarted: "converge.sync.manual_started",
  manualSyncCompleted: "converge.sync.manual_completed",
  syncEntryAutoCompleted: "converge.sync.entry_auto_completed",
  calendarViewModeChanged: "converge.calendar.view_mode_changed",
  calendarSearchSubmitted: "converge.calendar.search_submitted",
  calendarFilterChanged: "converge.calendar.filter_changed",
  calendarSourcesSaved: "converge.calendar.sources_saved",
  calendarEventOpened: "converge.calendar.event_opened",
  conflictsViewed: "converge.conflicts.viewed",
  conflictsItemOpened: "converge.conflicts.item_opened",
  peopleSearchSubmitted: "converge.people.search_submitted",
  peopleProfileOpened: "converge.people.profile_opened",
  peopleQuickActionClicked: "converge.people.quick_action_clicked",
  peopleFavoriteToggled: "converge.people.favorite_toggled",
  connectionDeleted: "converge.connection.deleted",
  notificationsPermissionChanged: "converge.notifications.permission_changed"
} as const;

export type AnalyticsEventName = (typeof analyticsEvents)[keyof typeof analyticsEvents];

export const analyticsEventSet = new Set<AnalyticsEventName>(Object.values(analyticsEvents));

export function isBlockedAnalyticsEventName(rawEventName: string): boolean {
  const normalized = rawEventName.trim().toLowerCase();
  return normalized.startsWith("converge.debug");
}
