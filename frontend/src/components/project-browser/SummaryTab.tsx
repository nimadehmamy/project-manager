import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { useReadme } from '../../hooks/useProjects';

interface SummaryTabProps {
  projectPath: string | null;
}

export function SummaryTab({ projectPath }: SummaryTabProps) {
  const { data, isLoading } = useReadme(projectPath);

  if (isLoading) {
    return <div className="loading">Loading README...</div>;
  }

  if (!data?.found) {
    return (
      <div className="empty-state">
        <p>No README.md found in this project</p>
        <p className="hint">Add a README.md to see project documentation</p>
      </div>
    );
  }

  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
      >
        {data.content}
      </ReactMarkdown>
    </div>
  );
}
