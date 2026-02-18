import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import type { TabType } from '../../types';

interface TabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const mainTabs: { id: TabType; label: string }[] = [
  { id: 'progress', label: 'Progress' },
  { id: 'summary', label: 'Summary' },
  { id: 'todos', label: 'Todos' },
  { id: 'files', label: 'Files' },
  { id: 'graph', label: 'Graph' },
  { id: 'chat', label: 'Chat' },
];

const rightTabs: { id: TabType; label: string }[] = [
  { id: 'profile', label: 'Profile' },
];

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="tab-bar">
      <div className="tab-group main-tabs">
        {mainTabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="tab-group right-tabs">
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>
        {rightTabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
