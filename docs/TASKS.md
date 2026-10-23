# holidayplanner 작업 목록 (MVP)

> 위에서부터 순서대로 진행합니다. 각 작업은 PR 하나 크기이고, "완료 조건"을 만족하면 체크합니다.
> 상세 규칙은 [SPEC.md](./SPEC.md)의 해당 절을 따릅니다.

## M0. 프로젝트 준비 (1주)

- [x] **T0-1 스캐폴딩**: `npm create vite@latest . -- --template react-ts`, Tailwind·ESLint·Prettier·Vitest 설정, `npm run dev/build/test/lint` 동작.
  - 완료 조건: 빈 화면에 "연차 플래너"가 뜨고 `npm test`가 통과.
- [ ] **T0-2 배포 파이프라인**: `vite.config.ts`에 `base: '/holidayplanner/'`, `.github/workflows/deploy.yml`(test → build → deploy-pages). 저장소 Settings → Pages → Source = GitHub Actions.
  - 완료 조건: `https://<github-id>.github.io/holidayplanner/`에서 화면이 열림.
- [ ] **T0-3 공휴일 데이터 검증**: `public/holidays/2026.json`, `2027.json`을 한국천문연구원 특일정보(공공데이터포털)와 대조하고 `verified: true`로 변경. 노동절·제헌절 대체공휴일 적용 여부 확인. (SPEC §5.4, §7)
  - 완료 조건: 대조 결과를 PR 본문에 표로 남김.
- [ ] **T0-4 라우팅·레이아웃 골격**: HashRouter, 하단 탭(홈/달력/추천/근무) + 설정, 768px 이상 사이드바, 다크 모드 토글. (SPEC §8)

## M1. 핵심 계산 로직 (`src/core`, 1주)

UI 없이 테스트로만 완성합니다. SPEC §10 테스트 케이스를 먼저 작성하고 구현합니다.

- [x] **T1-1 `date.ts`**: `parseISO`, `toISO`, `addDaysISO`, `addMonthsISO`, `addYearsISO`, `diffDays`, `weekdayOf`, `startOfWeekMon`, `eachDay(from, to)`. 로컬 자정 기준.
- [x] **T1-2 `accrual.ts`**: `computeAutoGrants` (SPEC §5.1). 테스트 A1–A8.
- [x] **T1-3 `balance.ts`**: `computeBalance` FIFO 배분 (SPEC §5.3). 테스트 B1–B6.
- [ ] **T1-4 `holidays.ts`**: `buildOffDaySet`, `isOffDay`, `deriveSubstitutes` (SPEC §5.4). 테스트 H1–H3.
- [ ] **T1-5 `bridge.ts`**: `suggestBridges` (SPEC §5.5). 테스트 R1–R4. 2년치 계산 50ms 이내.
- [ ] **T1-6 `worktime.ts`**: `computeDay`, `computeWeek` (SPEC §5.6). 테스트 W1–W8.
  - M1 완료 조건: `src/core` 커버리지 90% 이상.

## M2. 저장소와 화면 (2주)

- [ ] **T2-1 Dexie 스키마·repo**: SPEC §6. `fake-indexeddb`로 CRUD 테스트. `navigator.storage.persist()` 요청.
- [ ] **T2-2 공휴일 로더**: `data/holidays.ts`가 연도별 JSON fetch + 메모리 캐시 + 사용자 회사 휴무일 병합. 파일 없는 연도는 배너.
- [ ] **T2-3 온보딩**: SPEC §8.1. 완료 조건: 입사일 2021-03-02 입력 시 "발생 17일" 표시.
- [ ] **T2-4 홈**: SPEC §8.2. 잔여·소멸 D-day·추천 1건·오늘 근무·다가오는 공휴일.
- [ ] **T2-5 달력 + 휴가 등록 시트**: SPEC §8.3. 연차/반차(오전·오후)/반반차/기타, 휴무일 연차 차단.
- [ ] **T2-6 추천 화면**: SPEC §8.4. 필터, 후보 카드, "계획에 넣기" + 되돌리기.
- [ ] **T2-7 근무 화면 + 출퇴근 버튼**: SPEC §8.5. 주 52시간 게이지, 정시로 채우기.
- [ ] **T2-8 설정 + 백업**: SPEC §8.6, §6 백업 포맷. 가져오기 전 자동 내보내기.

## M3. 마무리 (1주)

- [ ] **T3-1 PWA**: manifest, 아이콘 192/512/maskable, 서비스워커 캐시 전략 (SPEC §9). 완료 조건: 휴대폰 홈 화면 설치 후 비행기 모드에서 동작.
- [ ] **T3-2 E2E**: Playwright로 온보딩 → 휴가 등록 → 추천 계획 넣기 → 백업/복원 시나리오.
- [ ] **T3-3 점검**: Lighthouse PWA·접근성 90점 이상, 번들 gzip 200KB 이하.
- [ ] **T3-4 v0.1 릴리스**: 태그 `v0.1.0`, README에 사용법 스크린샷.

## 2단계 (MVP 사용 후 결정)

SPEC §12 참고. 한 달 실사용 후 우선순위를 다시 정합니다.
