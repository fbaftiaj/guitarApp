import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { IconButton } from './IconButton';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * Modal panel: a bottom sheet on phones, a centred dialog on large screens.
 * Built on <dialog> so focus trapping, Escape-to-close and the inert
 * background come from the browser.
 */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    // Clicks on the backdrop land on the <dialog> itself and close it; keyboard
    // users close it with Escape (native) or the close button.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="mt-auto mb-0 max-h-[88dvh] w-full max-w-full overflow-hidden rounded-t-card border border-border bg-surface p-0 text-fg shadow-elevated backdrop:bg-black/60 open:flex open:flex-col lg:m-auto lg:max-w-lg lg:rounded-card"
    >
      <header className="flex items-center gap-2 border-b border-border px-5 py-2">
        <h2 id={titleId} className="min-w-0 flex-1 truncate text-lg font-semibold">
          {title}
        </h2>
        <IconButton icon={X} label="Close" onClick={onClose} className="-mr-3" />
      </header>
      <div className="overflow-y-auto overscroll-contain px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </dialog>
  );
}
