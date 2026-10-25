'use client';

import {X} from 'lucide-react';
import {useEffect, useRef, useState, type ReactNode} from 'react';

// How long the "saved" message stays visible before the dialog closes itself.
const AUTO_CLOSE_MS = 1100;

export function ActionDialog({title, trigger, children, triggerClass = 'secondary-action'}: {
  title: string;
  trigger: ReactNode;
  children: ReactNode;
  triggerClass?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // Bumped on every close so the form inside starts empty the next time the dialog opens.
  const [round, setRound] = useState(0);

  // Any form inside that reports success closes the dialog by itself, so nobody repeats the operation.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new MutationObserver(() => {
      if (!dialog.open || timer || !dialog.querySelector('.form-success')) return;
      timer = setTimeout(() => {
        timer = undefined;
        dialog.close();
      }, AUTO_CLOSE_MS);
    });
    observer.observe(dialog, {childList: true, subtree: true});
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, []);

  return (
    <>
      <button type="button" className={triggerClass} onClick={() => ref.current?.showModal()}>{trigger}</button>
      <dialog ref={ref} className="action-dialog" onClose={() => setRound((value) => value + 1)} onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}>
        <div className="action-dialog-card">
          <header><h2>{title}</h2><button type="button" className="icon-action" aria-label="Close" onClick={() => ref.current?.close()}><X size={20} /></button></header>
          <div key={round}>{children}</div>
        </div>
      </dialog>
    </>
  );
}
