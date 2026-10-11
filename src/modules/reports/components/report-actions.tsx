'use client';

import {FileDown, LoaderCircle, Printer} from 'lucide-react';
import {useState} from 'react';

const SCALE = 2;
const MARGIN_MM = 8;
const FOOTER_MM = 6;

// Captures the hidden report sheet and lays it out on A4 pages, never cutting a table row in half
// and repeating the table header at the top of every following page.
async function buildPdf(sheet: HTMLElement, fileName: string) {
  const [{toCanvas}, {jsPDF}] = await Promise.all([import('html-to-image'), import('jspdf')]);
  await document.fonts.ready;
  const landscape = sheet.classList.contains('is-landscape');
  const canvas = await toCanvas(sheet, {
    pixelRatio: SCALE,
    backgroundColor: '#ffffff',
    style: {transform: 'none', position: 'static', margin: '0'}
  });

  const pdf = new jsPDF({orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4'});
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN_MM * 2;
  const pxPerMm = canvas.width / contentWidth;
  const pageCapacity = Math.floor((pageHeight - MARGIN_MM * 2 - FOOTER_MM) * pxPerMm);

  const origin = sheet.getBoundingClientRect().top;
  const toCanvasY = (value: number) => Math.round((value - origin) * SCALE);
  const head = sheet.querySelector('thead')?.getBoundingClientRect();
  const headTop = head ? toCanvasY(head.top) : 0;
  const headHeight = head ? toCanvasY(head.bottom) - headTop : 0;
  const breaks = [...sheet.querySelectorAll('tr, .rpt-summary, .rpt-print-heading, .rpt-print-footer')]
    .map((element) => toCanvasY(element.getBoundingClientRect().bottom))
    .sort((left, right) => left - right);

  const slices: {start: number; end: number; repeatHead: boolean}[] = [];
  let start = 0;
  while (start < canvas.height) {
    const repeatHead = slices.length > 0 && head !== undefined && start > headTop + headHeight;
    const capacity = pageCapacity - (repeatHead ? headHeight : 0);
    const limit = start + capacity;
    const end = limit >= canvas.height ? canvas.height : breaks.filter((value) => value > start && value <= limit).pop() ?? limit;
    slices.push({start, end, repeatHead});
    start = end;
  }

  slices.forEach(({start: from, end, repeatHead}, index) => {
    const offset = repeatHead ? headHeight : 0;
    const page = document.createElement('canvas');
    page.width = canvas.width;
    page.height = end - from + offset;
    const context = page.getContext('2d')!;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, page.width, page.height);
    if (repeatHead) context.drawImage(canvas, 0, headTop, canvas.width, headHeight, 0, 0, canvas.width, headHeight);
    context.drawImage(canvas, 0, from, canvas.width, end - from, 0, offset, canvas.width, end - from);
    if (index > 0) pdf.addPage();
    pdf.addImage(page.toDataURL('image/jpeg', 0.92), 'JPEG', MARGIN_MM, MARGIN_MM, contentWidth, page.height / pxPerMm);
    pdf.setFontSize(8);
    pdf.setTextColor(94, 111, 112);
    pdf.text(`${index + 1} / ${slices.length}`, pageWidth / 2, pageHeight - MARGIN_MM / 2, {align: 'center'});
  });
  pdf.save(`${fileName}.pdf`);
}

export function ReportActions({fileName, labels}: {
  fileName: string;
  labels: {print: string; pdf: string; preparing: string; error: string};
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function download() {
    const sheet = document.getElementById('report-sheet');
    if (!sheet || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await buildPdf(sheet, fileName);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="report-exports no-print">
      <button type="button" className="report-export is-pdf" onClick={download} disabled={busy} aria-busy={busy}>
        {busy ? <LoaderCircle size={17} className="spin" aria-hidden="true" /> : <FileDown size={17} aria-hidden="true" />}
        {busy ? labels.preparing : labels.pdf}
      </button>
      <button type="button" className="report-export" onClick={() => window.print()}>
        <Printer size={17} aria-hidden="true" />{labels.print}
      </button>
      {failed ? <p className="form-error" role="alert">{labels.error}</p> : null}
    </div>
  );
}
