import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeViewer } from './CodeViewer';

interface NotebookViewerProps {
  content: string;
}

interface NotebookCell {
  cell_type: 'code' | 'markdown' | 'raw';
  source: string[] | string;
  outputs?: any[];
  execution_count?: number | null;
}

function getSource(source: string[] | string): string {
  return Array.isArray(source) ? source.join('') : source;
}

function getOutputText(outputs: any[]): string {
  const parts: string[] = [];
  for (const out of outputs) {
    if (out.text) {
      parts.push(Array.isArray(out.text) ? out.text.join('') : out.text);
    } else if (out.data) {
      if (out.data['text/plain']) {
        const txt = out.data['text/plain'];
        parts.push(Array.isArray(txt) ? txt.join('') : txt);
      }
    } else if (out.ename) {
      parts.push(`${out.ename}: ${out.evalue || ''}`);
    }
  }
  return parts.join('');
}

function getOutputImages(outputs: any[]): string[] {
  const images: string[] = [];
  for (const out of outputs) {
    if (out.data?.['image/png']) {
      images.push(`data:image/png;base64,${out.data['image/png']}`);
    } else if (out.data?.['image/jpeg']) {
      images.push(`data:image/jpeg;base64,${out.data['image/jpeg']}`);
    }
  }
  return images;
}

export function NotebookViewer({ content }: NotebookViewerProps) {
  const cells = useMemo(() => {
    try {
      const nb = JSON.parse(content);
      return (nb.cells || []) as NotebookCell[];
    } catch {
      return null;
    }
  }, [content]);

  if (!cells) {
    return <div className="notebook-error">Failed to parse notebook</div>;
  }

  return (
    <div className="notebook-viewer">
      {cells.map((cell, i) => {
        const source = getSource(cell.source);
        if (!source.trim() && (!cell.outputs || cell.outputs.length === 0)) return null;

        return (
          <div key={i} className={`notebook-cell notebook-cell-${cell.cell_type}`}>
            {cell.cell_type === 'code' && (
              <>
                <div className="notebook-cell-header">
                  <span className="notebook-exec-count">
                    [{cell.execution_count ?? ' '}]
                  </span>
                </div>
                <div className="notebook-code">
                  <CodeViewer content={source} filename="cell.py" darkMode />
                </div>
                {cell.outputs && cell.outputs.length > 0 && (
                  <div className="notebook-output">
                    {getOutputImages(cell.outputs).map((src, j) => (
                      <img key={j} src={src} alt="output" className="notebook-output-img" />
                    ))}
                    {getOutputText(cell.outputs) && (
                      <pre className="notebook-output-text">
                        {getOutputText(cell.outputs)}
                      </pre>
                    )}
                  </div>
                )}
              </>
            )}
            {cell.cell_type === 'markdown' && (
              <div className="notebook-markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
              </div>
            )}
            {cell.cell_type === 'raw' && (
              <pre className="notebook-raw">{source}</pre>
            )}
          </div>
        );
      })}
    </div>
  );
}
