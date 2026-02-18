import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { useTodo } from '../../hooks/useProjects';

interface TodosTabProps {
  projectPath: string | null;
}

export function TodosTab({ projectPath }: TodosTabProps) {
  const { data, isLoading } = useTodo(projectPath);

  if (isLoading) {
    return <div className="loading">Loading TODOs...</div>;
  }

  if (!data?.found) {
    return (
      <div className="empty-state">
        <p>No TODO.md found in this project</p>
        <p className="hint">Add a TODO.md to track tasks and progress</p>
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
