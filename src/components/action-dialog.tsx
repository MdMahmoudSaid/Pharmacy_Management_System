'use client';

import {X} from 'lucide-react';
import {useEffect, useRef, useState, type ReactNode} from 'react';

const TOAST_MS = 4000;
// Gives up waiting for the result of a submit that never reports back.
const RESULT_TIMEOUT_MS = 20000;

type Toast = {kind: 'success' | 'error'; text: string};

// A dialog that closes the moment its form is submitted. The form stays mounted while it works,
// and its outcome (the form's own success or error message) comes back as a toast on the page.
export function ActionDialog({title, trigger, children, triggerClass = 'secondary-action'}: {
  title: string;
  trigger: ReactNode;
  children: ReactNode;
  triggerClass?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // Bumped after a success so the form starts empty the next time the dialog opens.
  const [round, setRound] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    let waiting = false;
    let sawPending = false;
    let giveUp: ReturnType<typeof setTimeout> | undefined;

    const finish = () => {
      const success = dialog.querySelector('.form-success');
      const failure = dialog.querySelector('.form-error');
      const found = success ?? failure;
      waiting = false;
      sawPending = false;
      clearTimeout(giveUp);
      if (!found?.textContent?.trim()) return;
      setToast({kind: success ? 'success' : 'error', text: found.textContent.trim()});
      if (success) setRound((value) => value + 1);
    };

    const onSubmit = (event: Event) => {
      const form = event.target as HTMLFormElement;
      // A form that first asks for confirmation only counts once it is confirmed.
      if (form.hasAttribute('data-confirm-form')) {
        if (!form.hasAttribute('data-confirmed')) return;
        form.removeAttribute('data-confirmed');
      }
      waiting = true;
      sawPending = false;
      clearTimeout(giveUp);
      giveUp = setTimeout(finish, RESULT_TIMEOUT_MS);
      setToast(null);
      dialog.close();
    };

    const observer = new MutationObserver(() => {
      if (!waiting) return;
      const pending = dialog.querySelector('button[disabled]') !== null;
      if (pending) sawPending = true;
      else if (sawPending) finish();
    });
    dialog.addEventListener('submit', onSubmit);
    observer.observe(dialog, {childList: true, subtree: true, attributes: true, attributeFilter: ['disabled']});
    return () => {
      dialog.removeEventListener('submit', onSubmit);
      observer.disconnect();
      clearTimeout(giveUp);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <>
      <button type="button" className={triggerClass} onClick={() => ref.current?.showModal()}>{trigger}</button>
      <dialog ref={ref} className="action-dialog" onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}>
        <div className="action-dialog-card">
          <header><h2>{title}</h2><button type="button" className="icon-action" aria-label="Close" onClick={() => ref.current?.close()}><X size={20} /></button></header>
          <div key={round}>{children}</div>
        </div>
      </dialog>
      {toast ? <div className={`action-toast is-${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}>{toast.text}</div> : null}
    </>
  );
}
