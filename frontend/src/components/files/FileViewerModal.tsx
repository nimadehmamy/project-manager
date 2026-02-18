import { useState, useEffect, useRef } from 'react';
import { X, Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
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
};

// File type categories
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'];
const PDF_EXTS = ['pdf'];
const CSV_EXTS = ['csv', 'tsv'];

export function FileViewerModal({ path, onClose }: FileViewerModalProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'pdf' | 'csv' | 'code' | 'text' | 'markdown' | 'binary'>('text');
  const [language, setLanguage] = useState<string>('');
  const codeRef = useRef<HTMLPreElement>(null);
  
  // Image zoom state
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const imageContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!path) {
      // Reset state when closed
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      return;
    }

    const ext = path.split('.').pop()?.toLowerCase() || '';
    
    // Detect file type
    if (IMAGE_EXTS.includes(ext)) {
      setFileType('image');
      setLoading(false);
      return;
    } else if (PDF_EXTS.includes(ext)) {
      setFileType('pdf');
      setLoading(false);
      return;
    } else if (CSV_EXTS.includes(ext)) {
      setFileType('csv');
    } else if (ext === 'md' || ext === 'markdown') {
      setFileType('markdown');
    } else if (LANGUAGE_MAP[ext]) {
      setFileType('code');
      setLanguage(LANGUAGE_MAP[ext]);
    } else if (['txt', 'log', 'ini', 'conf', 'cfg'].includes(ext)) {
      setFileType('text');
    } else {
      setFileType('binary');
      setLoading(false);
      return;
    }

    // Load text content
    const loadFile = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const data = await api.getFile(path, false);
        setContent(data);
      } catch (err) {
        setError('Failed to load file');
      } finally {
        setLoading(false);
      }
    };

    loadFile();
  }, [path]);

  // Apply syntax highlighting
  useEffect(() => {
    if (fileType === 'code' && codeRef.current && language) {
      codeRef.current.className = `language-${language}`;
      Prism.highlightElement(codeRef.current);
    }
  }, [content, fileType, language]);

  if (!path) return null;

  const fileName = path.split('/').pop() || '';
  const fileUrl = `/api/file?path=${encodeURIComponent(path)}`;

  const handleDownload = () => {
    window.open(`${fileUrl}&download=true`, '_blank');
  };

  // Image pan handlers
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

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => setZoom(z => Math.min(z * 1.2, 5));
  const handleZoomOut = () => setZoom(z => Math.max(z / 1.2, 0.5));
  const handleReset = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  // Parse CSV
  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n');
    return lines.map(line => {
      // Simple CSV parsing (handles quoted fields)
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    });
  };

  const renderContent = () => {
    if (loading) return <div className="loading">Loading...</div>;
    if (error) return <div className="error">{error}</div>;

    switch (fileType) {
      case 'image':
        return (
          <div 
            ref={imageContainerRef}
            className="image-viewer-container"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
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

      case 'pdf':
        return (
          <div className="pdf-viewer">
            <iframe
              src={fileUrl}
              width="100%"
              height="100%"
              style={{ border: 'none', minHeight: '70vh' }}
              title={fileName}
            />
          </div>
        );

      case 'csv': {
        const rows = parseCSV(content);
        if (rows.length === 0) return <pre className="text-view"><code>{content}</code></pre>;
        
        return (
          <div className="csv-viewer">
            <table className="csv-table">
              <thead>
                <tr>
                  {rows[0].map((cell, i) => (
                    <th key={i}>{cell}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(1).map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      case 'markdown':
        return (
          <div className="markdown-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
        );

      case 'code':
        return (
          <div className="code-container">
            <pre className="line-numbers">
              <code ref={codeRef} className={`language-${language}`}>
                {content}
              </code>
            </pre>
          </div>
        );

      case 'binary':
        return (
          <div className="binary-viewer">
            <p>This file cannot be previewed.</p>
            <button className="btn btn-primary" onClick={handleDownload}>
              <Download size={16} />
              Download File
            </button>
          </div>
        );

      default:
        return <pre className="text-view"><code>{content}</code></pre>;
    }
  };

  const showImageControls = fileType === 'image';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-content file-viewer ${fileType === 'image' || fileType === 'pdf' ? 'wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{fileName}</h3>
          <div className="modal-actions">
            {showImageControls && (
              <>
                <button className="btn btn-icon" onClick={handleZoomOut} title="Zoom Out">
                  <ZoomOut size={18} />
                </button>
                <span className="zoom-level">{Math.round(zoom * 100)}%</span>
                <button className="btn btn-icon" onClick={handleZoomIn} title="Zoom In">
                  <ZoomIn size={18} />
                </button>
                <button className="btn btn-icon" onClick={handleReset} title="Reset">
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
      </div>
    </div>
  );
}
