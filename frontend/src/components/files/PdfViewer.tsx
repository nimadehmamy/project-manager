import { useState, useCallback, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ZoomIn, ZoomOut } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  url: string;
}

export function PdfViewer({ url }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState(1.2);
  const [error, setError] = useState<string | null>(null);
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const pagesRef = useRef<HTMLDivElement>(null);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setError(null);
  }, []);

  const onDocumentLoadError = useCallback(() => {
    setError('Failed to load PDF');
  }, []);

  // Pinch-to-zoom via Ctrl+wheel
  useEffect(() => {
    const el = pagesRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = -e.deltaY * 0.01;
      const next = Math.min(5, Math.max(0.3, scaleRef.current + delta));
      setScale(next);
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  if (error) {
    return (
      <div className="pdf-error">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="pdf-viewer">
      <div className="pdf-controls">
        <button
          className="btn btn-sm"
          onClick={() => setScale(s => Math.max(0.3, s - 0.2))}
        >
          <ZoomOut size={16} />
        </button>
        <span>{Math.round(scale * 100)}%</span>
        <button
          className="btn btn-sm"
          onClick={() => setScale(s => Math.min(5, s + 0.2))}
        >
          <ZoomIn size={16} />
        </button>
        {numPages > 0 && (
          <span className="pdf-page-count">{numPages} pages</span>
        )}
      </div>

      <div className="pdf-pages" ref={pagesRef}>
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={<div className="loading">Loading PDF...</div>}
        >
          {Array.from({ length: numPages }, (_, i) => (
            <Page key={i + 1} pageNumber={i + 1} scale={scale} />
          ))}
        </Document>
      </div>
    </div>
  );
}
