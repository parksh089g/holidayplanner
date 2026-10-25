import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { currentLeavePeriod } from '../core/accrual';
import { completeOnboarding, getProfile } from '../db/repo';
import { ValidationError, isISODate } from '../db/validate';
import { formatDays, formatDotDate, parseDaysToQuarters } from '../lib/format';
import { todayISO } from '../lib/today';
import { inputClass } from '../lib/ui';
import { DEFAULT_WORK_TIMES, workTimesError, type WorkTimes } from '../lib/workTimes';

type Step = 1 | 2 | 3;

const STEP_TITLE: Record<Step, string> = {
  1: '입사일을 알려 주세요',
  2: '근무시간을 확인해 주세요',
  3: '현재 연차 기간에 이미 쓴 연차를 알려 주세요',
};

function Field({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      {children(id)}
    </div>
  );
}

/** SPEC §8.1: 입사일 → 근무시간 → 이미 쓴 연차 */
export default function Onboarding() {
  const navigate = useNavigate();
  const today = useMemo(todayISO, []);
  const existing = useLiveQuery(async () => (await getProfile()) ?? null, [], 'loading' as const);
  const [step, setStep] = useState<Step>(1);
  const [hireDate, setHireDate] = useState('');
  const [times, setTimes] = useState<WorkTimes>(DEFAULT_WORK_TIMES);
  const [usedDays, setUsedDays] = useState('0');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const errorId = useId();

  const period = useMemo(
    () => (isISODate(hireDate) ? currentLeavePeriod(hireDate, today) : undefined),
    [hireDate, today],
  );
  const usedQ = parseDaysToQuarters(usedDays);

  if (existing === 'loading') return null;
  if (existing && !saving) return <Navigate to="/" replace />;

  const validateStep = (): string | undefined => {
    if (step === 1) {
      if (!isISODate(hireDate)) return '입사일을 입력해 주세요.';
      if (hireDate > today) return '입사일은 오늘 이후일 수 없어요.';
    }
    if (step === 2) return workTimesError(times);
    if (step === 3 && usedQ === undefined) return '0.25일 단위로 0일 이상 입력해 주세요.';
    return undefined;
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const message = validateStep();
    setError(message);
    if (message) return;
    if (step < 3) {
      setStep((step + 1) as Step);
      return;
    }
    setSaving(true);
    try {
      await completeOnboarding(
        {
          id: 'me',
          hireDate,
          ...times,
          theme: 'system',
          onboardedAt: new Date().toISOString(),
          schemaVersion: 1,
        },
        usedQ ?? 0,
        today,
      );
      navigate('/', { replace: true });
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : '저장하지 못했어요. 다시 시도해 주세요.');
      setSaving(false);
    }
  };

  const goBack = () => {
    setError(undefined);
    setStep((step - 1) as Step);
  };

  const errorProps = error ? { 'aria-invalid': true, 'aria-describedby': errorId } : {};

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-[env(safe-area-inset-bottom)]">
      <header className="pt-8">
        <h1 className="text-2xl font-bold">연차 플래너 시작하기</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          입력한 내용은 이 기기 브라우저에만 저장돼요.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">{step} / 3단계</p>
          <div aria-hidden="true" className="flex flex-1 gap-1">
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                className={`h-1.5 flex-1 rounded-full ${
                  n <= step ? 'bg-blue-600 dark:bg-blue-400' : 'bg-gray-200 dark:bg-gray-800'
                }`}
              />
            ))}
          </div>
        </div>
      </header>

      <form onSubmit={onSubmit} noValidate className="flex flex-1 flex-col pt-6">
        <h2 className="text-lg font-semibold">{STEP_TITLE[step]}</h2>

        <div className="mt-4 space-y-4">
          {step === 1 && (
            <Field label="입사일">
              {(id) => (
                <input
                  id={id}
                  type="date"
                  required
                  autoFocus
                  max={today}
                  value={hireDate}
                  onChange={(e) => setHireDate(e.target.value)}
                  className={inputClass}
                  {...errorProps}
                />
              )}
            </Field>
          )}

          {step === 2 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ['workStart', '출근'],
                    ['workEnd', '퇴근'],
                    ['lunchStart', '점심 시작'],
                    ['lunchEnd', '점심 끝'],
                  ] as const
                ).map(([key, label]) => (
                  <Field key={key} label={label}>
                    {(id) => (
                      <input
                        id={id}
                        type="time"
                        required
                        value={times[key]}
                        onChange={(e) => setTimes({ ...times, [key]: e.target.value })}
                        className={inputClass}
                        {...errorProps}
                      />
                    )}
                  </Field>
                ))}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                소정근로는 하루 8시간이에요. 점심시간은 근무시간에서 자동으로 빼요.
              </p>
            </>
          )}

          {step === 3 && (
            <>
              <Field label="이미 쓴 연차 (일)">
                {(id) => (
                  <input
                    id={id}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.25}
                    autoFocus
                    value={usedDays}
                    onChange={(e) => setUsedDays(e.target.value)}
                    className={inputClass}
                    {...errorProps}
                  />
                )}
              </Field>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                반차는 0.5일, 반반차는 0.25일로 입력해요. 없으면 0이에요.
              </p>
              {period && (
                <dl className="rounded-lg bg-gray-100 p-4 text-sm dark:bg-gray-900">
                  <dt className="text-gray-600 dark:text-gray-400">앱이 계산한 현재 연차 기간</dt>
                  <dd className="mt-1 font-semibold">
                    {formatDotDate(period.start)}–{formatDotDate(period.end)}, 발생{' '}
                    {formatDays(period.grantedQ)}일
                  </dd>
                  {period.firstYear && (
                    <dd className="mt-1 text-gray-600 dark:text-gray-400">
                      입사 1년 미만이라 한 달 개근할 때마다 1일씩 생겨요.
                    </dd>
                  )}
                  <dd className="mt-2 text-gray-600 dark:text-gray-400">
                    인사시스템 숫자와 다르면 설정에서 수동 보정을 추가할 수 있어요.
                  </dd>
                  {usedQ !== undefined && usedQ > period.grantedQ && (
                    <dd className="mt-2 font-medium text-amber-800 dark:text-amber-300">
                      발생한 연차보다 많이 입력했어요. 숫자를 다시 확인해 주세요.
                    </dd>
                  )}
                </dl>
              )}
            </>
          )}

          {error && (
            <p
              id={errorId}
              role="alert"
              className="text-sm font-medium text-red-700 dark:text-red-400"
            >
              {error}
            </p>
          )}
        </div>

        <div className="mt-auto flex gap-3 py-6">
          {step > 1 && (
            <button
              type="button"
              onClick={goBack}
              disabled={saving}
              className="h-12 flex-1 rounded-lg border border-gray-300 font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              이전
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="h-12 flex-[2] rounded-lg bg-blue-600 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {step < 3 ? '다음' : saving ? '저장하는 중이에요' : '시작하기'}
          </button>
        </div>
      </form>
    </main>
  );
}
