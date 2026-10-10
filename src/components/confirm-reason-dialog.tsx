'use client';
import type {ReactNode} from 'react';
export function ConfirmReasonDialog({summary, reasonLabel, children}: {summary: string; reasonLabel: string; children: ReactNode}) {return <details className="confirm-reason"><summary>{summary}</summary><label>{reasonLabel}<input name="reason" required /></label>{children}</details>;}
