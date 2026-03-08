import type { Locale } from "@/lib/i18n";

export type UpdateEntry = {
  date: string;
  title: string;
  highlights: string[];
};

const FEED_KO: UpdateEntry[] = [
  {
    date: "2026-02-28",
    title: "초기 로딩 성능 최적화 1차",
    highlights: [
      "요청 단위 캐시(`request-context`)를 도입해 동일 요청 내 중복 인증/클라이언트 생성을 줄였습니다.",
      "앱 공통 레이아웃에서 진입 시 실행되던 재인증 조회를 비동기 상태 체크로 분리해 초기 블로킹을 제거했습니다.",
      "온보딩/업데이트 페이지를 로케일 경로 기반 SSG로 전환하고 1시간 단위 재검증(revalidate) 캐시를 적용했습니다.",
      "캘린더·일정충돌·직원검색·설정의 DB 조회 코드를 데이터 계층으로 분리해 중복 로직을 정리했습니다.",
      "캘린더 진입 시 자동 증분 동기화 호출을 idle 시점으로 지연해 첫 화면 반응성을 개선했습니다."
    ]
  },
  {
    date: "2026-02-28",
    title: "관측성 및 운영 검증 보강",
    highlights: [
      "Sentry 클라이언트/서버 연동을 정비하고 소스맵 업로드 기반 디버깅 흐름을 확정했습니다.",
      "백엔드 수집 검증용 테스트 엔드포인트를 추가하고, 환경변수 플래그(`SENTRY_ENABLE_TEST_ENDPOINT=true`)일 때만 열리도록 기본 차단했습니다.",
      "상용 배포 경로에서 Sentry 환경변수 반영과 실이벤트 유입 검증 절차를 문서화했습니다."
    ]
  },
  {
    date: "2026-02-21",
    title: "보안 하드닝 및 안내 UX 개선",
    highlights: [
      "OAuth 콜백의 open redirect 가능성을 차단하고 전역 보안 헤더(CSP 등)를 강화했습니다.",
      "OAuth 토큰을 별도 보안 테이블로 분리하고 기존 연결은 재연결이 필요하도록 보안 로테이션을 적용했습니다.",
      "재인증이 필요한 계정은 앱 진입 시 팝업과 설정 배너에서 즉시 안내합니다.",
      "모바일에서 일정 상세/직원 상세가 상단 네비게이션 아래로 가려지던 레이어 문제를 수정했습니다.",
      "설정 화면에 업데이트 내역 바로가기 링크를 추가했습니다."
    ]
  },
  {
    date: "2026-02-21",
    title: "업데이트 페이지 표시 확장",
    highlights: [
      "일자 카드 수 제한을 제거해 누적 히스토리를 모두 확인할 수 있습니다.",
      "동일 일자의 업데이트를 한 카드로 묶어 날짜 중심으로 읽기 쉽게 정리했습니다.",
      "일자별 항목 표시 수를 최대 15개까지 지원하도록 확장했습니다.",
      "반복되는 문장은 중복 제거 후 표시해 가독성을 높였습니다.",
      "최근 변경 내용이 상단에 유지되도록 정렬 기준을 고정했습니다."
    ]
  },
  {
    date: "2026-02-21",
    title: "시간 표시 타임존 정합성 개선",
    highlights: [
      "설정 페이지의 세션 로그인 시각/연결 만료 시각을 브라우저 타임존 기준으로 표시하도록 변경했습니다.",
      "서버 크론 기반 일정 충돌 푸시 메시지는 사용자 계정의 timezone 값을 우선 적용합니다.",
      "서버 렌더링 타임존과 사용자 체감 시간의 불일치를 줄였습니다.",
      "세션 영역에서 시간 표기에 `time` 태그를 적용해 접근성과 머신 판독성을 함께 개선했습니다.",
      "서버/클라이언트 hydration 시 시간 문자열이 흔들리는 문제를 완화했습니다."
    ]
  },
  {
    date: "2026-02-21",
    title: "세션 로그인 이력 표시 추가",
    highlights: [
      "계정 단위로 이번 로그인 시각과 이전 로그인 시각을 함께 저장하도록 확장했습니다.",
      "설정 > 세션 영역에서 디바이스와 무관한 로그인 이력을 확인할 수 있습니다.",
      "첫 로그인 등 이전 기록이 없을 때는 안내 문구로 명확히 표시합니다.",
      "로그인 성공 후 이력 저장 실패가 발생해도 로그인 자체는 차단하지 않도록 비차단 처리했습니다.",
      "기존 사용자 데이터는 `auth.users.last_sign_in_at` 기준으로 초기 백필할 수 있게 마이그레이션을 추가했습니다."
    ]
  },
  {
    date: "2026-02-21",
    title: "캘린더 보기 형식 확장",
    highlights: [
      "일간·작업주·주간·월간 보기 전환을 추가했습니다.",
      "설정에서 주 시작 요일(일요일/월요일)을 선택할 수 있습니다.",
      "주간·월간 뷰에서 오늘 날짜를 더 강하게 강조했습니다.",
      "일간 뷰에서 첫 일정 시간대로 자동 스크롤해 탐색 시작점을 빠르게 맞췄습니다.",
      "겹침 일정 블록 폭/간격 규칙을 조정해 가독성을 개선했습니다."
    ]
  },
  {
    date: "2026-02-20",
    title: "캘린더 선택/표시 필터 개선",
    highlights: [
      "캘린더 선택 UI를 팝업 체크박스 구조로 정리했습니다.",
      "미정·다른 용무중·응답 대기·거절·취소 일정 포함 여부를 직접 제어할 수 있습니다.",
      "계정별 표시 토글과 색상 칩을 연동해 가시성을 높였습니다.",
      "메인 화면에는 핵심 버튼만 남기고 상세 선택은 팝업으로 이동해 정보 밀도를 낮췄습니다.",
      "검색/필터 조합 시 선택 상태가 유지되도록 UX 흐름을 보강했습니다."
    ]
  },
  {
    date: "2026-02-19",
    title: "동기화 성능 및 최신성 개선",
    highlights: [
      "증분 동기화 기반으로 전체 재동기화 부담을 줄였습니다.",
      "로그인 시점과 캘린더 진입 시점에 최근 동기화 경과 시간을 기준으로 자동 갱신합니다.",
      "수동 동기화에 진행 상태 표시를 추가해 완료 여부를 바로 확인할 수 있습니다.",
      "일정/조직도 동기화 우선순위를 분리해 체감 응답 속도를 개선했습니다.",
      "대용량 계정에서 병목이 되는 조회 경로를 인덱스 기반으로 튜닝했습니다."
    ]
  },
  {
    date: "2026-02-18",
    title: "일정 충돌 전용 탭과 알림 강화",
    highlights: [
      "일정 충돌을 전용 탭으로 분리해 로딩 경로를 단순화했습니다.",
      "제목·시간이 완전히 같은 일정은 충돌에서 제외하도록 중복 감지를 보정했습니다.",
      "인앱 알림과 PWA 알림에서 충돌 메시지와 아이콘을 함께 제공합니다.",
      "과거 일정 충돌은 기본 목록에서 제외해 현재 리스크 중심으로 정리했습니다.",
      "충돌 카드에서도 일정 상세 팝업으로 바로 진입할 수 있도록 연결했습니다."
    ]
  },
  {
    date: "2026-02-17",
    title: "조직도/직원 검색 보강",
    highlights: [
      "즐겨찾기 직원과 최근 조회 직원을 분리해 관리할 수 있습니다.",
      "계정 정렬/접기와 Guest 포함 여부 필터를 추가했습니다.",
      "직원 상세 팝업에서 메일/전화 복사, 메일 작성, Teams 채팅, 미팅 생성을 지원합니다.",
      "직원 사진 조회와 상세 로딩 상태 처리 로직을 개선했습니다.",
      "전화번호 기반 검색 정확도를 높이고 무한 스크롤 체감 속도를 보강했습니다."
    ]
  },
  {
    date: "2026-02-16",
    title: "Google 캘린더 연동 추가",
    highlights: [
      "Microsoft 외에 Google 계정도 연결 가능한 Provider 확장을 적용했습니다.",
      "설정 화면에서 Provider별 연결 상태를 동일한 방식으로 관리할 수 있습니다.",
      "통합 캘린더에서 다중 Provider 이벤트를 함께 조회할 수 있도록 기반을 추가했습니다.",
      "OAuth 상태 검증/리다이렉트 처리 흐름을 정비해 연결 안정성을 높였습니다.",
      "Provider별 초기 동기화 실패 시 상태 코드를 분리해 원인 파악을 쉽게 했습니다."
    ]
  },
  {
    date: "2026-02-15",
    title: "앱 경험 현대화",
    highlights: [
      "모바일 레이아웃, 팝업 동작, 간격/타이포를 전반적으로 통일했습니다.",
      "한국어/영어/일본어 UI 언어 전환을 지원합니다.",
      "다크 모드, 계정 색상 커스터마이징, 설치형 PWA를 적용했습니다.",
      "온보딩 화면을 실제 기능 스크린샷 중심으로 재구성했습니다.",
      "탭/버튼 스타일 일관성을 맞춰 전반적인 인터랙션 품질을 개선했습니다."
    ]
  },
  {
    date: "2026-02-14",
    title: "핵심 기능 1차 공개",
    highlights: [
      "멀티 계정 통합 캘린더를 첫 릴리즈했습니다.",
      "직원/조직도 검색과 상세 팝업을 제공합니다.",
      "설정에서 추가 계정 연결과 기본 동기화 관리 기능을 시작했습니다.",
      "Supabase 기반 스키마/권한 구조와 기본 RLS 정책을 정립했습니다.",
      "초기 Mock 데이터 기반으로 핵심 흐름 테스트가 가능하도록 준비했습니다."
    ]
  }
];

const FEED_EN: UpdateEntry[] = [
  {
    date: "2026-02-28",
    title: "Initial load performance optimization (phase 1)",
    highlights: [
      "Added request-scoped caching (`request-context`) to reduce duplicate auth/client initialization within the same request.",
      "Removed blocking re-auth queries from app layout by moving checks to an async status gate.",
      "Migrated onboarding/updates to locale-segmented SSG pages with 1-hour revalidation.",
      "Extracted calendar/alerts/people/settings DB reads into a dedicated data-fetch layer to reduce duplication.",
      "Delayed calendar entry incremental-sync trigger to idle time for faster first interaction."
    ]
  },
  {
    date: "2026-02-28",
    title: "Observability and production verification improvements",
    highlights: [
      "Stabilized Sentry client/server integration and source-map based debugging flow.",
      "Added a backend Sentry smoke-test endpoint and gated it behind `SENTRY_ENABLE_TEST_ENDPOINT=true` (disabled by default).",
      "Documented and validated production env wiring plus live event-ingestion checks."
    ]
  },
  {
    date: "2026-02-21",
    title: "Security hardening and guidance UX",
    highlights: [
      "Blocked open-redirect patterns in OAuth callback flow and strengthened global security headers (including CSP).",
      "Moved OAuth tokens to a dedicated secure table and applied token rotation that requires reconnecting existing accounts.",
      "Accounts that require re-authentication are now surfaced with an app-entry popup and a Settings banner.",
      "Fixed mobile layering where event/people detail modals could appear under the top navigation.",
      "Added a direct link to the Updates page in Settings."
    ]
  },
  {
    date: "2026-02-21",
    title: "Updates page display expansion",
    highlights: [
      "Removed date-card count limits so full history is visible.",
      "Grouped same-day updates into one date-focused card.",
      "Expanded per-day item rendering to support up to 15 entries.",
      "Deduplicated repeated lines to keep cards readable.",
      "Kept newest changes pinned at the top by stable ordering."
    ]
  },
  {
    date: "2026-02-21",
    title: "Timezone consistency improvements",
    highlights: [
      "Session login times and connection expiry times in Settings now render in browser timezone.",
      "Cron-based conflict push messages now prefer each user's timezone from app profile.",
      "Reduced mismatch between server-rendered timezone and user-visible time."
    ]
  },
  {
    date: "2026-02-21",
    title: "Session login history added",
    highlights: [
      "Extended account-level tracking to keep both current and previous login timestamps.",
      "Settings > Session now shows login history independent of device.",
      "When there is no prior login, the UI now shows a clear fallback message."
    ]
  },
  {
    date: "2026-02-21",
    title: "Calendar view expansion",
    highlights: [
      "Added Day, Work Week, Week, and Month view modes.",
      "Week start day can now be configured (Sunday or Monday).",
      "Today is visually emphasized more clearly in week/month layouts."
    ]
  },
  {
    date: "2026-02-20",
    title: "Calendar scope and visibility improvements",
    highlights: [
      "Calendar source selection was rebuilt as a popup checkbox flow.",
      "You can now control tentative, working elsewhere, awaiting response, declined, and cancelled visibility.",
      "Account visibility toggles now align with account color chips."
    ]
  },
  {
    date: "2026-02-19",
    title: "Sync performance and freshness upgrades",
    highlights: [
      "Incremental sync reduces full-refresh overhead.",
      "Automatic refresh now runs on login and on calendar entry if the last sync is stale.",
      "Manual sync now shows progress so completion is easier to verify."
    ]
  },
  {
    date: "2026-02-18",
    title: "Dedicated conflict tab and stronger alerts",
    highlights: [
      "Schedule conflicts were moved into a dedicated tab to simplify load paths.",
      "Duplicate conflicts are filtered when title and time are identical.",
      "In-app and PWA notifications now include clearer conflict messaging with icons."
    ]
  },
  {
    date: "2026-02-17",
    title: "People directory enhancements",
    highlights: [
      "Added favorite people and recently viewed sections.",
      "Added account grouping/collapse and a guest include filter.",
      "Profile popup now supports copy email/phone, compose email, Teams chat, and create meeting."
    ]
  },
  {
    date: "2026-02-16",
    title: "Google Calendar provider support",
    highlights: [
      "Added Google account connection in addition to Microsoft.",
      "Provider-specific connections are now managed in a unified settings flow.",
      "Unified calendar foundation now supports multi-provider events."
    ]
  },
  {
    date: "2026-02-15",
    title: "Modernized app experience",
    highlights: [
      "Refined mobile layout, popup behavior, and typography/spacing consistency.",
      "Added full UI localization for Korean, English, and Japanese.",
      "Shipped dark mode, account color customization, and installable PWA."
    ]
  },
  {
    date: "2026-02-14",
    title: "Initial core release",
    highlights: [
      "Released the first multi-account unified calendar.",
      "Added people search with profile detail popup.",
      "Started account connection management and basic sync controls in settings."
    ]
  }
];

const FEED_JA: UpdateEntry[] = [
  {
    date: "2026-02-28",
    title: "初期ロード性能の最適化（第1段階）",
    highlights: [
      "リクエスト単位キャッシュ（`request-context`）を導入し、同一リクエスト内の認証/クライアント初期化重複を削減しました。",
      "アプリ共通レイアウトの再認証判定を非同期ステータスチェックへ分離し、初期ブロッキングを削減しました。",
      "オンボーディング/更新ページをロケール別 SSG に移行し、1時間単位の再検証キャッシュを適用しました。",
      "カレンダー/競合/組織検索/設定の DB 取得をデータ層へ分離し、重複ロジックを整理しました。",
      "カレンダー初回表示時の増分同期トリガーを idle 時点に遅延し、初期操作の体感を改善しました。"
    ]
  },
  {
    date: "2026-02-28",
    title: "観測性と本番検証フローを強化",
    highlights: [
      "Sentry のクライアント/サーバー連携とソースマップ前提のデバッグフローを整備しました。",
      "バックエンド収集確認用の Sentry テスト API を追加し、`SENTRY_ENABLE_TEST_ENDPOINT=true` のときのみ有効化（既定は無効）しました。",
      "本番環境変数の接続状態と実イベント流入の確認手順を明確化しました。"
    ]
  },
  {
    date: "2026-02-21",
    title: "セキュリティ強化と案内 UX を改善",
    highlights: [
      "OAuth コールバックのオープンリダイレクト可能性を遮断し、グローバルセキュリティヘッダー(CSP など)を強化しました。",
      "OAuth トークンを専用のセキュアテーブルへ分離し、既存接続は再接続が必要なトークンローテーションを適用しました。",
      "再認証が必要なアカウントは、アプリ起動時のポップアップと設定バナーで案内します。",
      "モバイルで予定詳細/社員詳細モーダルが上部ナビゲーションの下に隠れるレイヤー問題を修正しました。",
      "設定画面にアップデートページへのショートカットリンクを追加しました。"
    ]
  },
  {
    date: "2026-02-21",
    title: "アップデートページ表示を拡張",
    highlights: [
      "日付カード数の制限を外し、履歴全体を表示できるようにしました。",
      "同日の更新を1枚のカードにまとめ、日付単位で読みやすくしました。",
      "日付ごとの表示項目数を最大15件まで対応しました。",
      "重複する文は除外して可読性を改善しました。",
      "新しい更新が常に上位に来るよう並び順を固定しました。"
    ]
  },
  {
    date: "2026-02-21",
    title: "時間表示のタイムゾーン整合性を改善",
    highlights: [
      "設定画面のログイン時刻/接続期限時刻をブラウザーのタイムゾーン基準で表示するよう変更しました。",
      "Cron ベースの予定競合 Push は、ユーザーの timezone 設定を優先して時刻を生成します。",
      "サーバー側タイムゾーンと表示時刻のズレを軽減しました。"
    ]
  },
  {
    date: "2026-02-21",
    title: "セッションのログイン履歴表示を追加",
    highlights: [
      "アカウント単位で今回ログイン時刻と前回ログイン時刻を保存するよう拡張しました。",
      "設定 > セッションで、デバイスに依存しないログイン履歴を確認できます。",
      "初回ログインなど履歴がない場合は、案内メッセージを表示します。"
    ]
  },
  {
    date: "2026-02-21",
    title: "カレンダー表示形式を拡張",
    highlights: [
      "日/平日週/週/月ビューを追加しました。",
      "週の開始曜日を日曜・月曜から選択できます。",
      "週/月ビューで「今日」をより見やすく強調しました。"
    ]
  },
  {
    date: "2026-02-20",
    title: "カレンダー選択・表示フィルターを改善",
    highlights: [
      "カレンダー選択 UI をポップアップのチェックボックス方式に整理しました。",
      "仮予定・他の場所で勤務・未回答・辞退・キャンセルの表示可否を切り替えできます。",
      "アカウント表示トグルとカラー表示を連携して見やすさを向上しました。"
    ]
  },
  {
    date: "2026-02-19",
    title: "同期性能と最新性を改善",
    highlights: [
      "増分同期により全件再同期の負荷を軽減しました。",
      "ログイン時とカレンダー表示時に、最終同期時刻を基準に自動更新します。",
      "手動同期に進捗表示を追加し、完了状態を確認しやすくしました。"
    ]
  },
  {
    date: "2026-02-18",
    title: "予定競合タブと通知を強化",
    highlights: [
      "予定競合を専用タブへ分離して読み込みを軽量化しました。",
      "件名と時間が同一の予定は競合から除外するよう重複判定を改善しました。",
      "アプリ内通知と PWA 通知で、競合説明とアイコンを表示します。"
    ]
  },
  {
    date: "2026-02-17",
    title: "組織検索を強化",
    highlights: [
      "お気に入り社員と最近閲覧した社員を追加しました。",
      "アカウント別表示/折りたたみとゲスト含有フィルターを追加しました。",
      "社員詳細ポップアップでメール/電話コピー、メール作成、Teams チャット、会議作成を実行できます。"
    ]
  },
  {
    date: "2026-02-16",
    title: "Google カレンダープロバイダー対応",
    highlights: [
      "Microsoft に加えて Google アカウント接続を追加しました。",
      "設定画面でプロバイダー別の接続を同じフローで管理できます。",
      "統合カレンダーで複数プロバイダーの予定を扱う基盤を追加しました。"
    ]
  },
  {
    date: "2026-02-15",
    title: "アプリ体験をモダン化",
    highlights: [
      "モバイル表示、ポップアップ挙動、タイポグラフィと余白を全体的に統一しました。",
      "韓国語・英語・日本語の UI 切替に対応しました。",
      "ダークモード、アカウント色カスタム、インストール可能な PWA を適用しました。"
    ]
  },
  {
    date: "2026-02-14",
    title: "コア機能を初回公開",
    highlights: [
      "複数アカウント統合カレンダーを初回リリースしました。",
      "社員検索と詳細ポップアップを追加しました。",
      "設定で追加アカウント接続と基本同期管理を開始しました。"
    ]
  }
];

const FEED_BY_LOCALE: Record<Locale, UpdateEntry[]> = {
  "ko-KR": FEED_KO,
  "en-US": FEED_EN,
  "ja-JP": FEED_JA
};

export function getUpdatesFeed(locale: Locale): UpdateEntry[] {
  return FEED_BY_LOCALE[locale] ?? FEED_KO;
}
