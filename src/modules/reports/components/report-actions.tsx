'use client';

import {FileDown, LoaderCircle, Printer} from 'lucide-react';
import {useState} from 'react';

const SCALE = 2;
const MARGIN_MM = 8;

// Captures the hidden report sheet and lays it out on A4 pages, never cutting a table row in half
// and repeating the table header at the top of every following page.
async function buildPdf(sheet: HTMLElement, fileName: string) {
  const [{toCanvas}, {jsPDF}] = await Promise.all([import('html-to-image'), import('jspdf')]);
  await document.fonts.ready;
  const landscape = sheet.classList.contains('is-landscape');
  const options = {pixelRatio: SCALE, backgroundColor: '#ffffff', style: {transform: 'none', position: 'static', margin: '0'}};
  // The company footer is repeated on every page, so it is captured on its own and left out of the body.
  const footer = sheet.querySelector<HTMLElement>('.rpt-foot');
  const footerCanvas = footer ? await toCanvas(footer, {...options, style: {}}) : null;
  const footerRect = footer?.getBoundingClientRect();
  const slot = footer?.querySelector('.rpt-foot-page')?.getBoundingClientRect();
  const pageLabel = footer?.dataset.pageLabel ?? '';
  if (footer) footer.style.display = 'none';
  let canvas: HTMLCanvasElement;
  try {
    canvas = await toCanvas(sheet, options);
  } finally {
    if (footer) footer.style.display = '';
  }

  const pdf = new jsPDF({orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4'});
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN_MM * 2;
  const pxPerMm = canvas.width / contentWidth;
  const footerMm = footerCanvas ? footerCanvas.height / pxPerMm : 6;
  const pageCapacity = Math.floor((pageHeight - MARGIN_MM * 2 - footerMm - 2) * pxPerMm);

  const origin = sheet.getBoundingClientRect().top;
  const toCanvasY = (value: number) => Math.round((value - origin) * SCALE);
  const head = sheet.querySelector('thead')?.getBoundingClientRect();
  const headTop = head ? toCanvasY(head.top) : 0;
  const headHeight = head ? toCanvasY(head.bottom) - headTop : 0;
  const breaks = [...sheet.querySelectorAll('tr, .rpt-summary, .rpt-print-heading')]
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
    if (footerCanvas) {
      const footerTop = pageHeight - MARGIN_MM - footerMm;
      pdf.addImage(footerCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', MARGIN_MM, footerTop, contentWidth, footerMm);
      if (slot && footerRect) {
        pdf.setFontSize(8);
        pdf.setTextColor(94, 111, 112);
        const x = MARGIN_MM + ((slot.right - footerRect.left) * SCALE) / pxPerMm;
        const y = footerTop + ((slot.top - footerRect.top) * SCALE) / pxPerMm + 3.5;
        pdf.text(`${pageLabel} ${index + 1} / ${slices.length}`.trim(), x, y, {align: 'right'});
      }
    }
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
