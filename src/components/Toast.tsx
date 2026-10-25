import { useEffect } from 'react';

/** 화면 아래 잠깐 뜨는 알림. 되돌리기 같은 동작 하나를 붙일 수 있어요. */
export function Toast({
  message,
  actionLabel,
  onAction,
  onDismiss,
  duration = 6000,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  duration?: number;
}) {
  useEffect(() => {
    const id = setTimeout(onDismiss, duration);
    return () => clearTimeout(id);
  }, [message, duration, onDismiss]);

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl bg-gray-900 py-1 pl-4 pr-1 text-sm text-white shadow-lg dark:bg-gray-100 dark:text-gray-900 md:bottom-6"
    >
      <span>{message}</span>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="h-11 shrink-0 rounded-lg px-3 font-semibold text-blue-300 hover:bg-white/10 dark:text-blue-700 dark:hover:bg-black/5"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
