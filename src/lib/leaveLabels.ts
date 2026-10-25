import type { LeaveEntry, LeaveType, Profile } from '../core/types';
import { quarterLeaveTime } from '../core/worktime';
import { formatDays } from './format';

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  annual: '연차',
  special: '특별휴가',
  sick: '병가',
  other: '기타',
};

const PART_LABEL = { am: '오전', pm: '오후' } as const;

export const leaveLengthLabel = (quarters: number) =>
  quarters >= 4 ? '종일' : quarters === 2 ? '반차' : '반반차';

/** 달력 칸의 짧은 칩 글자. 색과 함께 글자로도 구분해요. */
export function leaveChipLabel(entry: LeaveEntry): string {
  if (entry.type !== 'annual')
    return entry.type === 'special' ? '특별' : LEAVE_TYPE_LABEL[entry.type];
  return entry.quarters >= 4 ? '연차' : leaveLengthLabel(entry.quarters);
}

export function leaveChipClass(entry: LeaveEntry): string {
  if (entry.type !== 'annual') {
    return 'bg-violet-100 text-violet-900 dark:bg-violet-900 dark:text-violet-100';
  }
  if (entry.quarters >= 4) return 'bg-blue-600 text-white';
  if (entry.quarters === 2) return 'bg-sky-100 text-sky-900 dark:bg-sky-900 dark:text-sky-100';
  return 'bg-teal-100 text-teal-900 dark:bg-teal-900 dark:text-teal-100';
}

/** 목록·스크린리더용 설명: '연차 오후 반반차 (16:00–18:00)' */
export function describeLeave(entry: LeaveEntry, profile?: Pick<Profile, 'workStart' | 'workEnd'>) {
  if (entry.isBulk) return `${entry.memo ?? '일괄 차감'} ${formatDays(entry.quarters)}일`;
  const parts = [LEAVE_TYPE_LABEL[entry.type]];
  if (entry.part) parts.push(PART_LABEL[entry.part]);
  parts.push(leaveLengthLabel(entry.quarters));
  let text = parts.join(' ');
  if (entry.quarters === 1 && entry.part && profile) {
    const { start, end } = quarterLeaveTime(profile.workStart, profile.workEnd, entry.part);
    text += ` (${start}–${end})`;
  }
  return text;
}
