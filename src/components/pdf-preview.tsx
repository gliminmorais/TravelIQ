'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PDFDocumentLoadingTask, RenderTask } from 'pdfjs-dist';

export function PdfPreview({ file }: { file: File }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [page, setPage] = useState(1),
    [pages, setPages] = useState(1),
    [busy, setBusy] = useState(true),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true,
      task: PDFDocumentLoadingTask | undefined,
      render: RenderTask | undefined;
    setBusy(true);
    setError('');
    const timeout = setTimeout(() => {
      if (active) {
        setError('Preview took too long. Check the original file on your device.');
        setBusy(false);
      }
      void task?.destroy();
    }, 20000);
    async function draw() {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        const data = new Uint8Array(await file.arrayBuffer());
        if (!active) return;
        task = pdfjs.getDocument({ data, useSystemFonts: true, stopAtErrors: true });
        const pdf = await task.promise;
        if (!active) return;
        if (pdf.numPages > 20) throw Error('Limit documents to 20 pages');
        setPages(pdf.numPages);
        const pdfPage = await pdf.getPage(Math.min(page, pdf.numPages));
        if (!active || !canvas.current) return;
        const base = pdfPage.getViewport({ scale: 1 });
        const scale = Math.min(1.5, 1400 / base.width, 1800 / base.height);
        const viewport = pdfPage.getViewport({ scale });
        canvas.current.width = Math.ceil(viewport.width);
        canvas.current.height = Math.ceil(viewport.height);
        render = pdfPage.render({ canvas: canvas.current, viewport });
        await render.promise;
        if (active) setBusy(false);
      } catch {
        if (active) {
          setError('This page could not be previewed. Check the original file on your device.');
          setBusy(false);
        }
      } finally {
        clearTimeout(timeout);
      }
    }
    void draw();
    return () => {
      active = false;
      clearTimeout(timeout);
      render?.cancel();
      void task?.destroy();
    };
  }, [file, page]);
  return (
    <div className="pdf-canvas-preview">
      <div className="pdf-page-controls">
        <button
          type="button"
          aria-label="Previous PDF page"
          disabled={busy || page <= 1}
          onClick={() => setPage(page - 1)}
        >
          <ChevronLeft size={15} />
        </button>
        <span>
          Page {page} of {pages}
        </span>
        <button
          type="button"
          aria-label="Next PDF page"
          disabled={busy || page >= pages}
          onClick={() => setPage(page + 1)}
        >
          <ChevronRight size={15} />
        </button>
      </div>
      {busy && <p role="status">Rendering original ticket…</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <canvas
        ref={canvas}
        role="img"
        aria-label={`Original ticket PDF page ${page}`}
        data-rendered={!busy && !error ? 'true' : 'false'}
        style={{ display: error ? 'none' : 'block' }}
      />
    </div>
  );
}
