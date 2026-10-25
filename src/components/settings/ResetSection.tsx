import { useState } from 'react';
import { clearAllData } from '../../db/backup';
import { Card } from '../Card';
import { ConfirmDialog } from '../ConfirmDialog';

/** SPEC §8.6 전체 초기화 (2단계 확인: 버튼 → "초기화" 입력) */
export function ResetSection() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const onConfirm = async () => {
    setBusy(true);
    // 프로필이 사라지면 온보딩으로 자동 이동해요.
    await clearAllData();
  };

  return (
    <Card title="전체 초기화">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        프로필·휴가·근무 기록·보정·회사 휴무일을 모두 지우고 처음부터 시작해요.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 h-12 w-full rounded-lg border border-red-300 font-semibold text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
      >
        전체 초기화
      </button>
      {open && (
        <ConfirmDialog
          title="모든 데이터를 지울까요?"
          confirmLabel="모두 지우기"
          danger
          confirmText="초기화"
          busy={busy}
          onConfirm={() => void onConfirm()}
          onCancel={() => setOpen(false)}
        >
          <p>지운 데이터는 되돌릴 수 없어요. 필요하면 먼저 백업을 내보내 주세요.</p>
        </ConfirmDialog>
      )}
    </Card>
  );
}
