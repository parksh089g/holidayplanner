# holidayplanner · 연차 플래너

남은 연차를 근로기준법 기준으로 자동 계산하고, 공휴일 사이 샌드위치 연휴를 추천하고, 09:00–18:00 기준 초과근무와 주 52시간을 정산하는 개인용 웹앱입니다.

- 서버 없음: 모든 데이터는 내 브라우저(IndexedDB)에만 저장됩니다.
- 오프라인 동작: 휴대폰 홈 화면에 설치해 앱처럼 쓸 수 있는 PWA입니다.
- 무료 배포: GitHub Pages.

## 주요 기능 (MVP)

| 기능 | 설명 |
| --- | --- |
| 연차 자동 산정 | 입사일 기준. 1년 미만 월차, 15일 기본, 2년마다 1일 가산(최대 25일) |
| 휴가 기록 | 연차 / 반차(오전·오후) / 반반차(2시간) / 기타 |
| 잔여 대시보드 | 사용·계획·잔여, 소멸 D-day |
| 공휴일 달력 | 법정공휴일·대체공휴일·선거일 + 회사 휴무일 |
| 샌드위치 연휴 추천 | 연차 n일로 가장 길게 쉬는 구간을 효율순으로 |
| 근무시간 정산 | 출퇴근 기록, 점심 자동 차감, 초과근무, 주 52시간 게이지 |
| 백업·복원 | JSON 파일 내보내기/가져오기 |

## 기술 스택

React 18 · Vite 5 · TypeScript · Tailwind CSS · Dexie(IndexedDB) · Zustand · date-fns · vite-plugin-pwa · Vitest · Playwright

## 개발

```bash
npm install
npm run dev        # http://localhost:5173/holidayplanner/
npm test           # 단위 테스트 (Vitest)
npx playwright install chromium  # E2E 브라우저 (처음 한 번)
npm run test:e2e   # E2E (Playwright)
npm run build      # dist/ 생성
```

`main` 브랜치에 push하면 GitHub Actions가 테스트 후 GitHub Pages로 배포합니다.

## 문서

- [docs/SPEC.md](docs/SPEC.md): 개발 명세 (계산 규칙, 데이터 모델, 화면, 테스트 케이스)
- [docs/TASKS.md](docs/TASKS.md): 작업 순서와 완료 조건
- [CLAUDE.md](CLAUDE.md): 코딩 규칙 (사람과 AI 공통)

## 주의

계산 결과는 참고용입니다. 회사 취업규칙과 인사시스템 값이 우선합니다. 공휴일 데이터는 `public/holidays/`의 정적 파일이며, 정부 발표에 따라 갱신이 필요합니다.
