import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CollapseTagProps {
  collapsed: boolean;
  onToggle: () => void;
  side: 'left' | 'right';
}

export function CollapseTag({ collapsed, onToggle, side }: CollapseTagProps) {
  const showExpand = (side === 'left' && collapsed) || (side === 'right' && !collapsed);
  const Icon = showExpand ? ChevronRight : ChevronLeft;

  return (
    <button
      className={`collapse-tag collapse-tag-${side}`}
      onClick={onToggle}
      title={collapsed ? 'Expand panel' : 'Collapse panel'}
    >
      <Icon size={14} />
    </button>
  );
}
