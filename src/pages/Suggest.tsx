import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useMemo, useState } from 'react';
import { HolidayDataBanner } from '../components/HolidayDataBanner';
import { BridgeCandidateCard } from '../components/suggest/BridgeCandidateCard';
import { SuggestFiltersBar } from '../components/suggest/SuggestFiltersBar';
import { Toast } from '../components/Toast';
import { computeAutoGrants } from '../core/accrual';
import { computeBalance } from '../core/balance';
import { bridgeRange, suggestBridges, type BridgeCandidate } from '../core/bridge';
import { toISO } from '../core/date';
import { checkNewLeave, fullDayLeaveDates } from '../core/leave';
import { QUARTERS_PER_DAY, type LeaveEntry } from '../core/types';
import {
  addLeaveEntries,
  deleteLeaveEntries,
  getProfile,
  listLeaveEntries,
  listManualGrants,
  newId,
} from '../db/repo';
import { useHolidays } from '../hooks/useHolidays';
import { useNow } from '../hooks/useNow';
import { CANDIDATE_DAY_LEGEND } from '../lib/candidateStyle';
import { formatShortDate } from '../lib/format';
import { useSuggestStore } from '../store/suggest';

/** SPEC §8.4 추천: 필터 → 후보 카드 → 계획에 넣기(되돌리기) */
export default function Suggest() {
  const [now] = useNow(60_000);
  const today = toISO(now);
  const thisYear = Number(today.slice(0, 4));
  const { setFilters, ...filters } = useSuggestStore();
  const holidays = useHolidays([thisYear, thisYear + 1]);
  const profile = useLiveQuery(getProfile);
  const entries = useLiveQuery(() => listLeaveEntries());
  const manualGrants = useLiveQuery(listManualGrants);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [toast, setToast] = useState<{ message: string; undoIds?: string[] }>();

  const planned = useMemo(() => fullDayLeaveDates(entries ?? []), [entries]);
  const grants = useMemo(
    () =>
      profile && manualGrants
        ? [...computeAutoGrants(profile.hireDate, `${thisYear + 1}-12-31`), ...manualGrants]
        : undefined,
    [profile, manualGrants, thisYear],
  );

  const { maxLeaveDays, minTotalDays, year, requireHoliday } = filters;
  const candidates = useMemo(() => {
    if (holidays.loading || !entries) return undefined;
    const { from, to } = bridgeRange(today, year);
    return suggestBridges(holidays.off, holidays.holidays, {
      from,
      to,
      maxLeaveDays,
      minTotalDays,
      requireHoliday,
      plannedLeaveDates: planned,
    });
  }, [holidays, entries, today, year, maxLeaveDays, minTotalDays, requireHoliday, planned]);

  // §5.5-6: 그 시점 잔여 연차로 부족한지 화면에서 판정해요.
  const isInsufficient = (c: BridgeCandidate) =>
    !!grants &&
    !!entries &&
    computeBalance(grants, entries, c.start).remainingQ < c.leaveDays * QUARTERS_PER_DAY;

  const plan = async (c: BridgeCandidate) => {
    if (!entries) return;
    const blocked = c.leaveDates.find(
      (date) =>
        checkNewLeave(
          { quarters: QUARTERS_PER_DAY, type: 'annual' },
          entries.filter((e) => e.date === date),
          false,
        ) !== undefined,
    );
    if (blocked) {
      setError(
        `${formatShortDate(blocked, thisYear)}에 이미 휴가가 있어서 넣지 못했어요. 달력에서 확인해 주세요.`,
      );
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const added: LeaveEntry[] = c.leaveDates.map((date) => ({
        id: newId(),
        date,
        quarters: QUARTERS_PER_DAY,
        type: 'annual',
        memo: '추천 연휴',
      }));
      await addLeaveEntries(added);
      setToast({
        message: `연차 ${added.length}일을 계획에 넣었어요.`,
        undoIds: added.map((e) => e.id),
      });
    } catch {
      setError('계획에 넣지 못했어요. 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  const undo = async (ids: string[]) => {
    await deleteLeaveEntries(ids);
    setToast({ message: '되돌렸어요.' });
  };

  const dismissToast = useCallback(() => setToast(undefined), []);

  return (
    <div>
      <h1 className="text-2xl font-bold">추천</h1>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        연차를 적게 쓰고 길게 쉬는 구간을 효율 높은 순으로 보여줘요.
      </p>
      <HolidayDataBanner missingYears={holidays.missingYears} failedYears={holidays.failedYears} />

      <div className="mt-4">
        <SuggestFiltersBar filters={filters} thisYear={thisYear} onChange={setFilters} />
      </div>

      <ul
        aria-label="미니 달력 색 설명"
        className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-700 dark:text-gray-300"
      >
        {CANDIDATE_DAY_LEGEND.map(({ kind, label, swatch }) => (
          <li key={kind} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`h-3 w-3 rounded-sm ${swatch}`} />
            {label}
          </li>
        ))}
      </ul>

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-700 dark:text-red-400">
          {error}
        </p>
      )}

      {!candidates ? (
        <p className="mt-6 text-sm text-gray-600 dark:text-gray-400">공휴일을 불러오는 중이에요.</p>
      ) : candidates.length === 0 ? (
        <p className="mt-6 text-sm text-gray-600 dark:text-gray-400">
          조건에 맞는 연휴가 없어요. 연차 최대 일수를 늘리거나 최소 연휴를 줄여 보세요.
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm font-medium">
            후보 {candidates.length}개{candidates.length === 30 && ' (최대 30개)'}
          </p>
          <ul className="mt-2 grid gap-3 md:grid-cols-2">
            {candidates.map((c) => (
              <BridgeCandidateCard
                key={`${c.start}-${c.end}`}
                candidate={c}
                thisYear={thisYear}
                planned={planned}
                insufficient={isInsufficient(c)}
                busy={busy}
                onPlan={(cand) => void plan(cand)}
              />
            ))}
          </ul>
        </>
      )}

      {toast && (
        <Toast
          message={toast.message}
          actionLabel={toast.undoIds ? '되돌리기' : undefined}
          onAction={toast.undoIds ? () => void undo(toast.undoIds!) : undefined}
          onDismiss={dismissToast}
        />
      )}
    </div>
  );
}
