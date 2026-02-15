export const SUPPORTED_LOCALES = ["ko-KR", "en-US", "ja-JP"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ko-KR";

export function isSupportedLocale(value: string | null | undefined): value is Locale {
  if (!value) return false;
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function normalizeLocale(value: string | null | undefined): Locale {
  return isSupportedLocale(value) ? value : DEFAULT_LOCALE;
}

export function htmlLang(locale: Locale): "ko" | "en" | "ja" {
  if (locale.startsWith("en")) return "en";
  if (locale.startsWith("ja")) return "ja";
  return "ko";
}

export function intlLocale(locale: Locale): string {
  // Keep as full BCP-47 tags where possible.
  return locale;
}

export type I18nKey =
  | "brand.subtitle"
  | "nav.calendar"
  | "nav.people"
  | "nav.settings"
  | "nav.login"
  | "nav.logout"
  | "weekday.mon"
  | "weekday.tue"
  | "weekday.wed"
  | "weekday.thu"
  | "weekday.fri"
  | "weekday.sat"
  | "weekday.sun"
  | "common.close"
  | "common.prev"
  | "common.today"
  | "common.next"
  | "common.day"
  | "common.week"
  | "common.month"
  | "common.more"
  | "common.total"
  | "calendar.title"
  | "calendar.subtitle"
  | "calendar.connectedTenants"
  | "calendar.visibleEvents"
  | "calendar.searchPlaceholder"
  | "calendar.rangeTitle"
  | "calendar.rangeCurrent"
  | "calendar.range3"
  | "calendar.range7"
  | "calendar.past"
  | "calendar.upcoming"
  | "calendar.none"
  | "calendar.attendeesCount"
  | "alerts.title"
  | "alerts.subtitle"
  | "alerts.count"
  | "alerts.none"
  | "alerts.enableNotifications"
  | "alerts.disableNotifications"
  | "alerts.permissionDenied"
  | "alerts.dismiss"
  | "alerts.dismissed"
  | "alerts.simulate"
  | "alerts.rescan"
  | "alerts.banner"
  | "alerts.test"
  | "alerts.permission"
  | "alerts.lastSent"
  | "alerts.notificationTitle"
  | "alerts.notificationBody"
  | "push.title"
  | "push.subtitle"
  | "push.notSupported"
  | "push.configMissing"
  | "push.permissionBlocked"
  | "push.permission"
  | "push.lastTest"
  | "push.endpointHint"
  | "push.status.subscribed"
  | "push.status.notSubscribed"
  | "push.subscribe"
  | "push.unsubscribe"
  | "push.test"
  | "push.loginRequired"
  | "push.subscribed"
  | "push.unsubscribed"
  | "push.subscribeFailed"
  | "push.unsubscribeFailed"
  | "push.testSent"
  | "push.testFailed"
  | "event.detailTitle"
  | "event.sourceTenant"
  | "event.sourceAccount"
  | "event.location"
  | "event.attendees"
  | "event.attendeesEmpty"
  | "settings.title"
  | "settings.subtitle"
  | "settings.addMicrosoft"
  | "settings.addGoogle"
  | "settings.connectionsTitle"
  | "settings.connectionsLoginRequired"
  | "settings.connectionsEmpty"
  | "settings.providerMicrosoft"
  | "settings.providerGoogle"
  | "settings.expires"
  | "settings.sessionTitle"
  | "settings.sessionSubtitle"
  | "settings.signOut"
  | "settings.languageTitle"
  | "settings.languageSubtitle"
  | "settings.language.ko"
  | "settings.language.en"
  | "settings.language.ja"
  | "pwa.title"
  | "pwa.subtitle"
  | "pwa.cta"
  | "pwa.installed"
  | "pwa.unavailable"
  | "pwa.iosHint"
  | "status.oauth_connected"
  | "status.oauth_error"
  | "status.google_oauth_connected"
  | "status.google_oauth_error"
  | "status.google_invalid_state"
  | "status.google_missing_code"
  | "status.google_token_exchange_failed"
  | "status.google_token_payload_invalid"
  | "status.google_profile_failed"
  | "status.google_profile_incomplete"
  | "status.google_refresh_token_missing"
  | "status.google_oauth_connected_partial_sync"
  | "status.google_oauth_connected_sync_failed"
  | "status.google_config_missing"
  | "status.invalid_state"
  | "status.missing_code"
  | "status.auth_required"
  | "status.token_exchange_failed"
  | "status.token_payload_invalid"
  | "status.graph_me_failed"
  | "status.profile_incomplete"
  | "status.db_primary_check_failed"
  | "status.db_connection_read_failed"
  | "status.db_app_user_failed"
  | "status.db_connection_upsert_failed"
  | "login.title"
  | "login.subtitle"
  | "login.feature.calendar"
  | "login.feature.people"
  | "login.feature.multitenant"
  | "login.emailLabel"
  | "login.magicLinkCta"
  | "login.microsoftCta"
  | "login.onboardingCta"
  | "login.status.magic_link_sent"
  | "login.status.invalid_email"
  | "login.status.magic_link_error"
  | "login.status.auth_callback_error"
  | "login.status.signed_out"
  | "onboarding.start"
  | "onboarding.heroTitle"
  | "onboarding.heroDesc"
  | "onboarding.coreLabel"
  | "onboarding.core1Title"
  | "onboarding.core1Desc"
  | "onboarding.core2Title"
  | "onboarding.core2Desc"
  | "onboarding.core3Title"
  | "onboarding.core3Desc"
  | "onboarding.core4Title"
  | "onboarding.core4Desc"
  | "onboarding.howTitle"
  | "onboarding.step1Title"
  | "onboarding.step1Desc"
  | "onboarding.step2Title"
  | "onboarding.step2Desc"
  | "onboarding.step3Title"
  | "onboarding.step3Desc"
  | "onboarding.screensTitle"
  | "onboarding.screensDesc"
  | "onboarding.screen.calendarTitle"
  | "onboarding.screen.calendarDesc"
  | "onboarding.screen.peopleTitle"
  | "onboarding.screen.peopleDesc"
  | "onboarding.screen.settingsTitle"
  | "onboarding.screen.settingsDesc"
  | "onboarding.viewCalendar"
  | "people.title"
  | "people.subtitle"
  | "people.searchCount"
  | "people.searchPlaceholder"
  | "people.sort.default"
  | "people.sort.tenant"
  | "people.favoritesTitle"
  | "people.favoritesHint"
  | "people.recentsTitle"
  | "people.recentsHint"
  | "people.noResults"
  | "people.favoriteAdd"
  | "people.favoriteRemove"
  | "people.action.favorite"
  | "people.action.mail"
  | "people.action.teams"
  | "people.action.meeting"
  | "people.copyMail"
  | "people.copyMailDone"
  | "people.copyPhone"
  | "people.copyPhoneDone"
  | "people.field.mail"
  | "people.field.phone"
  | "people.field.office"
  | "people.field.tenant"
  | "people.unknown.jobTitle"
  | "people.unknown.department"
  | "people.unknown.office"
  | "people.unknown.phone"
  | "common.unknownAccount"
  | "common.untitled"
  | "common.locationUnknown";

type Dict = Record<I18nKey, string>;

const enUS: Dict = {
  "brand.subtitle": "Unified M365 Workspace",
  "nav.calendar": "Calendar",
  "nav.people": "People",
  "nav.settings": "Settings",
  "nav.login": "Sign in",
  "nav.logout": "Sign out",
  "weekday.mon": "Mon",
  "weekday.tue": "Tue",
  "weekday.wed": "Wed",
  "weekday.thu": "Thu",
  "weekday.fri": "Fri",
  "weekday.sat": "Sat",
  "weekday.sun": "Sun",
  "common.close": "Close",
  "common.prev": "Prev",
  "common.today": "Today",
  "common.next": "Next",
  "common.day": "Day",
  "common.week": "Week",
  "common.month": "Month",
  "common.more": "{count} more",
  "common.total": "Total {count}",
  "calendar.title": "Unified Calendar",
  "calendar.subtitle": "Manage connected calendars in one week/month view.",
  "calendar.connectedTenants": "Connected tenants {count}",
  "calendar.visibleEvents": "Visible events {count}",
  "calendar.searchPlaceholder": "Search events (title/location/tenant/attendee)",
  "calendar.rangeTitle": "Events around today",
  "calendar.rangeCurrent": "Current range: ±{days} days",
  "calendar.range3": "±3 days",
  "calendar.range7": "±7 days",
  "calendar.past": "Past",
  "calendar.upcoming": "Upcoming",
  "calendar.none": "No events.",
  "calendar.attendeesCount": "{count} attendees",
  "alerts.title": "Conflict alerts",
  "alerts.subtitle": "Detect overlapping events across different tenants.",
  "alerts.count": "{count} conflicts",
  "alerts.none": "No conflicts detected in the current window.",
  "alerts.enableNotifications": "Enable notifications",
  "alerts.disableNotifications": "Disable notifications",
  "alerts.permissionDenied": "Notification permission is blocked in this browser.",
  "alerts.dismiss": "Dismiss",
  "alerts.dismissed": "Dismissed",
  "alerts.simulate": "Simulate new conflict",
  "alerts.rescan": "Rescan",
  "alerts.banner": "New schedule conflicts detected: {count}",
  "alerts.test": "Send test notification",
  "alerts.permission": "Permission: {value}",
  "alerts.lastSent": "Last sent: {value}",
  "alerts.notificationTitle": "Schedule conflict ({count})",
  "alerts.notificationBody": "Overlapping events detected across tenants: {a} vs {b} ({start}-{end}). Tap to review.",
  "push.title": "Background push",
  "push.subtitle": "Receive alerts even when the app is closed (requires Web Push subscription).",
  "push.notSupported": "This browser does not support Web Push on this device.",
  "push.configMissing": "Push is not configured. Set VAPID keys on the server.",
  "push.permissionBlocked": "Notification permission is not granted.",
  "push.permission": "Permission: {value}",
  "push.lastTest": "Last test: {value}",
  "push.endpointHint": "Endpoint: {value}",
  "push.status.subscribed": "Subscribed",
  "push.status.notSubscribed": "Not subscribed",
  "push.subscribe": "Enable push",
  "push.unsubscribe": "Disable push",
  "push.test": "Send test push",
  "push.loginRequired": "Sign in to enable background push.",
  "push.subscribed": "Push subscription saved.",
  "push.unsubscribed": "Push subscription removed.",
  "push.subscribeFailed": "Failed to subscribe to push.",
  "push.unsubscribeFailed": "Failed to unsubscribe from push.",
  "push.testSent": "Test push requested. Check your notification tray.",
  "push.testFailed": "Failed to send test push.",
  "event.detailTitle": "Event Detail",
  "event.sourceTenant": "Source tenant",
  "event.sourceAccount": "Source account",
  "event.location": "Location",
  "event.attendees": "Attendees",
  "event.attendeesEmpty": "No attendee details available.",
  "settings.title": "Settings",
  "settings.subtitle": "Manage connections and sessions.",
  "settings.addMicrosoft": "Add Microsoft account",
  "settings.addGoogle": "Add Google Calendar",
  "settings.connectionsTitle": "Connected accounts",
  "settings.connectionsLoginRequired": "Sign in to see your connections.",
  "settings.connectionsEmpty": "No connected accounts.",
  "settings.providerMicrosoft": "Microsoft",
  "settings.providerGoogle": "Google",
  "settings.expires": "Expires",
  "settings.sessionTitle": "Session",
  "settings.sessionSubtitle": "Sign out safely on this device.",
  "settings.signOut": "Sign out",
  "settings.languageTitle": "Language",
  "settings.languageSubtitle": "Choose your UI language. This preference is saved to your account.",
  "settings.language.ko": "Korean",
  "settings.language.en": "English",
  "settings.language.ja": "Japanese",
  "pwa.title": "Install app",
  "pwa.subtitle": "Install Converge for faster launch and an app-like experience.",
  "pwa.cta": "Install",
  "pwa.installed": "Converge is already installed on this device.",
  "pwa.unavailable": "Install is not available in this browser yet.",
  "pwa.iosHint": "On iOS Safari: tap Share and choose “Add to Home Screen”.",
  "status.oauth_connected": "Microsoft account connected.",
  "status.oauth_error": "Microsoft authentication failed.",
  "status.google_oauth_connected": "Google account connected.",
  "status.google_oauth_error": "Google authentication failed.",
  "status.google_invalid_state": "Google OAuth state validation failed.",
  "status.google_missing_code": "Missing Google authorization code.",
  "status.google_token_exchange_failed": "Failed to exchange Google token.",
  "status.google_token_payload_invalid": "Invalid Google token response.",
  "status.google_profile_failed": "Failed to fetch Google profile.",
  "status.google_profile_incomplete": "Google profile is incomplete.",
  "status.google_refresh_token_missing": "Missing Google refresh token. Please reconnect.",
  "status.google_oauth_connected_partial_sync": "Google connected, but some calendars failed to sync.",
  "status.google_oauth_connected_sync_failed": "Google connected, but initial calendar sync failed.",
  "status.google_config_missing": "Google OAuth configuration is missing.",
  "status.invalid_state": "OAuth state validation failed.",
  "status.missing_code": "Missing authorization code.",
  "status.auth_required": "Please sign in first.",
  "status.token_exchange_failed": "Failed to exchange token.",
  "status.token_payload_invalid": "Invalid token response.",
  "status.graph_me_failed": "Failed to fetch Microsoft profile.",
  "status.profile_incomplete": "Profile is incomplete.",
  "status.db_primary_check_failed": "Failed to check existing connections.",
  "status.db_connection_read_failed": "Failed to read connections.",
  "status.db_app_user_failed": "Failed to save app user.",
  "status.db_connection_upsert_failed": "Failed to save connection.",
  "login.title": "Start with your primary account",
  "login.subtitle": "After signing in, you can use the unified calendar and multi-tenant people search right away.",
  "login.feature.calendar": "Unified calendar",
  "login.feature.people": "People search",
  "login.feature.multitenant": "Multi-tenant",
  "login.emailLabel": "Email",
  "login.magicLinkCta": "Sign in with magic link",
  "login.microsoftCta": "Continue with Microsoft",
  "login.onboardingCta": "View onboarding",
  "login.status.magic_link_sent": "We sent a magic link. Open the login link in your email.",
  "login.status.invalid_email": "Please enter a valid email address.",
  "login.status.magic_link_error": "Failed to send magic link. Check Supabase Auth settings.",
  "login.status.auth_callback_error": "Failed to process login callback.",
  "login.status.signed_out": "Signed out safely.",
  "onboarding.start": "Get started",
  "onboarding.heroTitle": "One workspace for multi-tenant Microsoft 365",
  "onboarding.heroDesc":
    "Converge unifies calendars and directory data across multiple tenants in a single view. Standardize search and actions (email, Teams chat, meeting creation) to reduce context switching, and proactively detect cross-tenant schedule conflicts.",
  "onboarding.coreLabel": "Core feature {index}",
  "onboarding.core1Title": "Unified calendar",
  "onboarding.core1Desc": "Aggregate schedules across tenants with tenant-level controls and search in week/month views.",
  "onboarding.core2Title": "Directory search",
  "onboarding.core2Desc": "Search by name/department/tenant and move straight to email, Teams chat, or meeting creation.",
  "onboarding.core3Title": "Conflict detection",
  "onboarding.core3Desc": "Detect overlapping events across tenants and review them with in-app alerts and optional notifications.",
  "onboarding.core4Title": "Connection management",
  "onboarding.core4Desc": "Connect additional Microsoft accounts and manage connection status centrally in Settings.",
  "onboarding.howTitle": "How it works",
  "onboarding.step1Title": "Authenticate",
  "onboarding.step1Desc": "Start with your primary account (Supabase Auth or Microsoft).",
  "onboarding.step2Title": "Connect tenants",
  "onboarding.step2Desc": "Add additional tenant accounts in Settings.",
  "onboarding.step3Title": "Search and act",
  "onboarding.step3Desc": "Use the unified calendar and directory search, then complete actions with one click.",
  "onboarding.screensTitle": "Real screenshots",
  "onboarding.screensDesc": "Screens captured from the currently deployed Converge build.",
  "onboarding.screen.calendarTitle": "Unified calendar",
  "onboarding.screen.calendarDesc": "Cross-tenant aggregation with search, week/month navigation, and detailed event review.",
  "onboarding.screen.peopleTitle": "Directory search",
  "onboarding.screen.peopleDesc": "Profile-based quick actions for email, Teams chat, and meeting creation.",
  "onboarding.screen.settingsTitle": "Settings",
  "onboarding.screen.settingsDesc": "Manage connections, language, install, and notification preferences.",
  "onboarding.viewCalendar": "Open calendar",
  "people.title": "People",
  "people.subtitle": "Search employees and communicate faster with profile-based quick actions.",
  "people.searchCount": "Search scope {count}",
  "people.searchPlaceholder": "Search name, email, department, tenant",
  "people.sort.default": "Default",
  "people.sort.tenant": "Group by tenant",
  "people.favoritesTitle": "Favorite people",
  "people.favoritesHint": "Add favorites using the star button in the profile popup.",
  "people.recentsTitle": "Recently viewed",
  "people.recentsHint": "Open a profile to add it to your recent list.",
  "people.noResults": "No results found.",
  "people.favoriteAdd": "Add to favorites",
  "people.favoriteRemove": "Remove from favorites",
  "people.action.favorite": "Favorite",
  "people.action.mail": "Compose email",
  "people.action.teams": "Open Teams chat",
  "people.action.meeting": "Create meeting",
  "people.copyMail": "Copy email",
  "people.copyMailDone": "Email copied",
  "people.copyPhone": "Copy phone",
  "people.copyPhoneDone": "Phone copied",
  "people.field.mail": "Email",
  "people.field.phone": "Phone",
  "people.field.office": "Office",
  "people.field.tenant": "Tenant",
  "people.unknown.jobTitle": "(No title)",
  "people.unknown.department": "(No department)",
  "people.unknown.office": "(No location)",
  "people.unknown.phone": "(No phone)",
  "common.unknownAccount": "Unknown account",
  "common.untitled": "(Untitled)",
  "common.locationUnknown": "Unspecified"
};

const koKR: Dict = {
  "brand.subtitle": "통합 M365 워크스페이스",
  "nav.calendar": "캘린더",
  "nav.people": "조직도",
  "nav.settings": "설정",
  "nav.login": "로그인",
  "nav.logout": "로그아웃",
  "weekday.mon": "월",
  "weekday.tue": "화",
  "weekday.wed": "수",
  "weekday.thu": "목",
  "weekday.fri": "금",
  "weekday.sat": "토",
  "weekday.sun": "일",
  "common.close": "닫기",
  "common.prev": "이전",
  "common.today": "오늘",
  "common.next": "다음",
  "common.day": "일간",
  "common.week": "주간",
  "common.month": "월간",
  "common.more": "+{count} more",
  "common.total": "총 {count}",
  "calendar.title": "통합 캘린더",
  "calendar.subtitle": "연결된 계정 일정을 한 화면에서 주간/월간으로 관리합니다.",
  "calendar.connectedTenants": "연결 테넌트 {count}개",
  "calendar.visibleEvents": "표시 일정 {count}건",
  "calendar.searchPlaceholder": "일정 검색 (제목/장소/테넌트/참석자)",
  "calendar.rangeTitle": "오늘 기준 전후 일정",
  "calendar.rangeCurrent": "현재 필터: ±{days}일",
  "calendar.range3": "±3일",
  "calendar.range7": "±7일",
  "calendar.past": "지난 일정",
  "calendar.upcoming": "예정 일정",
  "calendar.none": "해당 일정이 없습니다.",
  "calendar.attendeesCount": "참석자 {count}명",
  "alerts.title": "일정 충돌 알림",
  "alerts.subtitle": "서로 다른 테넌트에서 시간이 겹치는 일정을 감지합니다.",
  "alerts.count": "충돌 {count}건",
  "alerts.none": "현재 범위에서 감지된 충돌이 없습니다.",
  "alerts.enableNotifications": "알림 켜기",
  "alerts.disableNotifications": "알림 끄기",
  "alerts.permissionDenied": "현재 브라우저에서 알림 권한이 차단되어 있습니다.",
  "alerts.dismiss": "숨기기",
  "alerts.dismissed": "숨김 처리됨",
  "alerts.simulate": "새 충돌 생성(테스트)",
  "alerts.rescan": "재검사",
  "alerts.banner": "새 일정 충돌이 감지되었습니다: {count}건",
  "alerts.test": "테스트 알림 보내기",
  "alerts.permission": "권한: {value}",
  "alerts.lastSent": "마지막 발송: {value}",
  "alerts.notificationTitle": "일정 충돌 ({count}건)",
  "alerts.notificationBody": "테넌트 간 시간이 겹치는 일정이 감지되었습니다: {a} vs {b} ({start}-{end}). 눌러서 확인하세요.",
  "push.title": "백그라운드 푸시",
  "push.subtitle": "앱이 닫혀 있어도 알림을 받습니다(Web Push 구독 필요).",
  "push.notSupported": "현재 디바이스/브라우저에서는 Web Push를 지원하지 않습니다.",
  "push.configMissing": "푸시가 설정되지 않았습니다. 서버에 VAPID 키를 설정하세요.",
  "push.permissionBlocked": "알림 권한이 허용되지 않았습니다.",
  "push.permission": "권한: {value}",
  "push.lastTest": "마지막 테스트: {value}",
  "push.endpointHint": "Endpoint: {value}",
  "push.status.subscribed": "구독됨",
  "push.status.notSubscribed": "미구독",
  "push.subscribe": "푸시 켜기",
  "push.unsubscribe": "푸시 끄기",
  "push.test": "테스트 푸시",
  "push.loginRequired": "백그라운드 푸시는 로그인 후 사용할 수 있습니다.",
  "push.subscribed": "푸시 구독을 저장했습니다.",
  "push.unsubscribed": "푸시 구독을 해제했습니다.",
  "push.subscribeFailed": "푸시 구독에 실패했습니다.",
  "push.unsubscribeFailed": "푸시 구독 해제에 실패했습니다.",
  "push.testSent": "테스트 푸시를 요청했습니다. 알림 창을 확인하세요.",
  "push.testFailed": "테스트 푸시 전송에 실패했습니다.",
  "event.detailTitle": "일정 상세",
  "event.sourceTenant": "원본 테넌트",
  "event.sourceAccount": "원본 계정",
  "event.location": "장소",
  "event.attendees": "참석자",
  "event.attendeesEmpty": "표시 가능한 참석자 정보가 없습니다.",
  "settings.title": "설정",
  "settings.subtitle": "M365 계정 연결 상태와 세션을 관리합니다.",
  "settings.addMicrosoft": "Microsoft 계정 추가",
  "settings.addGoogle": "Google 캘린더 추가",
  "settings.connectionsTitle": "연결 계정",
  "settings.connectionsLoginRequired": "로그인 후 연결 정보를 확인할 수 있습니다.",
  "settings.connectionsEmpty": "연결된 계정이 없습니다.",
  "settings.providerMicrosoft": "Microsoft",
  "settings.providerGoogle": "Google",
  "settings.expires": "만료",
  "settings.sessionTitle": "세션",
  "settings.sessionSubtitle": "현재 디바이스에서 안전하게 로그아웃합니다.",
  "settings.signOut": "로그아웃",
  "settings.languageTitle": "언어",
  "settings.languageSubtitle": "전반적인 UI 언어를 선택합니다. 설정은 계정에 저장됩니다.",
  "settings.language.ko": "한국어",
  "settings.language.en": "영어",
  "settings.language.ja": "일본어",
  "pwa.title": "앱 설치",
  "pwa.subtitle": "Converge를 홈 화면에 설치해서 더 빠르게 실행하고 앱처럼 사용하세요.",
  "pwa.cta": "설치하기",
  "pwa.installed": "이 디바이스에 이미 설치되어 있습니다.",
  "pwa.unavailable": "현재 브라우저에서는 설치 기능을 사용할 수 없습니다.",
  "pwa.iosHint": "iOS Safari: 공유 버튼 → “홈 화면에 추가”를 선택하세요.",
  "status.oauth_connected": "Microsoft 계정 연결이 완료되었습니다.",
  "status.oauth_error": "Microsoft 인증 중 오류가 발생했습니다.",
  "status.google_oauth_connected": "Google 계정 연결이 완료되었습니다.",
  "status.google_oauth_error": "Google 인증 중 오류가 발생했습니다.",
  "status.google_invalid_state": "Google OAuth state 검증에 실패했습니다.",
  "status.google_missing_code": "Google 인증 코드가 누락되었습니다.",
  "status.google_token_exchange_failed": "Google 토큰 교환에 실패했습니다.",
  "status.google_token_payload_invalid": "Google 토큰 응답이 유효하지 않습니다.",
  "status.google_profile_failed": "Google 프로필 조회에 실패했습니다.",
  "status.google_profile_incomplete": "Google 프로필 정보가 불완전합니다.",
  "status.google_refresh_token_missing": "Google refresh token을 받지 못했습니다. 다시 연결해주세요.",
  "status.google_oauth_connected_partial_sync": "Google 계정 연결은 완료되었지만 일부 캘린더 동기화에 실패했습니다.",
  "status.google_oauth_connected_sync_failed": "Google 계정 연결은 완료되었지만 초기 캘린더 동기화에 실패했습니다.",
  "status.google_config_missing": "Google OAuth 설정이 누락되었습니다.",
  "status.invalid_state": "OAuth state 검증에 실패했습니다.",
  "status.missing_code": "인증 코드가 누락되었습니다.",
  "status.auth_required": "먼저 로그인해 주세요.",
  "status.token_exchange_failed": "토큰 교환에 실패했습니다.",
  "status.token_payload_invalid": "토큰 응답이 유효하지 않습니다.",
  "status.graph_me_failed": "Microsoft 프로필 조회에 실패했습니다.",
  "status.profile_incomplete": "프로필 정보가 불완전합니다.",
  "status.db_primary_check_failed": "기존 연결 상태 확인 중 오류가 발생했습니다.",
  "status.db_connection_read_failed": "연결 계정 조회 중 오류가 발생했습니다.",
  "status.db_app_user_failed": "앱 사용자 저장에 실패했습니다.",
  "status.db_connection_upsert_failed": "연결 계정 저장에 실패했습니다.",
  "login.title": "메인 계정으로 시작",
  "login.subtitle": "로그인 후 통합 캘린더와 다중 테넌트 직원 검색을 바로 사용할 수 있습니다.",
  "login.feature.calendar": "통합 캘린더",
  "login.feature.people": "직원 검색",
  "login.feature.multitenant": "다중 테넌트",
  "login.emailLabel": "이메일",
  "login.magicLinkCta": "매직링크 로그인",
  "login.microsoftCta": "Microsoft 계정으로 계속",
  "login.onboardingCta": "온보딩 보기",
  "login.status.magic_link_sent": "매직링크를 보냈습니다. 이메일에서 로그인 링크를 열어주세요.",
  "login.status.invalid_email": "유효한 이메일 주소를 입력해주세요.",
  "login.status.magic_link_error": "매직링크 전송에 실패했습니다. Supabase Auth 설정을 확인해주세요.",
  "login.status.auth_callback_error": "로그인 콜백 처리에 실패했습니다.",
  "login.status.signed_out": "안전하게 로그아웃되었습니다.",
  "onboarding.start": "시작하기",
  "onboarding.heroTitle": "멀티 테넌트 Microsoft 365 운영을 하나의 워크스페이스로",
  "onboarding.heroDesc":
    "Converge는 여러 테넌트에 분산된 캘린더와 디렉터리(직원) 정보를 단일 화면에서 통합 제공합니다. 검색과 표준 액션(메일, Teams, 미팅 생성)으로 실행까지 연결해 전환 비용을 줄이고, 테넌트 간 일정 충돌을 선제적으로 탐지합니다.",
  "onboarding.coreLabel": "핵심 기능 {index}",
  "onboarding.core1Title": "통합 캘린더",
  "onboarding.core1Desc": "여러 테넌트 일정을 주간/월간으로 집계하고, 테넌트별 제어와 검색으로 즉시 파악합니다.",
  "onboarding.core2Title": "디렉터리 검색",
  "onboarding.core2Desc": "이름/부서/테넌트로 탐색하고 메일, Teams, 미팅 생성까지 즉시 실행합니다.",
  "onboarding.core3Title": "일정 충돌 탐지",
  "onboarding.core3Desc": "서로 다른 테넌트의 겹치는 일정을 감지하고 인앱/알림으로 안내합니다.",
  "onboarding.core4Title": "연결 관리",
  "onboarding.core4Desc": "Microsoft 계정을 추가 연결하고 연결 상태를 중앙에서 관리합니다.",
  "onboarding.howTitle": "도입 흐름",
  "onboarding.step1Title": "메인 계정 인증",
  "onboarding.step1Desc": "Supabase 인증 또는 Microsoft 계정으로 시작합니다.",
  "onboarding.step2Title": "추가 테넌트 연결",
  "onboarding.step2Desc": "설정에서 다른 테넌트 계정을 추가 연결합니다.",
  "onboarding.step3Title": "검색과 실행 표준화",
  "onboarding.step3Desc": "통합 캘린더/디렉터리에서 탐색하고 퀵 액션으로 즉시 실행합니다.",
  "onboarding.screensTitle": "실제 기능 화면",
  "onboarding.screensDesc": "현재 배포된 Converge 서비스 화면을 그대로 캡처한 이미지입니다.",
  "onboarding.screen.calendarTitle": "통합 캘린더",
  "onboarding.screen.calendarDesc": "테넌트 간 일정 집계, 검색, 주간/월간 탐색, 상세 확인까지 한 화면에서 수행합니다.",
  "onboarding.screen.peopleTitle": "디렉터리 검색",
  "onboarding.screen.peopleDesc": "프로필 기반 퀵 액션으로 메일, Teams 채팅, 미팅 생성을 즉시 실행합니다.",
  "onboarding.screen.settingsTitle": "설정",
  "onboarding.screen.settingsDesc": "계정 연결, 언어, 설치/알림 등 운영 설정을 관리합니다.",
  "onboarding.viewCalendar": "캘린더 보기",
  "people.title": "조직도",
  "people.subtitle": "직원 검색과 프로필 기반 빠른 커뮤니케이션을 지원합니다.",
  "people.searchCount": "검색 대상 {count}명",
  "people.searchPlaceholder": "이름, 이메일, 부서, 테넌트 검색",
  "people.sort.default": "기본",
  "people.sort.tenant": "테넌트 정렬",
  "people.favoritesTitle": "즐겨찾기 직원",
  "people.favoritesHint": "직원 상세에서 별 버튼으로 즐겨찾기를 추가하세요.",
  "people.recentsTitle": "최근 조회 직원",
  "people.recentsHint": "직원 카드를 열어보면 최근 조회 목록이 쌓입니다.",
  "people.noResults": "검색 결과가 없습니다.",
  "people.favoriteAdd": "즐겨찾기 추가",
  "people.favoriteRemove": "즐겨찾기 해제",
  "people.action.favorite": "즐겨찾기",
  "people.action.mail": "메일 작성",
  "people.action.teams": "Teams 채팅 열기",
  "people.action.meeting": "캘린더 약속 생성",
  "people.copyMail": "이메일 복사",
  "people.copyMailDone": "이메일 복사됨",
  "people.copyPhone": "전화번호 복사",
  "people.copyPhoneDone": "전화번호 복사됨",
  "people.field.mail": "이메일",
  "people.field.phone": "전화번호",
  "people.field.office": "오피스 위치",
  "people.field.tenant": "소속 테넌트",
  "people.unknown.jobTitle": "(직책 없음)",
  "people.unknown.department": "(부서 없음)",
  "people.unknown.office": "(위치 없음)",
  "people.unknown.phone": "(연락처 없음)",
  "common.unknownAccount": "Unknown account",
  "common.untitled": "(제목 없음)",
  "common.locationUnknown": "미지정"
};

const jaJP: Dict = {
  "brand.subtitle": "統合 M365 ワークスペース",
  "nav.calendar": "カレンダー",
  "nav.people": "組織",
  "nav.settings": "設定",
  "nav.login": "ログイン",
  "nav.logout": "ログアウト",
  "weekday.mon": "月",
  "weekday.tue": "火",
  "weekday.wed": "水",
  "weekday.thu": "木",
  "weekday.fri": "金",
  "weekday.sat": "土",
  "weekday.sun": "日",
  "common.close": "閉じる",
  "common.prev": "前へ",
  "common.today": "今日",
  "common.next": "次へ",
  "common.day": "日",
  "common.week": "週",
  "common.month": "月",
  "common.more": "+{count} 件",
  "common.total": "合計 {count}",
  "calendar.title": "統合カレンダー",
  "calendar.subtitle": "接続済みカレンダーを週/月ビューで一括管理します。",
  "calendar.connectedTenants": "接続テナント {count}",
  "calendar.visibleEvents": "表示予定 {count}",
  "calendar.searchPlaceholder": "予定を検索 (件名/場所/テナント/参加者)",
  "calendar.rangeTitle": "今日を中心に前後の予定",
  "calendar.rangeCurrent": "現在の範囲: ±{days}日",
  "calendar.range3": "±3日",
  "calendar.range7": "±7日",
  "calendar.past": "過去の予定",
  "calendar.upcoming": "今後の予定",
  "calendar.none": "予定はありません。",
  "calendar.attendeesCount": "参加者 {count}名",
  "alerts.title": "予定の競合アラート",
  "alerts.subtitle": "異なるテナント間で時間が重なる予定を検出します。",
  "alerts.count": "競合 {count}件",
  "alerts.none": "現在の範囲では競合が見つかりません。",
  "alerts.enableNotifications": "通知を有効化",
  "alerts.disableNotifications": "通知を無効化",
  "alerts.permissionDenied": "このブラウザーで通知がブロックされています。",
  "alerts.dismiss": "非表示",
  "alerts.dismissed": "非表示にしました",
  "alerts.simulate": "新しい競合を作成(テスト)",
  "alerts.rescan": "再スキャン",
  "alerts.banner": "新しい予定の競合を検出しました: {count}件",
  "alerts.test": "テスト通知を送信",
  "alerts.permission": "権限: {value}",
  "alerts.lastSent": "最終送信: {value}",
  "alerts.notificationTitle": "予定の競合 ({count}件)",
  "alerts.notificationBody": "テナント間で時間が重なる予定を検出しました: {a} vs {b} ({start}-{end}). タップして確認してください。",
  "push.title": "バックグラウンド Push",
  "push.subtitle": "アプリを閉じても通知を受け取ります(Web Push の購読が必要)。",
  "push.notSupported": "このデバイス/ブラウザーでは Web Push をサポートしていません。",
  "push.configMissing": "Push が未設定です。サーバーで VAPID キーを設定してください。",
  "push.permissionBlocked": "通知の許可が付与されていません。",
  "push.permission": "権限: {value}",
  "push.lastTest": "最終テスト: {value}",
  "push.endpointHint": "Endpoint: {value}",
  "push.status.subscribed": "購読済み",
  "push.status.notSubscribed": "未購読",
  "push.subscribe": "Push を有効化",
  "push.unsubscribe": "Push を無効化",
  "push.test": "テスト Push",
  "push.loginRequired": "バックグラウンド Push はログイン後に利用できます。",
  "push.subscribed": "Push 購読を保存しました。",
  "push.unsubscribed": "Push 購読を解除しました。",
  "push.subscribeFailed": "Push 購読に失敗しました。",
  "push.unsubscribeFailed": "Push 購読解除に失敗しました。",
  "push.testSent": "テスト Push を要求しました。通知を確認してください。",
  "push.testFailed": "テスト Push の送信に失敗しました。",
  "event.detailTitle": "予定の詳細",
  "event.sourceTenant": "元テナント",
  "event.sourceAccount": "元アカウント",
  "event.location": "場所",
  "event.attendees": "参加者",
  "event.attendeesEmpty": "参加者情報がありません。",
  "settings.title": "設定",
  "settings.subtitle": "接続状態とセッションを管理します。",
  "settings.addMicrosoft": "Microsoft アカウント追加",
  "settings.addGoogle": "Google カレンダー追加",
  "settings.connectionsTitle": "接続アカウント",
  "settings.connectionsLoginRequired": "ログイン後に接続情報を確認できます。",
  "settings.connectionsEmpty": "接続済みアカウントがありません。",
  "settings.providerMicrosoft": "Microsoft",
  "settings.providerGoogle": "Google",
  "settings.expires": "期限",
  "settings.sessionTitle": "セッション",
  "settings.sessionSubtitle": "このデバイスから安全にログアウトします。",
  "settings.signOut": "ログアウト",
  "settings.languageTitle": "言語",
  "settings.languageSubtitle": "UI の言語を選択します。設定はアカウントに保存されます。",
  "settings.language.ko": "韓国語",
  "settings.language.en": "英語",
  "settings.language.ja": "日本語",
  "pwa.title": "アプリをインストール",
  "pwa.subtitle": "Converge をインストールして、より速く起動しアプリのように使えます。",
  "pwa.cta": "インストール",
  "pwa.installed": "このデバイスには既にインストールされています。",
  "pwa.unavailable": "このブラウザーではインストールできません。",
  "pwa.iosHint": "iOS Safari: 共有 → “ホーム画面に追加”を選択してください。",
  "status.oauth_connected": "Microsoft アカウントを接続しました。",
  "status.oauth_error": "Microsoft 認証中にエラーが発生しました。",
  "status.google_oauth_connected": "Google アカウントを接続しました。",
  "status.google_oauth_error": "Google 認証中にエラーが発生しました。",
  "status.google_invalid_state": "Google OAuth state の検証に失敗しました。",
  "status.google_missing_code": "Google の認可コードがありません。",
  "status.google_token_exchange_failed": "Google トークン交換に失敗しました。",
  "status.google_token_payload_invalid": "Google トークン応答が不正です。",
  "status.google_profile_failed": "Google プロフィール取得に失敗しました。",
  "status.google_profile_incomplete": "Google プロフィール情報が不完全です。",
  "status.google_refresh_token_missing": "Google refresh token がありません。再接続してください。",
  "status.google_oauth_connected_partial_sync": "Google 接続は完了しましたが、一部のカレンダー同期に失敗しました。",
  "status.google_oauth_connected_sync_failed": "Google 接続は完了しましたが、初回カレンダー同期に失敗しました。",
  "status.google_config_missing": "Google OAuth 設定が不足しています。",
  "status.invalid_state": "OAuth state の検証に失敗しました。",
  "status.missing_code": "認可コードがありません。",
  "status.auth_required": "先にログインしてください。",
  "status.token_exchange_failed": "トークン交換に失敗しました。",
  "status.token_payload_invalid": "トークン応答が不正です。",
  "status.graph_me_failed": "Microsoft プロフィール取得に失敗しました。",
  "status.profile_incomplete": "プロフィール情報が不完全です。",
  "status.db_primary_check_failed": "既存接続の確認に失敗しました。",
  "status.db_connection_read_failed": "接続アカウントの取得に失敗しました。",
  "status.db_app_user_failed": "ユーザー保存に失敗しました。",
  "status.db_connection_upsert_failed": "接続の保存に失敗しました。",
  "login.title": "メインアカウントで開始",
  "login.subtitle": "ログインすると、統合カレンダーと複数テナントの社員検索をすぐ使えます。",
  "login.feature.calendar": "統合カレンダー",
  "login.feature.people": "社員検索",
  "login.feature.multitenant": "複数テナント",
  "login.emailLabel": "メール",
  "login.magicLinkCta": "マジックリンクでログイン",
  "login.microsoftCta": "Microsoft で続行",
  "login.onboardingCta": "オンボーディングを見る",
  "login.status.magic_link_sent": "マジックリンクを送信しました。メール内のリンクを開いてください。",
  "login.status.invalid_email": "有効なメールアドレスを入力してください。",
  "login.status.magic_link_error": "マジックリンク送信に失敗しました。Supabase Auth 設定を確認してください。",
  "login.status.auth_callback_error": "ログインコールバックの処理に失敗しました。",
  "login.status.signed_out": "安全にログアウトしました。",
  "onboarding.start": "はじめる",
  "onboarding.heroTitle": "複数テナント Microsoft 365 運用を 1 つのワークスペースへ",
  "onboarding.heroDesc":
    "Converge は複数テナントに分散したカレンダーとディレクトリ(社員)情報を単一画面で統合します。検索と標準アクション(メール/Teams/会議作成)をワークフローでつなぎ、切り替えコストを削減し、テナント間の予定競合を先回りで検出します。",
  "onboarding.coreLabel": "主要機能 {index}",
  "onboarding.core1Title": "統合カレンダー",
  "onboarding.core1Desc": "テナント横断で予定を集約し、週/月ビューで検索とテナント別制御が可能です。",
  "onboarding.core2Title": "ディレクトリ検索",
  "onboarding.core2Desc": "名前/部署/テナントで探索し、メール/Teams/会議作成へ直結します。",
  "onboarding.core3Title": "競合検出",
  "onboarding.core3Desc": "テナント間で時間が重なる予定を検出し、アプリ内通知と任意の通知で確認できます。",
  "onboarding.core4Title": "接続管理",
  "onboarding.core4Desc": "Microsoft アカウントを追加接続し、接続状態を設定で一元管理します。",
  "onboarding.howTitle": "導入フロー",
  "onboarding.step1Title": "認証",
  "onboarding.step1Desc": "メインアカウントで開始します(Supabase 認証または Microsoft)。",
  "onboarding.step2Title": "追加テナント接続",
  "onboarding.step2Desc": "設定で別テナントのアカウントを追加接続します。",
  "onboarding.step3Title": "検索と実行",
  "onboarding.step3Desc": "統合カレンダー/ディレクトリ検索から、クイックアクションで即実行します。",
  "onboarding.screensTitle": "実際の画面",
  "onboarding.screensDesc": "現在デプロイされている Converge の画面キャプチャです。",
  "onboarding.screen.calendarTitle": "統合カレンダー",
  "onboarding.screen.calendarDesc": "テナント横断の集約、検索、週/月ナビゲーション、詳細確認を 1 画面で。",
  "onboarding.screen.peopleTitle": "ディレクトリ検索",
  "onboarding.screen.peopleDesc": "プロフィール起点のクイックアクションでメール/Teams/会議作成へ。",
  "onboarding.screen.settingsTitle": "設定",
  "onboarding.screen.settingsDesc": "接続、言語、インストール、通知などの運用設定を管理します。",
  "onboarding.viewCalendar": "カレンダーを開く",
  "people.title": "組織",
  "people.subtitle": "社員検索とプロフィール起点のクイックアクションを提供します。",
  "people.searchCount": "対象 {count}名",
  "people.searchPlaceholder": "名前、メール、部署、テナントで検索",
  "people.sort.default": "既定",
  "people.sort.tenant": "テナント別",
  "people.favoritesTitle": "お気に入り",
  "people.favoritesHint": "プロフィールの星ボタンでお気に入りに追加できます。",
  "people.recentsTitle": "最近見た人",
  "people.recentsHint": "プロフィールを開くと最近一覧に追加されます。",
  "people.noResults": "結果がありません。",
  "people.favoriteAdd": "お気に入りに追加",
  "people.favoriteRemove": "お気に入り解除",
  "people.action.favorite": "お気に入り",
  "people.action.mail": "メール作成",
  "people.action.teams": "Teams チャット",
  "people.action.meeting": "会議を作成",
  "people.copyMail": "メールをコピー",
  "people.copyMailDone": "メールをコピーしました",
  "people.copyPhone": "電話番号をコピー",
  "people.copyPhoneDone": "電話番号をコピーしました",
  "people.field.mail": "メール",
  "people.field.phone": "電話番号",
  "people.field.office": "オフィス",
  "people.field.tenant": "テナント",
  "people.unknown.jobTitle": "(役職なし)",
  "people.unknown.department": "(部署なし)",
  "people.unknown.office": "(場所なし)",
  "people.unknown.phone": "(連絡先なし)",
  "common.unknownAccount": "Unknown account",
  "common.untitled": "(無題)",
  "common.locationUnknown": "未指定"
};

const DICTS: Record<Locale, Dict> = {
  "ko-KR": koKR,
  "en-US": enUS,
  "ja-JP": jaJP
};

export function t(locale: Locale, key: I18nKey, vars?: Record<string, string | number>): string {
  const template = DICTS[locale]?.[key] ?? DICTS[DEFAULT_LOCALE][key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, varName: string) => {
    const val = vars[varName];
    return val === undefined || val === null ? match : String(val);
  });
}
