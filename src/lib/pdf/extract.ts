import { parseTicket } from './parser';
export const MAX_PDF_BYTES = 4 * 1024 * 1024;
export async function extractPdf(file: File) {
  if (file.size > MAX_PDF_BYTES) throw Error('PDF must be 4 MB or smaller');
  if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf'))
    throw Error('Choose a PDF file');
  const data = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(data.slice(0, 5)) !== '%PDF-')
    throw Error('This file is not a valid PDF');
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  const task = pdfjs.getDocument({ data, stopAtErrors: true, useSystemFonts: true });
  const timeout = setTimeout(() => void task.destroy(), 20000);
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 20) throw Error('Limit documents to 20 pages');
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i),
        content = await page.getTextContent();
      let previousY: number | undefined;
      for (const item of content.items) {
        if (!('str' in item)) continue;
        const y = item.transform[5];
        if (previousY !== undefined && Math.abs(y - previousY) > 3) text += '\n';
        text += item.str + (item.hasEOL ? '\n' : ' ');
        previousY = y;
      }
      text += '\n';
      if (text.length > 200000) throw Error('PDF contains too much text');
    }
    return parseTicket(text);
  } finally {
    clearTimeout(timeout);
    await task.destroy();
  }
}
