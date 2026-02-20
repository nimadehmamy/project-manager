import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Download, FileText, ZoomIn, ZoomOut } from 'lucide-react';
import { api } from '../../api/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeViewer } from './CodeViewer';
import { PdfViewer } from './PdfViewer';

interface FileViewerPanelProps {
  path: string | null;
  onClose: () => void;
}

const CODE_EXTS = new Set([
  'py', 'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
  'css', 'scss', 'less', 'sass',
  'json', 'yaml', 'yml', 'toml',
  'sh', 'bash', 'zsh', 'fish',
  'rs', 'go', 'java', 'c', 'cpp', 'cc', 'cxx', 'h', 'hpp',
  'cs', 'php', 'rb', 'swift', 'kt', 'scala',
  'sql', 'dockerfile', 'makefile',
  'tex', 'sty', 'cls', 'bib',
  'html', 'htm', 'xml', 'svg',
  'lua', 'r', 'jl', 'zig', 'nim', 'dart', 'ex', 'exs',
  'vue', 'svelte',
]);

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp']);

const BINARY_EXTS = new Set([
  'exe', 'dll', 'so', 'dylib', 'bin', 'dat',
  'zip', 'tar', 'gz', 'bz2', '7z', 'rar',
  'mp3', 'mp4', 'avi', 'mov', 'wav', 'flac',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'o', 'a', 'lib', 'class', 'jar', 'war', 'pyc', 'pyo',
  'db', 'sqlite', 'sqlite3',
]);

type FileType = 'code' | 'markdown' | 'image' | 'pdf' | 'text' | 'binary';

function detectFileType(filename: string): FileType {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const base = filename.toLowerCase();

  if (ext === 'pdf') return 'pdf';
  if (ext === 'md' || ext === 'markdown') return 'markdown';
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (BINARY_EXTS.has(ext)) return 'binary';
  if (CODE_EXTS.has(ext)) return 'code';

  if (['makefile', 'dockerfile', 'rakefile', 'gemfile', 'procfile', '.gitignore', '.env'].includes(base)) {
    return 'code';
  }

  return 'text';
}

/** Image viewer with pinch-to-zoom and drag-to-pan */
function ImageViewer({ url, alt }: { url: string; alt: string }) {
  const [zoom, setZoom] = useState(1);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  // Drag-to-pan state
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const clampZoom = (z: number) => Math.min(10, Math.max(0.1, z));

  // Pinch-to-zoom (trackpad) and Ctrl+scroll
  const handleWheel = useCallback((e: WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = -e.deltaY * 0.01;
    setZoom(z => clampZoom(z + delta));
  }, []);

  // Attach wheel listener with passive:false
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Drag-to-pan handlers
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const el = containerRef.current;
    if (!el) return;
    dragging.current = true;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
    };
    el.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const el = containerRef.current;
    if (!el) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    el.scrollLeft = dragStart.current.scrollLeft - dx;
    el.scrollTop = dragStart.current.scrollTop - dy;
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
  }, []);

  // Compute displayed size: at zoom=1, fit within container
  // At other zoom levels, scale from the natural size
  const imgStyle: React.CSSProperties = naturalSize.w > 0
    ? { width: naturalSize.w * zoom, height: naturalSize.h * zoom }
    : { maxWidth: '100%', maxHeight: '100%' };

  return (
    <div className="image-viewer-wrapper">
      <div className="image-zoom-controls">
        <button className="btn btn-sm" onClick={() => setZoom(z => clampZoom(z - 0.2))}>
          <ZoomOut size={16} />
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button className="btn btn-sm" onClick={() => setZoom(z => clampZoom(z + 0.2))}>
          <ZoomIn size={16} />
        </button>
        {zoom !== 1 && (
          <button className="btn btn-sm" onClick={() => setZoom(1)}>Reset</button>
        )}
      </div>
      <div
        ref={containerRef}
        className="image-viewer-container"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          src={url}
          alt={alt}
          style={imgStyle}
          draggable={false}
          onLoad={onImageLoad}
        />
      </div>
    </div>
  );
}

export function FileViewerPanel({ path, onClose }: FileViewerPanelProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileType = path ? detectFileType(path.split('/').pop() || '') : 'text';
  const fileName = path?.split('/').pop() || '';
  const fileUrl = path ? `/api/file?path=${encodeURIComponent(path)}` : '';

  useEffect(() => {
    if (!path) return;

    setContent('');
    setError(null);

    if (fileType === 'image' || fileType === 'pdf' || fileType === 'binary') {
      setLoading(false);
      return;
    }

    setLoading(true);
    api.getFile(path, false)
      .then(data => {
        setContent(data);
      })
      .catch(() => {
        setError('Failed to load file');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [path, fileType]);

  if (!path) {
    return (
      <div className="file-viewer-panel empty-viewer">
        <div className="empty-state">
          <FileText size={48} style={{ opacity: 0.3 }} />
          <p>Select a file to view</p>
        </div>
      </div>
    );
  }

  const handleDownload = () => {
    window.open(`${fileUrl}&download=true`, '_blank');
  };

  const pathParts = path.split('/').filter(Boolean);

  const renderContent = () => {
    if (loading) return <div className="loading">Loading...</div>;
    if (error) return <div className="error">{error}</div>;

    switch (fileType) {
      case 'code':
      case 'text':
        return <CodeViewer content={content} filename={fileName} />;

      case 'markdown':
        return (
          <div className="markdown-content" style={{ padding: '24px' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        );

      case 'image':
        return <ImageViewer url={fileUrl} alt={fileName} />;

      case 'pdf':
        return <PdfViewer url={fileUrl} />;

      case 'binary':
        return (
          <div className="binary-viewer">
            <FileText size={48} style={{ opacity: 0.5, marginBottom: '1rem' }} />
            <p>This file cannot be previewed.</p>
            <button className="btn btn-primary" onClick={handleDownload}>
              <Download size={16} />
              Download File
            </button>
          </div>
        );
    }
  };

  return (
    <div className="file-viewer-panel">
      <div className="viewer-header">
        <div className="viewer-breadcrumb">
          {pathParts.map((part, i) => (
            <span key={i}>
              {i > 0 && <span className="breadcrumb-sep">/</span>}
              <span className={i === pathParts.length - 1 ? 'breadcrumb-current' : 'breadcrumb-part'}>
                {part}
              </span>
            </span>
          ))}
        </div>
        <div className="viewer-actions">
          <button className="btn-icon" onClick={handleDownload} title="Download">
            <Download size={18} />
          </button>
          <button className="btn-icon" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>
      </div>
      <div className="viewer-body">
        {renderContent()}
      </div>
    </div>
  );
}
