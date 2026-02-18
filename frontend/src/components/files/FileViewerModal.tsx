import { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';
import { api } from '../../api/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

interface FileViewerModalProps {
  path: string | null;
  onClose: () => void;
}

export function FileViewerModal({ path, onClose }: FileViewerModalProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'markdown' | 'code' | 'text'>('text');

  useEffect(() => {
    if (!path) return;

    const loadFile = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const data = await api.getFile(path, false);
        setContent(data);
        
        // Detect file type
        const ext = path.split('.').pop()?.toLowerCase();
        if (ext === 'md' || ext === 'markdown') {
          setFileType('markdown');
        } else if (['py', 'js', 'ts', 'jsx', 'tsx', 'css', 'html', 'json', 'yaml', 'yml', 'sh', 'bash'].includes(ext || '')) {
          setFileType('code');
        } else {
          setFileType('text');
        }
      } catch (err) {
        setError('Failed to load file');
      } finally {
        setLoading(false);
      }
    };

    loadFile();
  }, [path]);

  if (!path) return null;

  const fileName = path.split('/').pop() || '';

  const handleDownload = () => {
    window.open(`/api/file?path=${encodeURIComponent(path)}&download=true`, '_blank');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content file-viewer" onClick={(e) => e.stopPropagation()}>
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
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                    {content}
                  </ReactMarkdown>
                </div>
              ) : fileType === 'code' ? (
                <pre className="code-view"><code>{content}</code></pre>
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
