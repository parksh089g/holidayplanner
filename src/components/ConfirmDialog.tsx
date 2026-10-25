import { useId, useState, type ReactNode } from 'react';
import { inputClass, secondaryButtonClass } from '../lib/ui';
import { Modal } from './Modal';

/**
 * 확인 대화상자. confirmText를 주면 그 글자를 직접 입력해야 확인할 수 있어요 (2단계 확인).
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  danger = false,
  confirmText,
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  confirmText?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const inputId = useId();
  const [typed, setTyped] = useState('');
  const ready = confirmText === undefined || typed.trim() === confirmText;

  return (
    <Modal labelledBy={titleId} onClose={onCancel}>
      <h2 id={titleId} className="text-lg font-bold">
        {title}
      </h2>
      <div className="mt-2 space-y-2 text-sm text-gray-700 dark:text-gray-300">{children}</div>
      {confirmText !== undefined && (
        <div className="mt-4">
          <label htmlFor={inputId} className="text-sm font-medium">
            확인하려면 "{confirmText}"를 입력해 주세요
          </label>
          <input
            id={inputId}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            className={inputClass}
          />
        </div>
      )}
      <div className="mt-5 flex gap-2">
        <button type="button" onClick={onCancel} className={`${secondaryButtonClass} flex-1`}>
          취소
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!ready || busy}
          className={`h-12 flex-[2] rounded-lg px-4 font-semibold text-white disabled:opacity-50 ${
            danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
