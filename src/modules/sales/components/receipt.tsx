'use client';

import {FileDown, LoaderCircle, Printer} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useRef, useState} from 'react';

import {BrandMark} from '@/components/brand-mark';
import {formatMru} from './medicine-search';

const TIME_ZONE = 'Africa/Nouakchott';
// Numeric dates read the same on an Arabic or French receipt.
const dayFormat = new Intl.DateTimeFormat('en-CA', {year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TIME_ZONE});
const timeFormat = new Intl.DateTimeFormat('en-GB', {hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TIME_ZONE});
const TICKET_WIDTH_MM = 80;

// Saves the receipt as a ticket-shaped PDF (80 mm wide, as long as the receipt).
async function saveReceiptPdf(paper: HTMLElement, fileName: string) {
  const [{toCanvas}, {jsPDF}] = await Promise.all([import('html-to-image'), import('jspdf')]);
  await document.fonts.ready;
  const canvas = await toCanvas(paper, {pixelRatio: 3, backgroundColor: '#ffffff', style: {boxShadow: 'none', border: '0', borderRadius: '0'}});
  const height = (canvas.height / canvas.width) * TICKET_WIDTH_MM;
  const pdf = new jsPDF({orientation: 'portrait', unit: 'mm', format: [TICKET_WIDTH_MM, height]});
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, TICKET_WIDTH_MM, height);
  pdf.save(`${fileName}.pdf`);
}

export function Receipt({
  pharmacyName,
  sale,
  operatorName,
  items
}: {
  pharmacyName: string;
  sale: {id: number; saleNumber: string; total: string; createdAt: Date; status: 'COMPLETED' | 'CANCELLED'};
  operatorName: string;
  items: Array<{id: number; medicineName: string; quantity: number; unitPrice: string; lineTotal: string}>;
}) {
  const t = useTranslations('Sales');
  const paper = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const units = items.reduce((sum, item) => sum + item.quantity, 0);
  const cancelled = sale.status === 'CANCELLED';

  async function savePdf() {
    if (!paper.current || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      await saveReceiptPdf(paper.current, t('receiptFileName', {number: sale.id}));
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="receipt" data-testid="receipt">
      <div ref={paper} className={`receipt-paper${cancelled ? ' is-cancelled' : ''}`}>
        <header className="receipt-head">
          <BrandMark className="receipt-logo" />
          <h2>{pharmacyName}</h2>
          <p>{t('receipt')}</p>
        </header>

        <dl className="receipt-meta">
          <div><dt>{t('receiptNumber')}</dt><dd><bdi dir="ltr">#{sale.id}</bdi></dd></div>
          <div><dt>{t('receiptDate')}</dt><dd><bdi dir="ltr">{dayFormat.format(sale.createdAt)}</bdi></dd></div>
          <div><dt>{t('receiptTime')}</dt><dd><bdi dir="ltr">{timeFormat.format(sale.createdAt)}</bdi></dd></div>
          <div><dt>{t('receiptSeller')}</dt><dd>{operatorName}</dd></div>
        </dl>

        <table className="receipt-lines">
          <thead>
            <tr>
              <th scope="col">{t('receiptItem')}</th>
              <th scope="col" className="is-numeric">{t('receiptQty')}</th>
              <th scope="col" className="is-numeric">{t('receiptUnitPrice')}</th>
              <th scope="col" className="is-numeric">{t('receiptAmount')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.medicineName}</td>
                {/* The cell keeps the page direction so it lines up with its header; only the number is isolated. */}
                <td className="is-numeric"><bdi dir="ltr">{item.quantity}</bdi></td>
                <td className="is-numeric"><bdi dir="ltr">{formatMru(item.unitPrice)}</bdi></td>
                <td className="is-numeric"><bdi dir="ltr">{formatMru(item.lineTotal)}</bdi></td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="receipt-count">
          <span>{t('receiptUnits')}</span>
          <bdi dir="ltr">{units}</bdi>
        </p>
        <footer className="receipt-total">
          <span>{t('receiptTotalDue')}</span>
          <strong><bdi dir="ltr">{formatMru(sale.total)} MRU</bdi></strong>
        </footer>

        {cancelled ? <b className="receipt-cancelled">{t('cancelled')}</b> : null}

        <div className="receipt-thanks">
          <p>{t('receiptThanks')}</p>
          <small>{t('receiptKeep')}</small>
          <small className="receipt-number" dir="ltr">{sale.saleNumber}</small>
        </div>
      </div>
      <div className="receipt-actions no-print">
        <button type="button" className="primary-action print-button" onClick={() => window.print()}>
          <Printer size={18} aria-hidden="true" /> {t('print')}
        </button>
        <button type="button" className="secondary-action receipt-pdf" onClick={savePdf} disabled={saving} aria-busy={saving}>
          {saving ? <LoaderCircle size={18} className="spin" aria-hidden="true" /> : <FileDown size={18} aria-hidden="true" />}
          {saving ? t('receiptSaving') : t('receiptSavePdf')}
        </button>
        {failed ? <p className="form-error" role="alert">{t('receiptPdfError')}</p> : null}
      </div>
    </section>
  );
}
