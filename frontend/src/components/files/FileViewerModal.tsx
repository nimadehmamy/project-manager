import { useState, useEffect, useRef } from 'react';
import { X, Download } from 'lucide-react';
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
  'py': 'python',
  'js': 'javascript',
  'ts': 'typescript',
  'jsx': 'jsx',
  'tsx': 'tsx',
  'css': 'css',
  'scss': 'scss',
  'sass': 'scss',
  'less': 'css',
  'json': 'json',
  'yaml': 'yaml',
  'yml': 'yaml',
  'md': 'markdown',
  'sh': 'bash',
  'bash': 'bash',
  'zsh': 'bash',
  'rs': 'rust',
  'go': 'go',
  'java': 'java',
  'c': 'c',
  'cpp': 'cpp',
  'h': 'c',
  'hpp': 'cpp',
  'cs': 'csharp',
  'php': 'php',
  'rb': 'ruby',
  'swift': 'swift',
  'kt': 'kotlin',
  'sql': 'sql',
  'dockerfile': 'docker',
};

export function FileViewerModal({ path, onClose }: FileViewerModalProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'markdown' | 'code' | 'text'>('text');
  const [language, setLanguage] = useState<string>('');
  const codeRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (!path) return;

    const loadFile = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const data = await api.getFile(path, false);
        setContent(data);
        
        // Detect file type
        const ext = path.split('.').pop()?.toLowerCase() || '';
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
      } finally {
        setLoading(false);
      }
    };

    loadFile();
  }, [path]);

  // Apply syntax highlighting after content loads
  useEffect(() => {
    if (fileType === 'code' && codeRef.current && language) {
      codeRef.current.className = `language-${language}`;
      Prism.highlightElement(codeRef.current);
    }
  }, [content, fileType, language]);

  if (!path) return null;

  const fileName = path.split('/').pop() || '';

  const handleDownload = () => {
    window.open(`/api/file?path=${encodeURIComponent(path)}&download=true`, '_blank');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content file-viewer wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{fileName}</h3>
          <div className="modal-actions">
            <button className="btn btn-icon" onClick={handleDownload} title="Download">
              <Download size={18} />
            </button>
            <button className="btn btn-icon" onClick={onClose} title="Close">
              <X size={18} />
            </button>
          </div>
        </div>
        
        <div className="modal-body">
          {loading && <div className="loading">Loading...</div>}
          {error && <div className="error">{error}</div>}
          {!loading && !error && (
            <>
              {fileType === 'markdown' ? (
                <div className="markdown-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {content}
                  </ReactMarkdown>
                </div>
              ) : fileType === 'code' ? (
                <div className="code-container">
                  <pre className="line-numbers">
                    <code ref={codeRef} className={`language-${language}`}>
                      {content}
                    </code>
                  </pre>
                </div>
              ) : (
                <pre className="text-view"><code>{content}</code></pre>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
