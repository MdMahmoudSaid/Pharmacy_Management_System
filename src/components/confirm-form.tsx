'use client';

import {useTranslations} from 'next-intl';
import {useRef, type ComponentProps} from 'react';

type SubmitEvent = Parameters<NonNullable<ComponentProps<'form'>['onSubmit']>>[0];

type ConfirmFormProps = ComponentProps<'form'> & {
  message: string;
  enabled?: boolean;
};

export function ConfirmForm({message, enabled = true, onSubmit, children, ...props}: ConfirmFormProps) {
  const t = useTranslations('Common');
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const submitterRef = useRef<HTMLElement | null>(null);
  const confirmedRef = useRef(false);

  const handleSubmit = (event: SubmitEvent) => {
    if (enabled && !confirmedRef.current) {
      event.preventDefault();
      submitterRef.current = event.submitter;
      dialogRef.current?.showModal();
      return;
    }
    confirmedRef.current = false;
    onSubmit?.(event);
  };

  const accept = () => {
    dialogRef.current?.close();
    confirmedRef.current = true;
    // Tells a surrounding ActionDialog that this second submit is the real one.
    formRef.current?.setAttribute('data-confirmed', '');
    formRef.current?.requestSubmit(submitterRef.current ?? undefined);
  };

  return (
    <>
      <form ref={formRef} data-confirm-form onSubmit={handleSubmit} {...props}>{children}</form>
      <dialog ref={dialogRef} className="confirm-dialog" aria-labelledby="confirm-dialog-title">
        <h2 id="confirm-dialog-title">{t('confirmTitle')}</h2>
        <p>{message}</p>
        <div className="confirm-dialog-actions">
          <button type="button" className="secondary-action" onClick={() => dialogRef.current?.close()}>{t('cancel')}</button>
          <button type="button" className="primary-action" onClick={accept} autoFocus>{t('confirm')}</button>
        </div>
      </dialog>
    </>
  );
}
