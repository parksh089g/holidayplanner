# holidayplanner 개발 명세서 (MVP)

> 이 문서가 구현의 기준입니다. 기획 배경은 [연차·근태 플래너 기획서](https://claude.ai/artifact/JRuZR9cXcL5aLP3iNPchRC)를 참고하세요.
> 작성일: 2026-10-23 · 대상 버전: v0.1 (MVP)

## 0. 한 줄 요약

입사일만 넣으면 법정 연차를 자동 계산하고, 공휴일 사이 샌드위치 연휴를 추천하고, 09:00–18:00 기준 초과근무와 주 52시간을 정산하는 **서버 없는 정적 PWA**입니다. 데이터는 브라우저 IndexedDB에만 저장하고 GitHub Pages로 배포합니다.

## 1. 확정된 전제

| 항목 | 값 | 비고 |
| --- | --- | --- |
| 연차 산정 기준 | 입사일 기준 | 회계연도 기준은 2단계 |
| 근무제 | 고정 09:00–18:00, 점심 12:00–13:00 | 소정근로 1일 8시간, 주 40시간 (월–금) |
| 휴가 최소 단위 | 반반차 2시간 = 0.25일 | 연차 1 / 반차 0.5 / 반반차 0.25 |
| 연속휴가 제한 | 없음 | 명령휴가 규칙 구현 안 함 |
| 서버 | 없음 | 외부 API 호출 없음 (공휴일은 정적 JSON) |
| 배포 | GitHub Pages, 저장소 `holidayplanner` | base 경로 `/holidayplanner/` |

## 2. 기술 스택

| 영역 | 패키지 | 메모 |
| --- | --- | --- |
| 빌드 | `vite` 5.x, `typescript` 5.x | `strict: true` |
| UI | `react` 18.x, `react-dom` 18.x | |
| 라우팅 | `react-router` 7.x **HashRouter** | GitHub Pages는 SPA 경로 새로고침 시 404가 나므로 해시 라우팅 사용. 6.x는 보안 수정이 없고(7.18+에만) 8.x는 React 19가 필요해서 7.x |
| 스타일 | `tailwindcss` 3.x | 모바일 우선, 다크 모드 `class` 전략 |
| 저장소 | `dexie` 4.x, `dexie-react-hooks` | IndexedDB 래퍼, 실시간 쿼리 |
| 상태 | `zustand` 4.x | UI 상태만 (데이터는 Dexie가 원천) |
| 날짜 | `date-fns` 3.x | `ko` 로케일 |
| PWA | `vite-plugin-pwa` | `registerType: 'autoUpdate'` |
| 테스트 | `vitest`, `@testing-library/react`, `fake-indexeddb`, `@playwright/test` | |
| 린트 | `eslint`, `prettier` | |

UI 컴포넌트 라이브러리는 쓰지 않고 Tailwind로 직접 만듭니다 (화면이 5개뿐이라 의존성을 줄이는 쪽이 유지보수에 유리).

## 3. 디렉터리 구조

```
holidayplanner/
├─ public/
│  ├─ holidays/2026.json, 2027.json   # 공휴일 데이터 (정적)
│  ├─ icons/                          # PWA 아이콘 192/512
│  └─ favicon.svg
├─ src/
│  ├─ core/            # 순수 함수만. React·Dexie import 금지
│  │  ├─ date.ts       # ISO 날짜 유틸
│  │  ├─ accrual.ts    # 연차 발생
│  │  ├─ balance.ts    # 잔여 계산
│  │  ├─ holidays.ts   # 휴일 판정, 대체공휴일 검증
│  │  ├─ bridge.ts     # 샌드위치 연휴 추천
│  │  ├─ worktime.ts   # 근무시간 정산
│  │  └─ types.ts      # 도메인 타입
│  ├─ db/
│  │  ├─ schema.ts     # Dexie 스키마·마이그레이션
│  │  ├─ repo.ts       # CRUD 함수
│  │  └─ backup.ts     # JSON 내보내기·가져오기
│  ├─ data/holidays.ts # public/holidays/*.json 로딩·캐시
│  ├─ pages/           # Home, Calendar, Suggest, Work, Settings, Onboarding
│  ├─ components/      # 공용 UI
│  ├─ hooks/
│  ├─ App.tsx, main.tsx, index.css
├─ tests/
│  ├─ core/*.test.ts   # 단위 테스트 (커버리지 90% 이상 목표)
│  └─ e2e/*.spec.ts    # Playwright
├─ .github/workflows/deploy.yml
├─ vite.config.ts, tailwind.config.ts, tsconfig.json
└─ docs/SPEC.md, docs/TASKS.md
```

## 4. 공통 규칙

- **날짜는 문자열** `YYYY-MM-DD`(ISODate), **시각은** `HH:mm`(HHmm)로 다룹니다. `Date` 객체는 `core/date.ts` 내부에서만 쓰고, 항상 로컬 자정 기준으로 생성합니다(`new Date(y, m-1, d)`). `new Date('2026-01-01')`은 UTC로 해석되므로 금지.
- 금액·일수 계산은 부동소수 오차를 피하려고 **휴가 일수를 0.25 단위 정수(quarter)로 저장·계산**합니다. 1일 = 4, 반차 = 2, 반반차 = 1. 화면 표시만 `/4` 합니다.
- 오늘 날짜는 `core`에 하드코딩하지 않고 인자로 받습니다 (`asOf: ISODate`). 테스트 재현성 확보.
- 주의 시작은 **월요일**.
- 모든 UI 문구는 한국어.

## 5. 도메인 로직

### 5.1 연차 발생 (`core/accrual.ts`)

근로기준법 제60조, 입사일 기준. MVP는 "매월 개근, 연간 출근율 80% 이상"을 가정하고, 예외는 사용자가 수동 보정(§5.2)으로 처리합니다.

```ts
export interface AutoGrant {
  id: string;            // 'auto-m-3', 'auto-y-1' 처럼 결정적 ID
  kind: 'monthly' | 'annual';
  grantDate: ISODate;    // 발생일
  expireDate: ISODate;   // 이 날까지 사용 가능 (포함)
  quarters: number;      // 일수 × 4
  serviceYear: number;   // monthly는 0, annual은 근속연수 n
}

export function computeAutoGrants(hireDate: ISODate, until: ISODate): AutoGrant[];
```

규칙:

1. **1년 미만 월차**: k = 1…11에 대해 `grantDate = addMonths(hireDate, k)`, 1일씩. `expireDate = addYears(hireDate, 1) - 1일`. (2020.3.31 개정: 최초 1년 근로가 끝날 때까지 사용)
2. **연차**: n = 1, 2, 3… 에 대해 `grantDate = addYears(hireDate, n)`,
   `days = min(25, 15 + floor((n - 1) / 2))`,
   `expireDate = addYears(hireDate, n + 1) - 1일`.
3. `grantDate <= until`인 것만 반환합니다. 홈 화면은 `until = asOf`, 시뮬레이션은 미래 날짜를 넘깁니다.
4. 말일 처리: `addMonths('2026-01-31', 1) = '2026-02-28'`처럼 date-fns의 말일 보정을 그대로 따릅니다. 2월 29일 입사자는 평년에 2월 28일로 보정.

| 근속연수 n | 1 | 2 | 3 | 4 | 5 | 7 | 9 | 11 | 21 | 23 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 연차(일) | 15 | 15 | 16 | 16 | 17 | 18 | 19 | 20 | 25 | 25 |

### 5.2 수동 보정

`leaveGrants` 스토어에 사용자가 직접 넣는 부여분입니다. 용도: 인사시스템과 숫자 맞추기, 이월 연차, 포상휴가, 출근율 80% 미만 감액(음수 허용).

```ts
interface ManualGrant {
  id: string;
  grantDate: ISODate;
  expireDate: ISODate;
  quarters: number;   // 음수면 차감
  memo: string;
}
```

**온보딩의 "올해 이미 쓴 연차"**는 별도 개념 없이 `leaveEntries`에 `type: 'annual'`, `date = 입력일`, `memo: '앱 사용 전 사용분'`인 항목 하나로 저장합니다(일괄 차감 항목, `isBulk: true`).

### 5.3 잔여 계산 (`core/balance.ts`)

```ts
interface GrantBalance {
  grant: AutoGrant | ManualGrant;
  usedQ: number;       // asOf 이전(포함) 사용분
  plannedQ: number;    // asOf 이후 계획분
  remainingQ: number;  // quarters - usedQ - plannedQ (음수 가능 = 초과 사용)
}

interface BalanceSummary {
  asOf: ISODate;
  activeGrants: GrantBalance[];   // grantDate <= asOf <= expireDate
  totalGrantedQ: number;
  usedQ: number;
  plannedQ: number;
  remainingQ: number;
  nextExpiry?: { date: ISODate; remainingQ: number };  // 가장 빨리 소멸하는, 잔여가 남은 부여분
  nextGrant?: { date: ISODate; quarters: number };     // 다음 자동 발생
}

export function computeBalance(
  grants: (AutoGrant | ManualGrant)[],
  entries: LeaveEntry[],
  asOf: ISODate,
): BalanceSummary;
```

배분 규칙:

1. `type`이 `annual`인 휴가만 연차에서 차감합니다. `special`, `sick` 등은 기록만 하고 차감하지 않습니다.
2. 휴가 항목은 **날짜 오름차순**으로, 그 날짜에 유효한(`grantDate <= date <= expireDate`) 부여분 중 **소멸일이 가장 빠른 것부터** 차감합니다(FIFO by expiry). 한 부여분이 모자라면 다음 부여분으로 넘어갑니다.
3. 유효한 부여분이 하나도 없거나 모두 소진되면 그 항목은 `overdrawn`으로 표시하고 경고를 띄웁니다(저장은 허용).
4. 사용/계획 구분은 저장하지 않고 날짜로 판정합니다: `date <= asOf`면 사용, 아니면 계획.
5. 소멸된 부여분의 남은 일수는 "소멸"로 집계해 홈 화면에 보여줍니다(금전 보상 여부는 회사 규정이라 계산하지 않음).

### 5.4 휴일 판정 (`core/holidays.ts`)

```ts
type HolidayKind = 'legal' | 'substitute' | 'election' | 'temporary' | 'company';
interface Holiday { date: ISODate; name: string; kind: HolidayKind }

export function buildOffDaySet(holidays: Holiday[], enabledCompanyDates: Set<ISODate>): Set<ISODate>;
export function isOffDay(date: ISODate, off: Set<ISODate>): boolean;   // 토·일 또는 off에 포함
export function deriveSubstitutes(base: Holiday[]): Holiday[];          // 테스트·검증 전용
```

- 공휴일의 **정답은 `public/holidays/{year}.json` 데이터**입니다. 앱은 대체공휴일을 규칙으로 계산해서 쓰지 않습니다(정부 발표와 어긋날 위험).
- `deriveSubstitutes`는 데이터 검증용입니다. 테스트에서 "데이터의 대체공휴일 = 규칙으로 계산한 대체공휴일"을 확인해 데이터 입력 실수를 잡습니다.
- 대체공휴일 규칙(「관공서의 공휴일에 관한 규정」 제3조, 2026년 공휴일법 개정 반영):
  - 설날·추석 연휴(각 3일)가 **일요일** 또는 다른 공휴일과 겹치면 연휴 다음 첫 비공휴일.
  - 삼일절, 어린이날, 노동절, 부처님오신날, 제헌절, 광복절, 개천절, 한글날, 기독탄신일이 **토요일·일요일** 또는 다른 공휴일과 겹치면 다음 첫 비공휴일.
  - 신정, 현충일은 대체공휴일 없음.
  - 노동절(5/1)·제헌절(7/17)은 2026년부터 공휴일입니다. 대체 적용 여부는 2027년 공개 달력(5/3, 7/19 대체공휴일)을 근거로 했으므로 **한국천문연구원 특일정보로 재확인 후 확정**합니다.
- 회사 휴무일(`company`)은 설정에서 사용자가 추가합니다(예: 창립기념일).

### 5.5 샌드위치 연휴 추천 (`core/bridge.ts`)

```ts
interface BridgeOptions {
  from: ISODate;            // 기본: asOf
  to: ISODate;              // 기본: 다음 해 12-31
  maxLeaveDays: number;     // 기본 3, 1–10
  minTotalDays: number;     // 기본 4
  requireHoliday: boolean;  // 기본 true: 주말만 끼운 평범한 휴가 제외
  plannedLeaveDates: Set<ISODate>; // 이미 계획한 연차일은 쉬는 날로 취급
}

interface BridgeCandidate {
  start: ISODate; end: ISODate;
  totalDays: number;        // 연속 휴무 일수
  leaveDates: ISODate[];    // 연차를 써야 하는 평일
  leaveDays: number;
  efficiency: number;       // totalDays / leaveDays, 소수 둘째 자리
  holidays: Holiday[];      // 구간에 포함된 공휴일
}

export function suggestBridges(off: Set<ISODate>, holidays: Holiday[], opt: BridgeOptions): BridgeCandidate[];
```

알고리즘:

1. `from`–`to`의 각 날짜를 휴무(주말·공휴일·회사휴무·계획연차) / 근무로 표시합니다.
2. 연속된 휴무일을 묶어 **휴무 블록** 목록 B₀…Bₘ을 만듭니다.
3. 모든 i ≤ j 쌍에 대해 구간 `Bᵢ.start … Bⱼ.end`를 후보로 보고, 그 사이 근무일 수를 `leaveDays`로 셉니다.
   - `1 <= leaveDays <= maxLeaveDays`이고 `totalDays >= minTotalDays`인 것만 남깁니다. (`leaveDays`가 maxLeaveDays를 넘으면 j를 더 늘릴 필요가 없으므로 내부 루프 break)
   - `requireHoliday`면 구간에 `kind !== 'company'`인 공휴일이 1일 이상 있어야 합니다.
4. **지배되는 후보 제거**: 같은 `leaveDays`로 더 긴 구간이 있으면, 그 구간에 완전히 포함되는 짧은 후보는 제거합니다.
5. 정렬: `efficiency` 내림차순 → `totalDays` 내림차순 → `start` 오름차순. 최대 30개.
6. 각 후보에 대해 화면은 그 시점 잔여 연차(§5.3)로 "잔여 부족" 배지를 판정합니다. 추천 로직 자체는 잔여를 모릅니다.

예시 (2026년 데이터 기준):

| 구간 | 연차 사용일 | 총 휴무 | 효율 |
| --- | --- | --- | --- |
| 9/24(목)–10/5(월) | 9/28–10/2 (5일) | 12일 | 2.4 |
| 9/19(토)–9/27(일) | 9/21–9/23 (3일) | 9일 | 3.0 |
| 5/1(금)–5/5(화) | 5/4 (1일) | 5일 | 5.0 |

### 5.6 근무시간 정산 (`core/worktime.ts`)

```ts
interface WorkLog { date: ISODate; clockIn: HHmm; clockOut: HHmm; breakMinutes?: number; note?: string }

interface DayResult {
  date: ISODate;
  workedMin: number;      // 실근로 = (퇴근 - 출근) - 휴게
  overtimeMin: number;    // 근무일: max(0, workedMin - 480), 휴무일: workedMin 전부
  isOffDayWork: boolean;
  leaveCreditMin: number; // 그날 휴가 인정 시간 (연차 480, 반차 240, 반반차 120)
}

interface WeekResult {
  weekStart: ISODate;     // 월요일
  days: DayResult[];
  workedMin: number;      // 실근로 합계 (휴가 인정 시간 제외)
  overtimeMin: number;    // max(Σ 일별 초과, workedMin - 2400)
  remainingTo52Min: number; // 3120 - workedMin (음수면 초과)
  warning: 'none' | 'near' | 'over'; // near: 48시간 이상
}

export function computeDay(log: WorkLog, opts: { isOffDay: boolean; leaveQ: number }): DayResult;
export function computeWeek(weekStart: ISODate, logs: WorkLog[], ctx: ...): WeekResult;
```

규칙:

1. `clockOut < clockIn`이면 자정을 넘긴 것으로 보고 24시간을 더합니다.
2. `breakMinutes`가 비어 있으면 **점심 12:00–13:00과 근무시간이 겹치는 분**을 자동 차감합니다(0–60분). 저녁 휴게 등은 사용자가 직접 입력.
3. 주 52시간 판정은 **실근로만** 합산합니다(휴가 인정 시간 제외). 휴가 인정 시간은 "소정근로 충족" 표시에만 씁니다.
4. 연장근로 수치는 "추정"으로 표시하고 법적 판단이 아니라는 안내 문구를 붙입니다.
5. 출근/퇴근 버튼: 현재 시각을 5분 단위로 반올림하지 않고 분 단위 그대로 저장합니다. 퇴근 기록 전에는 `clockOut` 없이 진행 중 상태로 저장(`clockOut: ''`)하고, 홈에서 "현재까지 n시간 m분"을 보여줍니다.

## 6. 데이터 저장 (Dexie)

```ts
// db/schema.ts
export const db = new Dexie('holidayplanner');
db.version(1).stores({
  profile:      'id',                 // 항상 id = 'me' 한 건
  leaveGrants:  'id, grantDate',      // 수동 보정분만 저장 (자동 발생분은 매번 계산)
  leaveEntries: 'id, date, type',
  workLogs:     'date',
  holidays:     'date, kind',         // 사용자 추가분(company)만 저장
});

interface Profile {
  id: 'me';
  hireDate: ISODate;
  workStart: HHmm;        // '09:00'
  workEnd: HHmm;          // '18:00'
  lunchStart: HHmm;       // '12:00'
  lunchEnd: HHmm;         // '13:00'
  theme: 'system' | 'light' | 'dark';
  onboardedAt: string;    // ISO datetime
  schemaVersion: 1;
}

interface LeaveEntry {
  id: string;             // crypto.randomUUID()
  date: ISODate;
  quarters: 1 | 2 | 4;    // 반반차, 반차, 연차 (일괄 차감 항목은 임의 값 허용)
  part?: 'am' | 'pm';     // 반차·반반차일 때 오전/오후
  type: 'annual' | 'special' | 'sick' | 'other';
  memo?: string;
  isBulk?: boolean;       // 온보딩 일괄 차감
}
```

- 자동 발생 연차는 저장하지 않습니다. 입사일만 바꾸면 전부 다시 계산됩니다.
- 앱 시작 시 `navigator.storage.persist()`를 요청해 브라우저가 데이터를 임의 삭제하지 않도록 합니다.

### 백업 포맷 (`db/backup.ts`)

```json
{
  "app": "holidayplanner",
  "schemaVersion": 1,
  "exportedAt": "2026-10-23T10:00:00+09:00",
  "profile": { ... },
  "leaveGrants": [ ... ],
  "leaveEntries": [ ... ],
  "workLogs": [ ... ],
  "customHolidays": [ ... ]
}
```

- 파일명: `holidayplanner-backup-YYYYMMDD.json`.
- 가져오기는 **전체 교체**만 지원(병합 없음). 교체 전 확인 대화상자를 띄우고, 현재 데이터를 자동으로 한 번 내보내기 합니다.
- `schemaVersion`이 앱보다 높으면 거부, 낮으면 변환기를 거칩니다.

## 7. 공휴일 데이터

`public/holidays/{year}.json`:

```json
{
  "year": 2026,
  "source": "검증 출처 설명",
  "verified": false,
  "holidays": [{ "date": "2026-01-01", "name": "신정", "kind": "legal" }]
}
```

- MVP는 2026, 2027년 파일을 저장소에 넣어 배포합니다. 앱은 필요한 연도 파일을 `fetch`하고 서비스워커가 캐시합니다.
- 파일이 없는 연도는 달력에 "공휴일 데이터 없음" 배너를 띄우고 주말만 휴무로 처리합니다.
- `verified: false`인 파일은 설정 화면에 "공휴일 데이터 확인 중" 안내를 띄웁니다. 한국천문연구원 특일정보(공공데이터포털)로 대조한 뒤 `true`로 바꿉니다.
- 2단계: GitHub Actions 월 1회 스케줄로 특일정보 API를 호출해 JSON을 갱신하는 PR을 자동 생성합니다(API 키는 Actions Secret).

## 8. 화면 명세

라우트는 HashRouter 기준입니다. 하단 탭(모바일) / 좌측 사이드바(폭 768px 이상).

### 8.1 온보딩 `#/onboarding`

- `profile`이 없으면 어떤 경로로 들어와도 여기로 보냅니다.
- 1단계 입사일(필수, 오늘 이후 불가) → 2단계 근무시간(기본 09:00–18:00, 점심 12:00–13:00, 수정 가능) → 3단계 현재 연차 기간에 이미 쓴 연차(0.25 단위, 0 허용).
- 3단계 아래에 "앱이 계산한 현재 연차 기간: YYYY.MM.DD–YYYY.MM.DD, 발생 n일"을 보여줘 사용자가 인사시스템 숫자와 비교할 수 있게 합니다.
- 완료 시 홈으로 이동.

**완료 조건**: 입사일 2021-03-02, asOf 2026-10-23 → "현재 연차 기간 2026.03.02–2027.03.01, 발생 17일" 표시.

### 8.2 홈 `#/`

1. 잔여 연차 큰 숫자(예: `9.75일`) + 막대(사용 / 계획 / 잔여).
2. 소멸 D-day: "2027.03.01 소멸 예정 3.25일 (D-129)". 잔여가 0이면 숨김.
3. 다음 추천 연휴 1건(§5.5 1위, 오늘 이후) + "더 보기".
4. 오늘 근무: 출근/퇴근 버튼, 현재까지 근무시간, 이번 주 초과근무, 주 52시간 게이지.
5. 다가오는 공휴일 3개.

### 8.3 달력 `#/calendar`

- 월 보기 기본, 좌우 스와이프·버튼으로 이동. "연간" 토글로 12개월 미니 달력.
- 날짜 셀: 일요일·공휴일 빨강, 토요일 파랑, 공휴일 이름, 휴가 칩(연차/반차/반반차 색 구분), 근무 기록이 있으면 하단 점.
- 날짜 탭 → 하단 시트: 휴가 추가(연차 / 반차 오전·오후 / 반반차 시각 선택 / 기타 유형), 근무 기록 입력·수정, 삭제.
- 휴무일에 연차를 넣으려 하면 경고 후 막습니다.

### 8.4 추천 `#/suggest`

- 상단 필터: 연차 최대 n일(1–10), 최소 연휴 n일, 연도, "공휴일 포함만" 스위치.
- 후보 카드: `9/24(목) – 10/5(월) · 12일 쉬기 · 연차 5일 · 효율 2.4`, 구간 미니 달력(휴무/연차 색 구분), 잔여 부족 배지.
- "계획에 넣기" → 해당 평일들에 연차 항목 생성, 토스트에 "되돌리기".

### 8.5 근무 `#/work`

- 주 단위 화면(이전/다음 주). 요일별 막대: 정규 8시간 / 초과 / 휴가 인정 시간.
- 주 합계: 실근로, 연장(추정), 52시간까지 남은 시간. 48시간 이상 노랑, 52시간 초과 빨강.
- 기록 누락된 지난 근무일 목록과 "정시로 채우기" 버튼(09:00–18:00 일괄 입력).

### 8.6 설정 `#/settings`

- 프로필(입사일, 근무시간, 점심시간), 수동 보정 목록(추가·삭제), 회사 휴무일(추가·삭제), 테마, 백업 내보내기·가져오기, 전체 초기화(2단계 확인), 공휴일 데이터 상태, 앱 버전.

## 9. PWA·배포

- `vite.config.ts`: `base: '/holidayplanner/'`.
- manifest: `name: '연차 플래너'`, `short_name: '연차'`, `lang: 'ko'`, `display: 'standalone'`, `start_url: '/holidayplanner/'`, 아이콘 192·512 + maskable.
- 서비스워커: 앱 셸 precache, `holidays/*.json`은 StaleWhileRevalidate.
- `.github/workflows/deploy.yml`: `main` push 시 `npm ci → npm run test → npm run build → actions/deploy-pages`. 저장소 Settings → Pages → Source를 **GitHub Actions**로 설정해야 합니다.
- 무료 플랜의 GitHub Pages는 공개 저장소에서만 동작합니다. 데이터는 사용자 브라우저에만 있으므로 코드가 공개돼도 개인정보 문제는 없습니다.

## 10. 테스트 케이스 (Vitest, `tests/core`)

### 연차 발생

| # | 입사일 | asOf | 기대 |
| --- | --- | --- | --- |
| A1 | 2026-01-15 | 2026-01-14 | 부여 0건 |
| A2 | 2026-01-15 | 2026-04-15 | 월차 3건(2/15, 3/15, 4/15), 각 소멸 2027-01-14 |
| A3 | 2025-03-02 | 2026-03-01 | 월차 11건, 연차 0건 |
| A4 | 2025-03-02 | 2026-03-02 | 월차 11건 + 1년차 15일(소멸 2027-03-01) |
| A5 | 2021-03-02 | 2026-10-23 | 현재 유효 부여분 = 5년차 17일(2026-03-02–2027-03-01) |
| A6 | 2004-01-01 | 2026-10-23 | 22년차 25일 (상한) |
| A7 | 2026-01-31 | 2026-03-31 | 월차 2/28, 3/31 |
| A8 | 2024-02-29 | 2025-02-28 | 1년차 발생일 2025-02-28 |

### 잔여 계산

| # | 상황 | 기대 |
| --- | --- | --- |
| B1 | 15일 부여, 연차 3 + 반차 1 + 반반차 2 사용(모두 과거) | 잔여 11.0일 (44Q) |
| B2 | 월차 소멸일 직전 사용 + 새 연차 발생 직후 사용 | 각각 맞는 부여분에서 차감 |
| B3 | 두 부여분이 동시에 유효 | 소멸 빠른 쪽부터 차감 |
| B4 | 잔여보다 많이 계획 | 초과 항목 `overdrawn` |
| B5 | `special` 유형 | 차감 안 함 |
| B6 | 미래 날짜 휴가 | `plannedQ`로 집계 |

### 휴일·추천

| # | 상황 | 기대 |
| --- | --- | --- |
| H1 | 2026.json의 substitute 목록 | `deriveSubstitutes` 결과와 일치 (3/2, 5/25, 8/17, 10/5) |
| H2 | 2027.json | 2/9, 5/3, 7/19, 8/16, 10/4, 10/11, 12/27 |
| H3 | 2026-02-14 (토) | 휴무 |
| R1 | 2026, maxLeave 1, from 2026-04-01 | 5/1(금)–5/5(화) 후보에 연차 5/4, 효율 5.0 포함 |
| R2 | 2026, maxLeave 3, from 2026-09-01 | 9/19–9/27(연차 9/21–9/23, 9일) 포함 |
| R3 | `requireHoliday: true` | 공휴일 없는 구간 없음 |
| R4 | 계획 연차가 있는 날 | 휴무로 취급되어 후보가 확장됨 |

### 근무시간

| # | 입력 | 기대 |
| --- | --- | --- |
| W1 | 09:00–18:00 | 실근로 480분, 초과 0 |
| W2 | 08:50–20:30 | 휴게 60, 실근로 640, 초과 160 |
| W3 | 13:30–18:00 | 휴게 0, 실근로 270 |
| W4 | 11:30–12:30, breakMinutes 미입력 | 휴게 30 |
| W5 | 22:00–02:00 | 실근로 240 (자정 넘김) |
| W6 | 토요일 10:00–14:00 | 휴게 60, 실근로 180, `isOffDayWork`, 초과 180 |
| W7 | 월–금 각 10시간 실근로 | 주 3000분, 연장 600, 52시간까지 120 |
| W8 | 월–금 각 8시간 + 토 8시간 | 주 2880, 연장 480, `near` |

## 11. 비기능 요구

- 첫 로드(4G, 모바일) 2초 이내, JS 번들 gzip 200KB 이하.
- 오프라인에서 모든 기능 동작(공휴일 캐시가 없는 새 연도 제외).
- 접근성: 색만으로 정보를 구분하지 않음(휴가 칩에 글자 표기), 터치 영역 44px 이상, 다크 모드.
- 외부 네트워크 요청은 자기 도메인의 정적 파일뿐(분석 도구·폰트 CDN 없음, 시스템 폰트 사용).

## 12. 2단계 백로그 (MVP 이후)

- 회계연도 기준 산정, 시차출퇴근·선택적 근로시간제 정산
- 긴 휴가 플래너("7일 이상 쉬기" 목표 → 최소 연차 구간)
- 연차 소진 시뮬레이션, 사용촉진 시점 표시
- 로컬 알림(소멸 30일 전, 주 48시간 도달)
- .ics 내보내기, 월별 통계
- 공휴일 데이터 자동 갱신 Actions

## 참고 출처

- 근로기준법 제60조(연차 유급휴가), 제54조(휴게), 제53조(연장근로 제한)
- 「관공서의 공휴일에 관한 규정」 제3조(대체공휴일)
- 2026년 공휴일: [위키트리 정리 기사](https://www.wikitree.co.kr/articles/1098048), [KHolidayz 2026](https://kholidayz.com/year/2026)
- 2027년 공휴일: [KHolidayz 2027](https://kholidayz.com/year/2027)
- 위 공휴일 출처는 민간 정리 자료이므로 배포 전 한국천문연구원 특일정보로 대조합니다.
