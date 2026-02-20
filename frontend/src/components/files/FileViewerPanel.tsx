import { useState, useEffect, useRef } from 'react';
import { X, Download, FileText, ZoomIn, ZoomOut } from 'lucide-react';
import { api } from '../../api/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeViewer } from './CodeViewer';
import { PdfViewer } from './PdfViewer';
import { usePinchZoom } from '../../hooks/usePinchZoom';

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

  // Known text filenames without extensions
  if (['makefile', 'dockerfile', 'rakefile', 'gemfile', 'procfile', '.gitignore', '.env'].includes(base)) {
    return 'code';
  }

  // Default to text (will try to load)
  return 'text';
}

export function FileViewerPanel({ path, onClose }: FileViewerPanelProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageZoom, setImageZoom] = useState(1);
  const imageZoomRef = useRef(1);
  imageZoomRef.current = imageZoom;

  const imageContainerRef = usePinchZoom<HTMLDivElement>({
    min: 0.2,
    max: 10,
    getScale: () => imageZoomRef.current,
    onZoom: setImageZoom,
  });

  const fileType = path ? detectFileType(path.split('/').pop() || '') : 'text';
  const fileName = path?.split('/').pop() || '';
  const fileUrl = path ? `/api/file?path=${encodeURIComponent(path)}` : '';

  useEffect(() => {
    if (!path) return;

    // Reset
    setContent('');
    setError(null);
    setImageZoom(1);

    // Types that don't need text loading
    if (fileType === 'image' || fileType === 'pdf' || fileType === 'binary') {
      setLoading(false);
      return;
    }

    // Load text content
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

  // Build breadcrumb from path
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
        return (
          <div className="image-viewer-wrapper">
            <div className="image-zoom-controls">
              <button className="btn btn-sm" onClick={() => setImageZoom(z => Math.max(0.2, z - 0.2))}>
                <ZoomOut size={16} />
              </button>
              <span>{Math.round(imageZoom * 100)}%</span>
              <button className="btn btn-sm" onClick={() => setImageZoom(z => Math.min(10, z + 0.2))}>
                <ZoomIn size={16} />
              </button>
              {imageZoom !== 1 && (
                <button className="btn btn-sm" onClick={() => setImageZoom(1)}>Reset</button>
              )}
            </div>
            <div className="image-viewer-container" ref={imageContainerRef}>
              <img
                src={fileUrl}
                alt={fileName}
                style={{ transform: `scale(${imageZoom})`, transformOrigin: 'center center' }}
                draggable={false}
              />
            </div>
          </div>
        );

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
