import { useState, useCallback, useRef, useEffect, useLayoutEffect, memo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ZoomIn, ZoomOut } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  url: string;
}

// Memoized page component to prevent re-mounting during scale changes
interface MemoPageProps {
  pageNumber: number;
  scale: number;
}

const MemoPage = memo(function MemoPage({ pageNumber, scale }: MemoPageProps) {
  return <Page pageNumber={pageNumber} scale={scale} />;
});

export function PdfViewer({ url }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState(1.2);
  const [error, setError] = useState<string | null>(null);
  // committedScale = scale used by react-pdf (heavy re-render on change)
  // liveScale = visual scale during pinch (CSS transform, instant)
  const committedScaleRef = useRef(scale);
  committedScaleRef.current = scale;
  const liveScaleRef = useRef(scale);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pagesRef = useRef<HTMLDivElement>(null);
  const transformLayerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Auto-hide controls
  const [controlsVisible, setControlsVisible] = useState(true);
  const [controlsHovered, setControlsHovered] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!controlsHovered) setControlsVisible(false);
    }, 2000);
  }, [controlsHovered]);

  useEffect(() => {
    resetHideTimer();
    return () => clearTimeout(hideTimer.current);
  }, [resetHideTimer]);

  useEffect(() => {
    if (controlsHovered) {
      clearTimeout(hideTimer.current);
      setControlsVisible(true);
    } else {
      resetHideTimer();
    }
  }, [controlsHovered, resetHideTimer]);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setError(null);
  }, []);

  const onDocumentLoadError = useCallback(() => {
    setError('Failed to load PDF');
  }, []);

  // Pinch-to-zoom via Ctrl+wheel — instant CSS zoom, debounced commit
  useEffect(() => {
    const el = pagesRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = -e.deltaY * 0.01;
      const prev = liveScaleRef.current;
      const next = Math.min(5, Math.max(0.3, prev + delta));
      if (next === prev) return;
      liveScaleRef.current = next;

      // Anchor zoom under the cursor so the point under the mouse stays fixed.
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const ratio = next / prev;

      if (transformLayerRef.current) {
        const mul = next / committedScaleRef.current;
        // `zoom` reflows layout — scrollbars grow/shrink naturally
        (transformLayerRef.current.style as any).zoom = String(mul);
      }

      // Keep cursor position stable: (scroll + c) * ratio - c = new scroll
      el.scrollLeft = (el.scrollLeft + cx) * ratio - cx;
      el.scrollTop = (el.scrollTop + cy) * ratio - cy;

      // Debounce the heavy react-pdf re-render
      clearTimeout(commitTimer.current);
      commitTimer.current = setTimeout(() => {
        setScale(liveScaleRef.current);
      }, 180);
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => {
      el.removeEventListener('wheel', handler);
      clearTimeout(commitTimer.current);
    };
  }, []);

  // After committed scale re-renders react-pdf, clear the inline zoom
  useLayoutEffect(() => {
    liveScaleRef.current = scale;
    if (transformLayerRef.current) {
      (transformLayerRef.current.style as any).zoom = '';
    }
  }, [scale]);

  // Sync zoom-button clicks to live ref so wheel zoom continues from there
  const zoomBy = useCallback((delta: number) => {
    setScale(s => {
      const next = Math.min(5, Math.max(0.3, s + delta));
      liveScaleRef.current = next;
      return next;
    });
  }, []);

  if (error) {
    return (
      <div className="pdf-error">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="pdf-viewer" ref={wrapperRef} onMouseMove={resetHideTimer}>
      <div className="pdf-pages" ref={pagesRef}>
        <div ref={transformLayerRef} className="pdf-transform-layer">
          <Document
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={<div className="loading">Loading PDF...</div>}
          >
            {Array.from({ length: numPages }, (_, i) => (
              <MemoPage key={i + 1} pageNumber={i + 1} scale={scale} />
            ))}
          </Document>
        </div>
      </div>

      <div
        className={`pdf-controls-float ${controlsVisible ? 'visible' : ''}`}
        onMouseEnter={() => setControlsHovered(true)}
        onMouseLeave={() => setControlsHovered(false)}
      >
        <button
          className="btn btn-sm"
          onClick={() => zoomBy(-0.2)}
        >
          <ZoomOut size={14} />
        </button>
        <span>{Math.round(scale * 100)}%</span>
        <button
          className="btn btn-sm"
          onClick={() => zoomBy(0.2)}
        >
          <ZoomIn size={14} />
        </button>
        {numPages > 0 && (
          <span className="pdf-page-count">{numPages} pages</span>
        )}
      </div>
    </div>
  );
}
