import { useId, useMemo, useState, type FormEvent } from 'react';
import { computeBalance } from '../../core/balance';
import { checkNewLeave, type LeaveProblem } from '../../core/leave';
import type { Grant, ISODate, LeaveEntry, LeaveType, Profile } from '../../core/types';
import { quarterLeaveTime } from '../../core/worktime';
import { newId, putLeaveEntry } from '../../db/repo';
import { LEAVE_TYPE_LABEL, describeLeave } from '../../lib/leaveLabels';
import { choiceClass, inputClass, primaryButtonClass } from '../../lib/ui';

const LENGTHS = [
  [4, '종일'],
  [2, '반차'],
  [1, '반반차'],
] as const;

function problemMessage(problem: LeaveProblem, part: 'am' | 'pm'): string {
  if (problem === 'annual-on-off-day') return '휴무일에는 연차를 쓸 수 없어요.';
  if (problem === 'over-one-day') return '하루에 쓸 수 있는 휴가는 1일까지예요.';
  return `${part === 'am' ? '오전' : '오후'}에 이미 휴가가 있어요.`;
}

/** 휴가 추가: 종류 × 길이(종일·반차·반반차) × 오전·오후 (SPEC §8.3) */
export function LeaveForm({
  date,
  today,
  profile,
  isOff,
  sameDay,
  allEntries,
  grants,
  onMessage,
}: {
  date: ISODate;
  today: ISODate;
  profile: Profile;
  isOff: boolean;
  sameDay: LeaveEntry[];
  allEntries: LeaveEntry[];
  grants: Grant[];
  onMessage: (message: string) => void;
}) {
  const id = useId();
  const [type, setType] = useState<LeaveType>('annual');
  const [quarters, setQuarters] = useState<1 | 2 | 4>(4);
  const [part, setPart] = useState<'am' | 'pm'>('am');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);

  const draft = useMemo<LeaveEntry>(
    () => ({ id: 'draft', date, quarters, type, ...(quarters < 4 ? { part } : {}) }),
    [date, quarters, type, part],
  );
  const problem = checkNewLeave(draft, sameDay, isOff);

  // 잔여보다 많아도 저장은 허용하고 경고만 해요 (SPEC §5.3-3).
  const overdrawn = useMemo(() => {
    if (problem || draft.type !== 'annual') return false;
    const result = computeBalance(grants, [...allEntries, draft], today);
    return result.overdrawn.some((o) => o.entryId === draft.id);
  }, [problem, draft, grants, allEntries, today]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (problem) return;
    setSaving(true);
    try {
      const entry: LeaveEntry = {
        ...draft,
        id: newId(),
        ...(memo.trim() ? { memo: memo.trim() } : {}),
      };
      await putLeaveEntry(entry);
      setMemo('');
      onMessage(`휴가를 추가했어요: ${describeLeave(entry, profile)}`);
    } catch {
      onMessage('휴가를 저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const partLabel = (p: 'am' | 'pm') => {
    const name = p === 'am' ? '오전' : '오후';
    if (quarters !== 1) return name;
    const { start, end } = quarterLeaveTime(profile.workStart, profile.workEnd, p);
    return `${name} ${start}–${end}`;
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label htmlFor={`${id}-type`} className="text-sm font-medium">
          종류
        </label>
        <select
          id={`${id}-type`}
          value={type}
          onChange={(e) => setType(e.target.value as LeaveType)}
          className={inputClass}
        >
          {(Object.keys(LEAVE_TYPE_LABEL) as LeaveType[]).map((t) => (
            <option key={t} value={t}>
              {LEAVE_TYPE_LABEL[t]}
              {t === 'annual' ? '' : ' (연차에서 빼지 않아요)'}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">길이</legend>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {LENGTHS.map(([q, label]) => (
            <label key={q} className={choiceClass}>
              <input
                type="radio"
                name={`${id}-length`}
                className="sr-only"
                checked={quarters === q}
                onChange={() => setQuarters(q)}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {quarters < 4 && (
        <fieldset>
          <legend className="text-sm font-medium">시간대</legend>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {(['am', 'pm'] as const).map((p) => (
              <label key={p} className={choiceClass}>
                <input
                  type="radio"
                  name={`${id}-part`}
                  className="sr-only"
                  checked={part === p}
                  onChange={() => setPart(p)}
                />
                {partLabel(p)}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div>
        <label htmlFor={`${id}-memo`} className="text-sm font-medium">
          휴가 메모 (선택)
        </label>
        <input
          id={`${id}-memo`}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          className={inputClass}
        />
      </div>

      {problem && (
        <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
          {problemMessage(problem, part)}
        </p>
      )}
      {overdrawn && (
        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
          잔여 연차보다 많아요. 그래도 추가할 수 있어요.
        </p>
      )}

      <button
        type="submit"
        disabled={saving || problem !== undefined}
        className={`${primaryButtonClass} w-full`}
      >
        휴가 추가
      </button>
    </form>
  );
}
