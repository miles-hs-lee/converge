# Converge Architecture Overview (C4)

기준 코드 시점: 2026-02-18  
대상 시스템: `/Users/cnt-22-70004/Documents/Converge`

## 1) Level 1 - System Context

```mermaid
flowchart LR
  U["End User (Team Member)"]
  B["Browser / PWA App"]
  C["Converge (Next.js BFF)"]
  S["Supabase (Auth + Postgres + RLS)"]
  MI["Microsoft Identity Platform"]
  MG["Microsoft Graph API"]
  GO["Google OAuth"]
  GC["Google Calendar API"]
  WP["Web Push Infra (Browser Vendor)"]
  SC["External Scheduler / Cron"]

  U --> B
  B --> C
  C <--> S
  C --> MI
  C --> MG
  C --> GO
  C --> GC
  C --> WP
  SC --> C
  WP --> B
```

요약:
- 사용자는 브라우저/PWA를 통해 Converge에 접속합니다.
- Converge는 Supabase를 시스템 오브 레코드로 사용합니다.
- 외부 캘린더/디렉터리는 Microsoft/Google API와 OAuth로 연동됩니다.
- 충돌 알림은 Web Push로 사용자 디바이스에 전달됩니다.

## 2) Level 2 - Container

```mermaid
flowchart TB
  subgraph Client["Client Container"]
    UI["Next.js UI (App Router Pages + Components)"]
    SW["Service Worker (/public/sw.js)"]
  end

  subgraph App["Application Container (Next.js Runtime)"]
    RH["Route Handlers (/app/api/*, /auth/callback)"]
    SA["Server Actions"]
    DOM["Domain Services (calendar-conflicts, i18n, push util)"]
    DATA["Data Access (Supabase SSR/Admin Client)"]
  end

  subgraph DB["Data Container (Supabase Postgres)"]
    T1["app_users / m365_connections"]
    T2["calendar_sources / calendar_events_cache / people_cache"]
    T3["push_subscriptions / alert_dedup"]
  end

  subgraph External["External Systems"]
    E1["Microsoft Identity + Graph"]
    E2["Google OAuth + Calendar API"]
    E3["Web Push Network"]
    E4["Scheduler (cron caller)"]
  end

  UI --> RH
  UI --> SA
  UI <--> SW
  RH --> DOM
  SA --> DOM
  DOM --> DATA
  DATA <--> DB
  RH <--> E1
  RH <--> E2
  RH <--> E3
  E4 --> RH
```

## 3) Level 3 - Component (Next.js App 내부)

```mermaid
flowchart LR
  subgraph Pages["Pages"]
    P1["/login, /onboarding"]
    P2["/calendar"]
    P3["/people"]
    P4["/settings"]
  end

  subgraph API["API Routes"]
    A1["/api/auth/microsoft/start|callback"]
    A2["/api/auth/google/start|callback"]
    A3["/api/push/public-key|subscribe|unsubscribe|test"]
    A4["/api/cron/conflicts"]
    A5["/auth/callback (Supabase Auth)"]
  end

  subgraph Domain["Domain / Utility"]
    D1["lib/calendar-conflicts.ts"]
    D2["lib/web-push.ts + lib/pwa-notifications.ts"]
    D3["lib/i18n.ts + lib/i18n-server.ts"]
    D4["lib/supabase/server|browser|admin.ts"]
    D5["lib/microsoft.ts + lib/google.ts"]
    D6["lib/mock-mode.ts + lib/mock-data.ts"]
  end

  P1 --> A1
  P1 --> A5
  P2 --> D1
  P2 --> D6
  P3 --> D6
  P4 --> A1
  P4 --> A2
  P4 --> A3

  A1 --> D5
  A2 --> D5
  A3 --> D2
  A4 --> D1
  A4 --> D2

  P1 --> D3
  P2 --> D3
  P3 --> D3
  P4 --> D3

  A1 --> D4
  A2 --> D4
  A3 --> D4
  A4 --> D4
```

## 4) 외부 연동과 통신 규격

| 연동 대상 | 용도 | 프로토콜/규격 | 주요 엔드포인트 |
|---|---|---|---|
| Supabase Auth | 매직링크/세션 | HTTPS, Supabase Auth | `/auth/callback` |
| Microsoft Identity | OAuth 인가/토큰 교환 | OAuth 2.0 + OIDC, `application/x-www-form-urlencoded` | `/oauth2/v2.0/authorize`, `/oauth2/v2.0/token` |
| Microsoft Graph | 사용자 기본 정보 조회 | HTTPS JSON REST (Bearer Token) | `https://graph.microsoft.com/v1.0/me` |
| Google OAuth | OAuth 인가/토큰 교환 | OAuth 2.0 + OIDC, `application/x-www-form-urlencoded` | `https://accounts.google.com/o/oauth2/v2/auth`, `https://oauth2.googleapis.com/token` |
| Google Calendar API | 캘린더/이벤트 동기화 | HTTPS JSON REST (Bearer Token) | `calendarList`, `events` |
| Web Push | 브라우저 푸시 전달 | Web Push Protocol + VAPID | `/api/push/*` + 브라우저 푸시 endpoint |
| Cron Caller | 충돌 스캔 트리거 | HTTPS + Bearer Secret | `/api/cron/conflicts` |

## 5) 핵심 시퀀스 다이어그램

### 5.1 Microsoft OAuth 연결

```mermaid
sequenceDiagram
  participant U as User Browser
  participant C as Converge API
  participant MI as Microsoft Identity
  participant MG as Microsoft Graph
  participant DB as Supabase

  U->>C: GET /api/auth/microsoft/start
  C-->>U: Redirect + state cookie
  U->>MI: Authorize
  MI-->>U: Redirect with code,state
  U->>C: GET /api/auth/microsoft/callback
  C->>MI: Exchange code for tokens
  MI-->>C: access_token, refresh_token, id_token
  C->>MG: GET /v1.0/me
  MG-->>C: profile
  C->>DB: upsert app_users, m365_connections
  C-->>U: Redirect /settings?status=oauth_connected
```

### 5.2 충돌 감지 + 푸시 알림

```mermaid
sequenceDiagram
  participant CR as Scheduler
  participant C as Converge API
  participant DB as Supabase
  participant WP as Web Push
  participant U as User Device (SW)

  CR->>C: GET /api/cron/conflicts (Bearer CRON_SECRET)
  C->>DB: load active subscriptions and events
  C->>C: detectTenantConflicts()
  C->>DB: dedup check (alert_dedup)
  C->>WP: send push payload
  WP-->>U: push event
  C->>DB: upsert dedup keys / deactivate invalid endpoints
  C-->>CR: {ok, usersScanned, usersNotified}
```

## 6) 구현 성숙도 메모

- Microsoft: OAuth 연결/토큰 저장은 구현됨. 대규모 백그라운드 동기화 파이프라인은 로드맵 단계.
- Google: OAuth 후 캘린더/이벤트 스냅샷 동기화까지 구현됨.
- People 데이터: 현재 UI는 `people_cache` 조회 기반이며, 지속 동기화 잡은 확장 여지(`sync_jobs`)가 남아있음.
- Mock 모드(`NEXT_PUBLIC_USE_MOCK=true`)로 외부 연동 없이도 주요 UI 검증 가능.

## 7) 근거 코드

- `/Users/cnt-22-70004/Documents/Converge/README.md`
- `/Users/cnt-22-70004/Documents/Converge/app/api/auth/microsoft/start/route.ts`
- `/Users/cnt-22-70004/Documents/Converge/app/api/auth/microsoft/callback/route.ts`
- `/Users/cnt-22-70004/Documents/Converge/app/api/auth/google/start/route.ts`
- `/Users/cnt-22-70004/Documents/Converge/app/api/auth/google/callback/route.ts`
- `/Users/cnt-22-70004/Documents/Converge/app/api/cron/conflicts/route.ts`
- `/Users/cnt-22-70004/Documents/Converge/app/api/push/subscribe/route.ts`
- `/Users/cnt-22-70004/Documents/Converge/public/sw.js`
- `/Users/cnt-22-70004/Documents/Converge/supabase/migrations/0001_init.sql`
- `/Users/cnt-22-70004/Documents/Converge/supabase/migrations/0002_provider_expansion.sql`
- `/Users/cnt-22-70004/Documents/Converge/supabase/migrations/0003_web_push.sql`
