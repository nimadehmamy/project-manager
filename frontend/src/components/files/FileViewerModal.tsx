import { useState, useEffect, useRef } from 'react';
import { X, Download, ZoomIn, ZoomOut, RotateCcw, FileText } from 'lucide-react';
import { api } from '../../api/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-scss';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-shell-session';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-latex';
import 'prismjs/themes/prism-tomorrow.css';

interface FileViewerModalProps {
  path: string | null;
  onClose: () => void;
}

const LANGUAGE_MAP: Record<string, string> = {
  'py': 'python', 'js': 'javascript', 'ts': 'typescript', 'jsx': 'jsx', 'tsx': 'tsx',
  'css': 'css', 'scss': 'scss', 'sass': 'scss', 'less': 'css',
  'json': 'json', 'yaml': 'yaml', 'yml': 'yaml',
  'md': 'markdown', 'sh': 'bash', 'bash': 'bash', 'zsh': 'bash',
  'rs': 'rust', 'go': 'go', 'java': 'java', 'c': 'c', 'cpp': 'cpp',
  'h': 'c', 'hpp': 'cpp', 'cs': 'csharp', 'php': 'php', 'rb': 'ruby',
  'swift': 'swift', 'kt': 'kotlin', 'sql': 'sql', 'dockerfile': 'docker',
  'tex': 'latex', 'sty': 'latex', 'cls': 'latex', 'bib': 'bibtex',
};

// Extensions that should be treated as binary (cannot be viewed as text)
const BINARY_EXTS = [
  'exe', 'dll', 'so', 'dylib', 'bin', 'dat',
  'zip', 'tar', 'gz', 'bz2', '7z', 'rar',
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico',
  'mp3', 'mp4', 'avi', 'mov', 'wav', 'flac',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'o', 'a', 'lib', 'class', 'jar', 'war', 'pyc', 'pyo',
  'db', 'sqlite', 'sqlite3',
];

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'];

export function FileViewerModal({ path, onClose }: FileViewerModalProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'code' | 'text' | 'markdown' | 'binary'>('text');
  const [language, setLanguage] = useState<string>('');
  const codeRef = useRef<HTMLPreElement>(null);
  
  // Image zoom/pan state
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Reset state when path changes
  useEffect(() => {
    if (!path) {
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      return;
    }

    const ext = path.split('.').pop()?.toLowerCase() || '';
    
    // Reset state
    setContent('');
    setError(null);
    
    if (IMAGE_EXTS.includes(ext)) {
      setFileType('image');
      setLoading(false);
    } else if (BINARY_EXTS.includes(ext)) {
      setFileType('binary');
      setLoading(false);
    } else {
      // Try to load as text for all other files
      loadTextFile(path, ext);
    }
  }, [path]);

  const loadTextFile = async (filePath: string, ext: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getFile(filePath, false);
      setContent(data);
      
      // Determine file type from extension
      if (ext === 'md' || ext === 'markdown') {
        setFileType('markdown');
      } else if (LANGUAGE_MAP[ext]) {
        setFileType('code');
        setLanguage(LANGUAGE_MAP[ext]);
      } else {
        setFileType('text');
        setLanguage('');
      }
    } catch (err) {
      setError('Failed to load file');
      setFileType('binary');
    } finally {
      setLoading(false);
    }
  };

  // Apply syntax highlighting
  useEffect(() => {
    if ((fileType === 'code' || fileType === 'text') && codeRef.current && content) {
      if (language) {
        codeRef.current.className = `language-${language}`;
      } else {
        codeRef.current.className = '';
      }
      Prism.highlightElement(codeRef.current);
    }
  }, [content, fileType, language]);

  if (!path) return null;

  const fileName = path.split('/').pop() || '';
  const fileUrl = `/api/file?path=${encodeURIComponent(path)}`;

  const handleDownload = () => {
    window.open(`${fileUrl}&download=true`, '_blank');
  };

  // Image handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPosition({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  // Touch handlers for pinch zoom
  const getDistance = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = getDistance(e.touches);
      (e.target as Element).setAttribute('data-pinch-start', dist.toString());
      (e.target as Element).setAttribute('data-zoom-start', zoom.toString());
    } else if (e.touches.length === 1 && zoom > 1) {
      setIsDragging(true);
      dragStart.current = { 
        x: e.touches[0].clientX - position.x, 
        y: e.touches[0].clientY - position.y 
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const startDist = parseFloat((e.target as Element).getAttribute('data-pinch-start') || '0');
      const startZoom = parseFloat((e.target as Element).getAttribute('data-zoom-start') || '1');
      if (startDist > 0) {
        const currentDist = getDistance(e.touches);
        const scale = currentDist / startDist;
        const newZoom = Math.min(Math.max(startZoom * scale, 0.5), 5);
        setZoom(newZoom);
      }
    } else if (e.touches.length === 1 && isDragging && zoom > 1) {
      setPosition({
        x: e.touches[0].clientX - dragStart.current.x,
        y: e.touches[0].clientY - dragStart.current.y,
      });
    }
  };

  const handleTouchEnd = () => setIsDragging(false);

  const handleZoomIn = () => setZoom(z => Math.min(z * 1.2, 5));
  const handleZoomOut = () => setZoom(z => Math.max(z / 1.2, 0.5));
  const handleReset = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const renderContent = () => {
    if (loading) return <div className="loading">Loading...</div>;
    if (error) return <div className="error">{error}</div>;

    switch (fileType) {
      case 'image':
        return (
          <div 
            className="image-viewer-container"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
          >
            <img 
              src={fileUrl}
              alt={fileName}
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                transition: isDragging ? 'none' : 'transform 0.1s',
                maxWidth: '100%',
                maxHeight: '70vh',
              }}
              draggable={false}
            />
          </div>
        );

      case 'markdown':
        return (
          <div className="markdown-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        );

      case 'code':
        return (
          <div className="code-container">
            <pre className="line-numbers">
              <code ref={codeRef} className={language ? `language-${language}` : ''}>{content}</code>
            </pre>
          </div>
        );

      case 'text':
        return (
          <div className="code-container">
            <pre className="text-view">
              <code ref={codeRef}>{content}</code>
            </pre>
          </div>
        );

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

      default:
        return <div className="loading">Loading...</div>;
    }
  };

  const showImageControls = fileType === 'image';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-content file-viewer ${fileType === 'image' ? 'wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{fileName}</h3>
          <div className="modal-actions">
            {showImageControls && (
              <>
                <button className="btn btn-icon" onClick={handleZoomOut}>
                  <ZoomOut size={18} />
                </button>
                <span className="zoom-level">{Math.round(zoom * 100)}%</span>
                <button className="btn btn-icon" onClick={handleZoomIn}>
                  <ZoomIn size={18} />
                </button>
                <button className="btn btn-icon" onClick={handleReset}>
                  <RotateCcw size={18} />
                </button>
              </>
            )}
            <button className="btn btn-icon" onClick={handleDownload} title="Download">
              <Download size={18} />
            </button>
            <button className="btn btn-icon" onClick={onClose} title="Close">
              <X size={18} />
            </button>
          </div>
        </div>
        
        <div className="modal-body file-content">
          {renderContent()}
        </div>
        
        {showImageControls && (
          <div className="modal-footer">
            <small className="hint">💡 Pinch to zoom on touch devices</small>
          </div>
        )}
      </div>
    </div>
  );
}
