import { useEffect, useRef, type ReactNode } from 'react';

/**
 * 모바일은 아래에서 올라오는 시트, 768px 이상은 가운데 창.
 * 열리면 창에 초점을 두고, Esc·바깥 누르기로 닫고, 뒤 화면 스크롤을 막아요.
 * 닫은 뒤 초점은 연 쪽에서 돌려놔요.
 */
export function Modal({
  labelledBy,
  onClose,
  children,
}: {
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

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
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className="max-h-[88dvh] w-full overflow-y-auto rounded-t-2xl bg-white px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 focus:outline-none dark:bg-gray-900 md:max-w-lg md:rounded-2xl"
      >
        {children}
      </div>
    </div>
  );
}
