import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, FileText, ZoomIn, ZoomOut, Edit3, Eye, Save, Loader2, ExternalLink } from 'lucide-react';
import { api } from '../../api/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import 'highlight.js/styles/github-dark.css';
import 'katex/dist/katex.min.css';
import { useTheme } from '../../contexts/ThemeContext';
import { CodeViewer } from './CodeViewer';
import { PdfViewer } from './PdfViewer';
import { CsvViewer } from './CsvViewer';
import { NotebookViewer } from './NotebookViewer';

interface FileViewerPanelProps {
  path: string | null;
  onClose: () => void;
  isActive?: boolean;
}

const CODE_EXTS = new Set([
  'py', 'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
  'css', 'scss', 'less', 'sass',
  'json', 'yaml', 'yml', 'toml',
  'sh', 'bash', 'zsh', 'fish',
  'rs', 'go', 'java', 'c', 'cpp', 'cc', 'cxx', 'h', 'hpp',
  'cs', 'php', 'rb', 'swift', 'kt', 'scala',
  'sql', 'dockerfile', 'makefile',
  'tex', 'sty', 'cls', 'bib', 'bst',
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

const EDITABLE_TYPES = new Set(['code', 'text', 'markdown', 'csv']);

type FileType = 'code' | 'markdown' | 'image' | 'pdf' | 'csv' | 'notebook' | 'text' | 'binary';

function detectFileType(filename: string): FileType {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const base = filename.toLowerCase();

  if (ext === 'pdf') return 'pdf';
  if (ext === 'md' || ext === 'markdown') return 'markdown';
  if (ext === 'csv' || ext === 'tsv') return 'csv';
  if (ext === 'ipynb') return 'notebook';
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (BINARY_EXTS.has(ext)) return 'binary';
  if (CODE_EXTS.has(ext)) return 'code';

  if (['makefile', 'dockerfile', 'rakefile', 'gemfile', 'procfile', '.gitignore', '.env'].includes(base)) {
    return 'code';
  }

  return 'text';
}

/** Image viewer with pinch-to-zoom, drag-to-pan, and floating controls */
function ImageViewer({ url, alt }: { url: string; alt: string }) {
  const [zoom, setZoom] = useState(1);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

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

  // Keep visible while hovered
  useEffect(() => {
    if (controlsHovered) {
      clearTimeout(hideTimer.current);
      setControlsVisible(true);
    } else {
      resetHideTimer();
    }
  }, [controlsHovered, resetHideTimer]);

  const clampZoom = (z: number) => Math.min(10, Math.max(0.1, z));

  const handleWheel = useCallback((e: WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = -e.deltaY * 0.01;
    setZoom(z => clampZoom(z + delta));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

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
    el.scrollLeft = dragStart.current.scrollLeft - (e.clientX - dragStart.current.x);
    el.scrollTop = dragStart.current.scrollTop - (e.clientY - dragStart.current.y);
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
  }, []);

  const imgStyle: React.CSSProperties = naturalSize.w > 0
    ? { width: naturalSize.w * zoom, height: naturalSize.h * zoom }
    : { maxWidth: '100%', maxHeight: '100%' };

  return (
    <div className="image-viewer-wrapper" onMouseMove={resetHideTimer}>
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
      <div
        className={`image-controls-float ${controlsVisible ? 'visible' : ''}`}
        onMouseEnter={() => setControlsHovered(true)}
        onMouseLeave={() => setControlsHovered(false)}
      >
        <button className="btn btn-sm" onClick={() => setZoom(z => clampZoom(z - 0.2))}>
          <ZoomOut size={14} />
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button className="btn btn-sm" onClick={() => setZoom(z => clampZoom(z + 0.2))}>
          <ZoomIn size={14} />
        </button>
        {zoom !== 1 && (
          <button className="btn btn-sm" onClick={() => setZoom(1)}>Reset</button>
        )}
      </div>
    </div>
  );
}

export function FileViewerPanel({ path, onClose, isActive }: FileViewerPanelProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [vsCodeToast, setVsCodeToast] = useState(false);

  // Portal target
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const el = document.getElementById('tabbar-center-slot');
    setPortalTarget(el);
  }, []);

  const fileType = path ? detectFileType(path.split('/').pop() || '') : 'text';
  const fileName = path?.split('/').pop() || '';
  const fileUrl = path ? `/api/file?path=${encodeURIComponent(path)}` : '';
  const isEditable = EDITABLE_TYPES.has(fileType);

  // Reset edit state when file path changes
  useEffect(() => {
    setIsEditing(false);
    setEditContent('');
    setIsDirty(false);
    setIsSaving(false);
    setSaveError(null);
  }, [path]);

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

  // Ctrl+S to save
  useEffect(() => {
    if (!isEditing) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, editContent, path]);

  const handleSave = async () => {
    if (!path || !isDirty || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await api.saveFile(path, editContent);
      setContent(editContent);
      setIsDirty(false);
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to save file';
      setSaveError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const enterEditMode = () => {
    setEditContent(content);
    setIsDirty(false);
    setSaveError(null);
    setIsEditing(true);
  };

  const exitEditMode = () => {
    if (isDirty && !window.confirm('You have unsaved changes. Discard them?')) {
      return;
    }
    setIsEditing(false);
    setEditContent('');
    setIsDirty(false);
    setSaveError(null);
  };

  const handleEditContentChange = (newContent: string) => {
    setEditContent(newContent);
    setIsDirty(newContent !== content);
  };

  const handleOpenVSCode = () => {
    const filePath = path || '';
    const url = `http://localhost:8888/?folder=/home/nima&goto=${encodeURIComponent(filePath)}`;
    window.open(url, '_blank');
    setVsCodeToast(true);
    setTimeout(() => setVsCodeToast(false), 3000);
  };

  const handleDownload = () => {
    window.open(`${fileUrl}&download=true`, '_blank');
  };

  // Breadcrumb + actions portalled into tab bar
  const renderPortalContent = () => {
    if (!path || !isActive) return null;

    return (
      <>
        <div className="viewer-breadcrumb-inline">
          <span dir="ltr">{path}</span>
          {isDirty && <span className="unsaved-dot" title="Unsaved changes" />}
        </div>
        <div className="viewer-actions-inline">
          {isEditable && !isEditing && (
            <button className="btn-icon btn-icon-sm" onClick={enterEditMode} title="Edit file">
              <Edit3 size={14} />
            </button>
          )}
          {isEditing && (
            <>
              <button
                className={`btn-icon btn-icon-sm btn-save ${isDirty ? 'dirty' : ''}`}
                onClick={handleSave}
                disabled={!isDirty || isSaving}
                title={isDirty ? 'Save (Ctrl+S)' : 'No changes to save'}
              >
                {isSaving ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
              </button>
              <button className="btn-icon btn-icon-sm" onClick={exitEditMode} title="Back to viewer">
                <Eye size={14} />
              </button>
            </>
          )}
          {isEditable && (
            <button className="btn-icon btn-icon-sm" onClick={handleOpenVSCode} title="Open in VS Code">
              <ExternalLink size={14} />
            </button>
          )}
          <button className="btn-icon btn-icon-sm" onClick={handleDownload} title="Download">
            <Download size={14} />
          </button>
          <button className="btn-icon btn-icon-sm" onClick={onClose} title="Close">
            <X size={14} />
          </button>
        </div>
      </>
    );
  };

  if (!path) {
    return (
      <div className="file-viewer-panel empty-viewer">
        {portalTarget && createPortal(renderPortalContent(), portalTarget)}
        <div className="empty-state">
          <FileText size={48} style={{ opacity: 0.3 }} />
          <p>Select a file to view</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    if (loading) return <div className="loading">Loading...</div>;
    if (error) return <div className="error">{error}</div>;

    // Edit mode: render raw text in CodeViewer for all editable types
    if (isEditing) {
      return (
        <CodeViewer
          content={editContent}
          filename={fileName}
          darkMode={isDark}
          readOnly={false}
          onContentChange={handleEditContentChange}
        />
      );
    }

    switch (fileType) {
      case 'code':
      case 'text':
        return <CodeViewer content={content} filename={fileName} darkMode={isDark} />;

      case 'markdown': {
        // Resolve relative image paths to the API
        const dirPath = path ? path.split('/').slice(0, -1).join('/') : '';
        return (
          <div className="markdown-content" style={{ padding: '24px' }}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeHighlight, rehypeKatex]}
              components={{
                img: ({ src, alt, ...props }) => {
                  let resolvedSrc = src || '';
                  if (resolvedSrc && !resolvedSrc.startsWith('http') && !resolvedSrc.startsWith('data:')) {
                    const imgPath = resolvedSrc.startsWith('/')
                      ? resolvedSrc
                      : `${dirPath}/${resolvedSrc}`;
                    resolvedSrc = `/api/file?path=${encodeURIComponent(imgPath)}`;
                  }
                  return <img src={resolvedSrc} alt={alt || ''} {...props} />;
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        );
      }

      case 'csv':
        return <CsvViewer content={content} />;

      case 'notebook':
        return <NotebookViewer content={content} />;

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
      {portalTarget && createPortal(renderPortalContent(), portalTarget)}
      {vsCodeToast && (
        <div className="vscode-toast-float">Opening VS Code...</div>
      )}
      {saveError && (
        <div className="save-error">
          Save failed: {saveError}
          <button className="btn-icon" onClick={() => setSaveError(null)} style={{ marginLeft: 'auto' }}>
            <X size={14} />
          </button>
        </div>
      )}
      <div className="viewer-body">
        {renderContent()}
      </div>
    </div>
  );
}
