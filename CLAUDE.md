# CLAUDE.md

이 저장소에서 코드를 작성하는 사람과 AI가 따르는 규칙입니다. 명세는 `docs/SPEC.md`, 작업 순서는 `docs/TASKS.md`를 기준으로 합니다.

## 명령어

- `npm run dev` / `npm run build` / `npm run preview`
- `npm test` (Vitest), `npm run test:e2e` (Playwright), `npm run lint`
- PR 전에 `npm run lint && npm test && npm run build`가 모두 통과해야 합니다.

## 구조 원칙

- `src/core/`는 **순수 함수만** 둡니다. React, Dexie, `window`, `Date.now()`를 import·호출하지 않습니다. 오늘 날짜는 `asOf` 인자로 받습니다.
- 계산 로직을 바꾸면 `tests/core/`에 테스트를 먼저 추가합니다. SPEC §10의 케이스 ID(A1, B3, W7 등)를 테스트 이름에 넣습니다.
- 화면 컴포넌트는 계산하지 않고 `core` 함수 결과를 보여주기만 합니다.
- 데이터의 원천은 Dexie입니다. Zustand에는 UI 상태(선택한 월, 필터 등)만 둡니다.

## 날짜·숫자 규칙

- 날짜는 `YYYY-MM-DD` 문자열, 시각은 `HH:mm` 문자열로 저장·전달합니다.
- `new Date('YYYY-MM-DD')` 금지 (UTC로 해석됨). `core/date.ts` 유틸만 씁니다.
- 휴가 일수는 0.25일 단위 정수(quarter)로 계산합니다. 1일 = 4. 표시할 때만 나눕니다.
- 주의 시작은 월요일입니다.

## 공휴일

- 공휴일의 정답은 `public/holidays/{year}.json`입니다. 대체공휴일을 코드로 계산해 화면에 쓰지 않습니다. `deriveSubstitutes`는 데이터 검증 테스트에만 씁니다.
- 새 연도 파일을 추가하면 H1 계열 테스트에 그 연도를 추가합니다.

## UI

- 모든 문구는 한국어 해요체로 통일합니다 (예: "저장했어요", "연차가 부족해요").
- 모바일 우선. 터치 영역 44px 이상. 색만으로 의미를 전달하지 않습니다.
- 외부 CDN·폰트·분석 스크립트를 넣지 않습니다.

## 커밋·PR

- 커밋 메시지: `feat: 연차 발생 계산 추가`, `fix:`, `test:`, `docs:`, `chore:` 접두어.
- PR 하나 = `docs/TASKS.md`의 작업 하나. PR 본문에 작업 ID(T1-2 등)와 완료 조건 확인 결과를 적고, 완료되면 TASKS.md 체크박스를 체크합니다.
