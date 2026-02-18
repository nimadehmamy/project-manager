import type { TabType } from '../../types';

interface TabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const tabs: { id: TabType; label: string }[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'todos', label: 'Todos' },
  { id: 'progress', label: 'Progress' },
  { id: 'files', label: 'Files' },
  { id: 'graph', label: 'Graph' },
  { id: 'chat', label: 'Chat' },
];

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <div className="tab-bar">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
