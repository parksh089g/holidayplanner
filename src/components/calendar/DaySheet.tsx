import { useEffect, useId, useRef, useState } from 'react';
import { weekdayOf } from '../../core/date';
import type { Grant, Holiday, ISODate, LeaveEntry, Profile, WorkLog } from '../../core/types';
import { deleteLeaveEntry } from '../../db/repo';
import { describeLeave } from '../../lib/leaveLabels';
import { LeaveForm } from './LeaveForm';
import { WorkLogForm } from './WorkLogForm';

const WEEKDAY_NAME = ['일', '월', '화', '수', '목', '금', '토'];

/** 날짜를 누르면 아래에서 올라오는 시트: 휴가 추가·삭제, 근무 기록 입력·수정·삭제 (SPEC §8.3) */
export function DaySheet({
  date,
  today,
  profile,
  isOff,
  holidays,
  entries,
  allEntries,
  grants,
  log,
  leaveQ,
  onClose,
}: {
  date: ISODate;
  today: ISODate;
  profile: Profile;
  isOff: boolean;
  holidays: Holiday[];
  /** 이 날짜의 휴가 (일괄 차감 포함) */
  entries: LeaveEntry[];
  allEntries: LeaveEntry[];
  grants: Grant[];
  log?: WorkLog;
  leaveQ: number;
  onClose: () => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const [, month, day] = date.split('-').map(Number);
  const dayEntries = entries.filter((e) => !e.isBulk);

  const remove = async (entry: LeaveEntry) => {
    await deleteLeaveEntry(entry.id);
    setMessage(`휴가를 지웠어요: ${describeLeave(entry, profile)}`);
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 md:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="max-h-[88dvh] w-full overflow-y-auto rounded-t-2xl bg-white px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 focus:outline-none dark:bg-gray-900 md:max-w-lg md:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 id={titleId} className="text-lg font-bold">
              {month}월 {day}일 ({WEEKDAY_NAME[weekdayOf(date)]})
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {holidays.length > 0
                ? holidays.map((h) => h.name).join(', ')
                : isOff
                  ? '쉬는 날'
                  : '근무일'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            aria-label="닫기"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <p role="status" className="min-h-5 text-sm font-medium text-blue-700 dark:text-blue-300">
          {message}
        </p>

        <section aria-label="휴가" className="mt-2">
          <h3 className="text-base font-semibold">휴가</h3>
          {entries.length > 0 && (
            <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
              {entries.map((entry) => {
                const label = describeLeave(entry, profile);
                return (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-2 py-1 pl-3 pr-1"
                  >
                    <span className="text-sm">
                      {label}
                      {entry.memo && !entry.isBulk && (
                        <span className="block text-xs text-gray-600 dark:text-gray-400">
                          {entry.memo}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => void remove(entry)}
                      aria-label={`${label} 삭제`}
                      className="h-11 shrink-0 rounded-lg px-3 text-sm font-medium text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      삭제
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-3">
            <LeaveForm
              date={date}
              today={today}
              profile={profile}
              isOff={isOff}
              sameDay={dayEntries}
              allEntries={allEntries}
              grants={grants}
              onMessage={setMessage}
            />
          </div>
        </section>

        <section
          aria-label="근무 기록"
          className="mt-6 border-t border-gray-100 pt-4 dark:border-gray-800"
        >
          <h3 className="text-base font-semibold">근무 기록</h3>
          <div className="mt-3">
            <WorkLogForm
              date={date}
              today={today}
              profile={profile}
              isOff={isOff}
              leaveQ={leaveQ}
              log={log}
              onMessage={setMessage}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
