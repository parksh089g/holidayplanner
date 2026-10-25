import { useRef, useState, type ChangeEvent } from 'react';
import type { ISODate } from '../../core/types';
import {
  backupFileName,
  createBackup,
  parseBackup,
  restoreBackup,
  type BackupFile,
} from '../../db/backup';
import { ValidationError } from '../../db/validate';
import { downloadJson, readFileText } from '../../lib/download';
import { primaryButtonClass, secondaryButtonClass } from '../../lib/ui';
import { Card } from '../Card';
import { ConfirmDialog } from '../ConfirmDialog';

function describeBackup(b: BackupFile) {
  const when = b.exportedAt.slice(0, 16).replace('T', ' ').split('-').join('.');
  return {
    when,
    counts: `휴가 ${b.leaveEntries.length}건, 근무 기록 ${b.workLogs.length}건, 수동 보정 ${b.leaveGrants.length}건, 회사 휴무일 ${b.customHolidays.length}건`,
  };
}

/** SPEC §6 백업: JSON 내보내기, 가져오기는 전체 교체 + 교체 전 자동 내보내기 */
export function BackupSection({ today }: { today: ISODate }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<BackupFile>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

  const exportNow = async (tag?: string) => {
    downloadJson(backupFileName(today, tag), await createBackup(new Date()));
  };

  const onExport = async () => {
    setError(undefined);
    try {
      await exportNow();
      setMessage('백업 파일을 내려받았어요. 안전한 곳에 보관해 주세요.');
    } catch {
      setError('내보내지 못했어요. 다시 시도해 주세요.');
    }
  };

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일을 다시 골라도 동작하게
    if (!file) return;
    setMessage(undefined);
    try {
      setPending(parseBackup(JSON.parse(await readFileText(file))));
      setError(undefined);
    } catch (err) {
      setError(
        err instanceof ValidationError
          ? err.message
          : '파일을 읽지 못했어요. 연차 플래너에서 내보낸 JSON 파일인지 확인해 주세요.',
      );
    }
  };

  const onConfirmImport = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      // 교체 전에 지금 데이터를 한 번 내보내요 (SPEC §6).
      await exportNow('before-import');
      await restoreBackup(pending);
      setPending(undefined);
      setMessage('백업으로 바꿨어요. 바꾸기 전 데이터는 파일로 내려받아 뒀어요.');
    } catch {
      setError('가져오지 못했어요. 지금 데이터는 그대로예요.');
    } finally {
      setBusy(false);
    }
  };

  const summary = pending && describeBackup(pending);

  return (
    <Card title="백업">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        데이터는 이 기기 브라우저에만 있어요. 기기를 바꾸거나 브라우저 데이터를 지우기 전에 내보내
        두세요.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => void onExport()} className={primaryButtonClass}>
          내보내기
        </button>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className={secondaryButtonClass}
        >
          가져오기
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          onChange={(e) => void onPick(e)}
          className="sr-only"
          tabIndex={-1}
          aria-label="백업 파일 고르기"
        />
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-2 text-sm font-medium text-blue-700 dark:text-blue-300">
          {message}
        </p>
      )}

      {pending && summary && (
        <ConfirmDialog
          title="이 백업으로 바꿀까요?"
          confirmLabel="바꾸기"
          busy={busy}
          onConfirm={() => void onConfirmImport()}
          onCancel={() => setPending(undefined)}
        >
          <p>
            {summary.when}에 만든 백업이에요. {summary.counts}.
          </p>
          <p>
            지금 데이터를 <strong>모두 지우고</strong> 이 백업으로 바꿔요(합치지 않아요). 바꾸기
            전에 지금 데이터를 파일로 한 번 내려받아 둬요.
          </p>
        </ConfirmDialog>
      )}
    </Card>
  );
}
