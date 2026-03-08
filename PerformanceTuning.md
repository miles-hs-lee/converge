# Performance Tuning Plan

## 목적

Converge의 성능 개선 우선순위는 다음 두 가지다.

1. 초기 로딩 속도 개선
2. 화면 전환, 검색, 필터링, 상세 열기 같은 상호작용 반응 속도 개선

이번 문서는 현재 코드베이스를 기준으로 병목 가능성이 큰 지점을 정리하고, 실행 순서와 목표 지표를 포함한 작업 계획을 제시한다.

## 이번 분석에서 확인한 현재 상태

### 빌드 기준 초기 JS 크기

`npm run build` 기준:

- 공통 `First Load JS shared by all`: `186 kB`
- `/calendar`: `220 kB`
- `/people`: `212 kB`
- `/settings`: `210 kB`
- `/login`: `189 kB`
- `/[locale]/onboarding`: `195 kB`

해석:

- 인증 전 페이지와 인증 후 페이지 모두 공통 번들이 큰 편이다.
- `/calendar`, `/people`는 실제 핵심 화면인데도 첫 진입 비용이 높다.
- 반응 속도 개선은 개별 화면 최적화 이전에 공통 번들 축소가 먼저 필요하다.

### 정적 자산 크기

`public/` 기준:

- 전체 `public`: 약 `3.5 MB`
- `public/onboarding`: 약 `1.5 MB`
- `public/splash`: 약 `1.7 MB`
- 가장 큰 파일: `public/onboarding/people-desktop.png` 약 `746 KB`

해석:

- 온보딩/설치 관련 시각 자산 비중이 크다.
- 앱 첫 진입이나 공개 페이지 로딩에서 이미지/스플래시 자산 최적화 효과가 크다.

### 클라이언트 번들에서 확인된 내용

빌드 결과물 `.next/static/chunks/8233-b2066fe0dc0edfac.js` 안에 다음이 함께 포함되어 있었다.

- `LocaleProvider`
- analytics client 코드
- `ko-KR`, `en-US`, `ja-JP` 전체 번역 사전

해석:

- 현재 구조에서는 필요한 locale만 서버에서 주입하는 대신, 여러 locale 문자열이 클라이언트로 내려가고 있다.
- 이 구조는 공통 번들 증가에 직접적으로 기여한다.

## 핵심 병목 후보와 우선순위

### P0. 공통 번들 축소

#### 관찰 근거

- `app/layout.tsx`
  - 루트에서 `PwaRegister`, `AppPreferencesProvider`, `AnalyticsIdentity`, `NavDebugLogger`, `LocaleProvider`를 모두 클라이언트 경계 아래에 둔다.
  - 참고: `app/layout.tsx:5-10`, `app/layout.tsx:56-62`
- `components/locale-provider.tsx`
  - `useT()`가 `lib/i18n.ts`의 번역 테이블을 직접 참조한다.
  - 참고: `components/locale-provider.tsx:3-5`, `components/locale-provider.tsx:27-31`
- `app/(app)/layout.tsx`
  - 인증 영역에서 `LocaleProvider`를 다시 감싼다.
  - 참고: `app/(app)/layout.tsx:7`, `app/(app)/layout.tsx:23-36`

#### 왜 느려질 수 있는가

- 모든 페이지가 공통으로 클라이언트 상태, analytics, locale 컨텍스트, 디버그 코드, PWA 등록 코드를 가져간다.
- 루트 레이아웃의 클라이언트 의존성이 커질수록 로그인/온보딩 같은 비교적 단순한 페이지까지 하이드레이션 비용이 커진다.
- 번역 사전이 클라이언트에 포함되면 route별 JS 절감이 어려워진다.

#### 개선 계획

1. `LocaleProvider`를 최소 범위로 축소한다.
2. `useT()` 기반 클라이언트 번역 호출을 줄이고, 서버에서 문자열을 resolve해서 prop으로 전달한다.
3. locale 사전을 route 단위 또는 locale 단위로 분리한다.
4. `NavDebugLogger`는 기본 번들에서 제거하고, 디버그 쿼리 또는 개발 환경에서만 dynamic import 한다.
5. `AnalyticsIdentity`를 루트와 앱 레이아웃에서 중복으로 두지 않도록 정리한다.
6. `PwaRegister`는 로그인 후 앱 영역에서만 등록하거나, 최소한 dynamic import로 분리한다.

#### 목표

- 공통 `First Load JS shared by all`를 `186 kB -> 140 kB 이하`로 축소
- 로그인/온보딩 첫 진입 체감 개선

### P0. 네비게이션 반응 속도 개선

#### 관찰 근거

- `components/nav-tab-button.tsx`
  - `<Link>` 대신 `button + router.push()`를 사용한다.
  - 참고: `components/nav-tab-button.tsx:26-43`
- 현재 코드상 `SafeNavLink` 컴포넌트가 있지만 사용되지 않는다.
  - 참고: `components/safe-nav-link.tsx`

#### 왜 느려질 수 있는가

- Next.js `Link` prefetch 이점을 못 받는다.
- 탭 이동 시 RSC payload와 route chunk를 클릭 후에야 가져오게 될 가능성이 높다.
- warm navigation에서도 체감 지연이 커질 수 있다.

#### 개선 계획

1. 탭 네비게이션을 `<Link prefetch>` 기반으로 바꾼다.
2. analytics는 `onNavigate` 성격의 부가 로직으로 유지하되, prefetch를 막지 않도록 한다.
3. 상단 주요 탭 `/calendar`, `/people`, `/alerts`, `/settings`는 viewport 진입 시 사전 prefetch되게 한다.

#### 목표

- 앱 내부 warm navigation 지연을 `200 ms 이하`로 줄이기
- 상단 탭 클릭 시 즉시 반응하도록 만들기

### P0. 캘린더 화면 클라이언트 부담 축소

#### 관찰 근거

- `/calendar`는 빌드 기준 `220 kB`
- `components/calendar-events-overview.tsx`: `1191` lines
- `components/unified-week-calendar.tsx`: `1021` lines
- `components/calendar-events-overview.tsx`는 검색, 필터, 충돌 계산, 알림, 모달, hover, source selection, localStorage 동기화를 한 컴포넌트 안에서 처리한다.
  - 참고: `components/calendar-events-overview.tsx:240-396`
- `app/(app)/calendar/page.tsx`에서 최대 `500`개 이벤트를 내려준다.
  - 참고: `app/(app)/calendar/page.tsx:79-89`, `app/(app)/calendar/page.tsx:169-176`

#### 왜 느려질 수 있는가

- 단일 클라이언트 컴포넌트가 너무 많은 상태와 계산을 가진다.
- 검색/필터 변경마다 이벤트 배열 재가공이 많이 발생한다.
- 캘린더와 상세/필터/알림 관련 코드가 강하게 결합되어 있다.
- route 진입 시 초기 하이드레이션과 메인 스레드 부하가 커진다.

#### 개선 계획

1. `CalendarEventsOverview`를 기능 단위로 분리한다.
   - 검색/필터 바
   - 이벤트 리스트
   - 충돌 패널
   - 상세 모달
   - source selection 모달
2. 충돌 계산은 서버 선계산 또는 Web Worker 오프로딩을 검토한다.
3. 기본 진입 시 필요한 뷰만 먼저 hydrate하고, 부가 기능은 lazy import 한다.
4. `range overview`, `notification controls`, `visibility modals`는 사용 시점에 불러오도록 분리한다.
5. 가능하면 이벤트 리스트도 virtualization 또는 incremental rendering을 적용한다.

#### 목표

- `/calendar` 첫 로드 JS를 `220 kB -> 170~180 kB` 수준으로 축소
- 필터/검색 입력 후 프레임 드랍 없이 반응하도록 개선

### P0. Alerts 화면의 client-only 렌더링 제거

#### 관찰 근거

- `components/alerts-overview-shell.tsx`는 `dynamic(..., { ssr: false })`를 사용한다.
  - 참고: `components/alerts-overview-shell.tsx:11-20`
- `components/alerts-overview-client.tsx`는 클라이언트에서 충돌 계산을 다시 수행한다.
  - 참고: `components/alerts-overview-client.tsx:60-90`

#### 왜 느려질 수 있는가

- 첫 화면에서 바로 보여줄 수 있는 충돌 정보가 있어도, JS 로드와 hydration이 끝날 때까지 shell만 보여준다.
- `/calendar`와 별개로 `/alerts`에서 다시 충돌 계산을 수행한다.
- 네트워크와 메인 스레드가 모두 준비되어야 실질 콘텐츠가 나타난다.

#### 개선 계획

1. `/alerts` 초기 결과는 서버에서 계산해서 HTML로 먼저 렌더링한다.
2. 검색/숨기기 같은 상호작용만 별도 client island로 분리한다.
3. 충돌 계산 함수 재사용은 유지하되, 최초 계산은 서버에서 수행한다.
4. 상세 열기만 client hydration 이후에 활성화되도록 나눈다.

#### 목표

- Alerts 화면의 FCP/LCP 개선
- "로딩 후 내용 등장" 대신 "내용이 먼저 보이고 상호작용만 나중에 붙는 구조"로 전환

### P1. 캘린더 진입 직후 자동 sync의 간섭 줄이기

#### 관찰 근거

- `/calendar` 진입 시 `CalendarEntrySync`가 활성화된다.
  - 참고: `app/(app)/calendar/page.tsx:154`
- `CalendarEntrySync`는 mount 후 `requestIdleCallback` 또는 `setTimeout`으로 `/api/calendar/entry-sync`를 호출하고 성공 시 `router.refresh()`를 수행한다.
  - 참고: `components/calendar-entry-sync.tsx:27-66`

#### 왜 느려질 수 있는가

- 사용자가 화면을 보기 시작하자마자 네트워크 요청과 refresh가 추가된다.
- "첫 렌더 -> 백그라운드 sync -> 다시 refresh" 흐름은 체감 안정성을 떨어뜨릴 수 있다.
- 초기 네트워크와 CPU 여유가 적은 모바일 환경에서 반응성이 악화될 수 있다.

#### 개선 계획

1. 초기 진입 즉시 sync 대신 서버가 내려주는 stale 플래그를 기준으로 실행 여부를 결정한다.
2. 탭이 background면 sync를 미룬다.
3. 첫 paint 직후가 아니라 일정 시간 이후 또는 사용자가 상호작용을 마친 뒤 실행한다.
4. `router.refresh()`는 실제 변경이 명확할 때만 수행한다.
5. 장기적으로는 SW/background task 또는 scheduler로 옮겨 초기 진입과 분리한다.

#### 목표

- `/calendar` 첫 진입 후 불필요한 재렌더와 네트워크 경쟁 감소

### P1. People 검색 API 정확도와 응답시간 개선

#### 관찰 근거

- `app/api/people/search/route.ts`
  - DB에서 `range(offset, rangeEnd)`로 가져온 뒤
  - `passesQuery()`로 한 번 더 로컬 필터링한다.
  - 참고: `app/api/people/search/route.ts:126-145`, `app/api/people/search/route.ts:228-260`
- `components/people-search-panel.tsx`
  - 검색어 debounce 후 서버 fetch
  - 상세/매니저/사진 조회를 별도 fetch로 수행
  - 참고: `components/people-search-panel.tsx:252-308`, `components/people-search-panel.tsx:392-551`

#### 왜 느려질 수 있는가

- 서버가 먼저 좁힌 결과를 다시 애플리케이션 코드에서 필터링하므로 pagination 정확도가 흔들릴 수 있다.
- 쿼리당 결과 수가 적게 떨어질 수 있고, "더 불러오기" 횟수가 증가한다.
- 상세를 열 때 `detail`, `manager`, `photo`가 순차적으로 추가 조회될 수 있다.

#### 개선 계획

1. 검색 조건을 최대한 DB 쿼리로 밀어 넣는다.
2. `display_name`, `mail`, `department`, `job_title`, `office_location`, `mobile_phone`에 인덱스를 점검한다.
3. 가능하면 Postgres FTS 또는 trigram 인덱스를 도입한다.
4. summary/detail/manager 정보를 분리 fetch하는 대신:
   - 상세에서 자주 쓰는 필드는 summary에 포함
   - manager는 batch lookup
   - 사진은 캐시 정책 강화
5. `React Query`를 이미 dependency로 갖고 있으므로, detail/photo 요청을 캐싱 가능한 query로 옮기는 것을 검토한다.

#### 목표

- 사람 검색 응답시간 단축
- 검색 정확도와 pagination 일관성 확보
- 프로필 열기 시 추가 fetch 횟수 감소

### P1. 캘린더/알림 충돌 계산의 메인 스레드 부담 완화

#### 관찰 근거

- `lib/calendar-conflicts.ts`는 정렬 후 중첩 루프 기반 sweep을 수행한다.
  - 참고: `lib/calendar-conflicts.ts:79-135`
- `calendar-events-overview`, `alerts-overview-client` 모두 클라이언트에서 이 계산을 호출한다.
  - 참고: `components/calendar-events-overview.tsx:364-396`
  - 참고: `components/alerts-overview-client.tsx:60-90`

#### 왜 느려질 수 있는가

- 이벤트 수가 늘어날수록 비교 횟수가 빠르게 증가한다.
- 필터/검색/tenant toggle 때마다 재계산이 반복된다.
- 메인 스레드에서 실행되므로 입력 반응성이 떨어질 수 있다.

#### 개선 계획

1. 최초 계산은 서버에서 수행한다.
2. 클라이언트 재계산이 꼭 필요하면 Web Worker로 옮긴다.
3. 비교 대상 범위를 date bucket/day bucket으로 미리 좁힌다.
4. 이미 정규화된 숫자 timestamp를 서버에서 넘겨 파싱 비용을 줄인다.

#### 목표

- 500개 이벤트 기준 필터/토글 변경 시 long task 제거
- 입력 중 typing latency 개선

### P1. 데이터 조회 round-trip 수 줄이기

#### 관찰 근거

- `lib/data/calendar-data.ts`
  - connections 조회
  - sources 조회
  - events 조회
  - 순차로 진행한다.
  - 참고: `lib/data/calendar-data.ts:33-66`
- `lib/data/people-data.ts`
  - connections 조회 후 count/query를 수행한다.
  - 참고: `lib/data/people-data.ts:20-69`

#### 왜 느려질 수 있는가

- 사용자별 동적 페이지라 캐시가 제한되는 상황에서는 round-trip 수가 곧 응답시간 증가로 이어진다.
- connections/source/event를 별도 조회하면 latency 합산이 발생한다.

#### 개선 계획

1. calendar용 집계 RPC 또는 view를 도입해 한 번의 왕복으로 줄인다.
2. source selection이 자주 바뀌지 않으면 source 메타는 짧은 TTL 캐시를 검토한다.
3. 이벤트 summary 전용 select와 detail select를 더 명확히 분리한다.
4. locale/connection metadata를 여러 페이지가 반복 조회하지 않도록 request-level 캐시 범위를 정리한다.

#### 목표

- 서버 응답시간 단축
- route transition 시 데이터 fetch 병목 감소

### P1. 공개 페이지 이미지와 설치 자산 최적화

#### 관찰 근거

- 온보딩 스크린샷 3장이 모두 큰 PNG다.
  - 참고: `app/[locale]/onboarding/page.tsx:139-180`
- PWA splash 이미지가 여러 개 존재한다.
  - 참고: `app/head.tsx:6-40`
- 실제 파일 크기:
  - `public/onboarding/people-desktop.png`: 약 `746 KB`
  - `public/onboarding/calendar-desktop.png`: 약 `411 KB`
  - `public/onboarding/settings-desktop.png`: 약 `328 KB`
  - `public/splash/*`: 총 약 `1.7 MB`

#### 왜 느려질 수 있는가

- 공개 페이지는 방문자 첫 인상이므로 무거운 이미지가 LCP에 직접 영향을 준다.
- `priority`가 걸린 큰 이미지가 있으면 경쟁 요청이 늘어난다.
- splash 자산은 PWA 사용자에게만 가치가 있는데 전체 앱 자산 관리 복잡도를 높인다.

#### 개선 계획

1. 온보딩 이미지를 AVIF/WebP로 재생성한다.
2. 첫 번째 스크린샷만 우선순위를 주고 나머지는 lazy 로드한다.
3. 큰 단일 스크린샷 대신 적절한 해상도별 `sizes`를 제공한다.
4. splash 이미지는 실제 지원 대상만 남기고 정리한다.
5. 가능하면 정적 이미지 대신 일부는 크롭/썸네일 버전을 사용한다.

#### 목표

- 공개 페이지 LCP 개선
- 정적 자산 용량 절감

### P2. 폰트/소스맵/부가 코드 정리

#### 관찰 근거

- `app/layout.tsx`에서 Google font weight를 많이 로드한다.
  - 참고: `app/layout.tsx:12-22`
- `next.config.ts`에서 `productionBrowserSourceMaps: true`
  - 참고: `next.config.ts:51-59`

#### 왜 느려질 수 있는가

- 폰트 weight가 많으면 초기 폰트 요청 수와 CSS/font 처리량이 늘 수 있다.
- 브라우저 소스맵은 런타임 핵심 병목은 아니지만 배포 산출물과 네트워크 관리 측면에서 비용이 있다.

#### 개선 계획

1. 실제 사용 weight만 남긴다.
2. 소스맵 공개 필요성이 낮다면 production browser source map 전략을 재검토한다.
3. 운영 디버깅에 필요한 경우 Sentry 업로드만 유지하고 브라우저 노출은 줄인다.

#### 목표

- 초기 리소스 요청 수 감소
- 운영 번들 관리 단순화

## 단계별 실행 계획

### Phase 0. 측정 기준 고정

예상 기간: 0.5~1일

작업:

1. 빌드 결과를 기준선으로 기록한다.
2. Lighthouse mobile 기준 점수와 핵심 지표를 캡처한다.
3. `/calendar`, `/people`, `/alerts`, `/login`, `/onboarding`의 네트워크 waterfall을 저장한다.
4. React Profiler 또는 Performance 탭으로 다음 흐름을 측정한다.
   - `/calendar` 첫 진입
   - `/people` 검색 입력
   - 상단 탭 이동
   - event detail / people detail 열기

측정 항목:

- LCP
- INP 또는 interaction latency
- JS transferred
- hydration 시간
- route transition duration
- API 응답시간

### Phase 1. 빠른 효과가 큰 작업

예상 기간: 2~4일

우선 작업:

1. 상단 탭을 `Link + prefetch` 구조로 변경
2. `NavDebugLogger` 기본 번들 제외
3. 루트 레이아웃 클라이언트 경계 축소
4. locale 문자열을 서버 prop 전달 방식으로 일부 전환
5. 공개 이미지 최적화
6. calendar entry sync 실행 시점 완화

기대 효과:

- 공통 번들 즉시 감소
- warm navigation 체감 개선
- 공개 페이지 LCP 개선

### Phase 2. 구조적 개선

예상 기간: 4~7일

우선 작업:

1. `CalendarEventsOverview` 분해
2. `/alerts` SSR 우선 렌더링 전환
3. conflict detection 서버 계산 또는 worker화
4. people search DB 중심 최적화
5. detail/photo fetch 캐싱 전략 추가

기대 효과:

- 핵심 사용 화면 반응속도 개선
- 입력/필터/상세 열기 지연 감소

### Phase 3. 데이터 계층 최적화

예상 기간: 3~5일

우선 작업:

1. calendar 데이터 조회 RPC 또는 view 설계
2. people 검색 인덱스 및 FTS/trigram 적용
3. source metadata / connection metadata 캐싱 전략 정리
4. 응답 payload 축소와 summary/detail contract 정리

기대 효과:

- 서버 응답시간 안정화
- 데이터 양이 늘어도 UX 저하 폭 완화

## 추천 작업 순서

실행 우선순위는 아래 순서를 권장한다.

1. 공통 번들 축소
2. 네비게이션 prefetch 복구
3. 캘린더 진입 후 자동 sync 완화
4. 공개 이미지 최적화
5. Alerts SSR 전환
6. CalendarEventsOverview 분해
7. People 검색 API 최적화
8. 충돌 계산 서버/worker 이전
9. 데이터 조회 RPC 및 인덱스 정비

## 작업 백로그

### 번들/레이아웃

- [ ] `app/layout.tsx`의 루트 클라이언트 의존성 축소
- [ ] `app/(app)/layout.tsx`와 루트 `LocaleProvider` 중복 정리
- [ ] `components/locale-provider.tsx`의 client-side dictionary 의존 제거
- [ ] analytics identity 초기화 위치 단일화
- [ ] `NavDebugLogger` 기본 번들 제외

### 네비게이션

- [ ] `components/nav-tab-button.tsx`를 `Link` 기반으로 교체
- [ ] 주요 route prefetch 정책 적용
- [ ] route transition 측정 로그 추가

### 캘린더/알림

- [ ] `components/calendar-events-overview.tsx`를 하위 island로 분리
- [ ] `components/unified-week-calendar.tsx` 계산/렌더 비용 프로파일링
- [ ] `/alerts` SSR 우선 렌더링 전환
- [ ] conflict detection의 서버 계산 또는 worker 이전
- [ ] event detail prefetch/cache 검토

### People

- [ ] `/api/people/search` 쿼리와 pagination 정확도 개선
- [ ] detail/manager/photo fetch 묶음 또는 캐시화
- [ ] virtualization 기준값과 실제 dataset에 맞는 튜닝

### 데이터 계층

- [ ] `fetchCalendarWindowData` round-trip 축소
- [ ] `fetchPeopleSummaryData` count/query 전략 개선
- [ ] Postgres 인덱스 점검 및 추가

### 자산

- [ ] 온보딩 이미지 AVIF/WebP 변환
- [ ] 비핵심 이미지 lazy 로드
- [ ] splash 이미지 정리
- [ ] 폰트 weight 축소

## 목표 성능 예산

1차 목표:

- 공통 First Load JS: `186 kB -> 140 kB 이하`
- `/calendar` First Load JS: `220 kB -> 180 kB 이하`
- `/people` First Load JS: `212 kB -> 180 kB 이하`
- warm route transition: `200 ms 이하`
- `/calendar` 첫 진입 후 불필요한 `router.refresh()` 제거 또는 최소화

2차 목표:

- 모바일 기준 LCP `2.5s 이하`
- 검색 입력 후 결과 반응 `150~200 ms 이내`
- 필터 변경 시 long task `50 ms 이하`

## 검증 방법

변경마다 아래를 반복한다.

### 정량 검증

1. `npm run build`
2. `du -ah public | sort -h | tail -n 40`
3. Lighthouse mobile 3회 평균
4. Chrome Performance 탭으로 `/calendar`, `/people`, `/alerts` 측정

### 기능 검증

1. 상단 탭 이동
2. calendar 검색/필터/상세 열기
3. alerts 상세 열기
4. people 검색/더 불러오기/상세 열기/사진 표시
5. 로그인/온보딩 공개 페이지 렌더링

### 회귀 방지 포인트

- locale 변경 동작
- PWA 설치/서비스워커 등록
- analytics 이벤트 중복/누락
- auth required redirect
- background sync 및 notification 동작

## 바로 시작할 첫 작업 제안

가장 먼저 진행할 가치가 큰 묶음은 아래 4개다.

1. `app/layout.tsx` 루트 클라이언트 경계 축소
2. `components/nav-tab-button.tsx`를 `Link` 기반으로 전환
3. `components/calendar-entry-sync.tsx` 실행 타이밍 완화
4. 온보딩 이미지 압축 및 lazy loading 적용

이 4개는 비교적 구현 범위가 명확하고, 초기 로딩과 체감 반응 속도에 동시에 영향을 준다.
