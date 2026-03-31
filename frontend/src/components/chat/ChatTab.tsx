import { useState } from 'react';
import { ZellijTerminal } from '../zellij/ZellijTerminal';
import { Bot, Terminal, ChevronDown, Maximize2, Minimize2 } from 'lucide-react';

interface ChatTabProps {
  projectPath: string | null;
  projectName: string;
  onCollapse?: () => void;
  maximized?: boolean;
  onToggleMaximize?: () => void;
}

export function ChatTab({ projectPath, projectName, onCollapse, maximized, onToggleMaximize }: ChatTabProps) {
  const [mode, setMode] = useState<'terminal' | 'chat'>('terminal');

  return (
    <div className="chat-tab">
      <div className="chat-tab-header">
        <div className="chat-mode-switch">
          <button
            className={`mode-btn ${mode === 'terminal' ? 'active' : ''}`}
            onClick={() => setMode('terminal')}
          >
            <Terminal size={16} />
            Terminal (Zellij)
          </button>
          <button
            className={`mode-btn ${mode === 'chat' ? 'active' : ''}`}
            onClick={() => setMode('chat')}
          >
            <Bot size={16} />
            AI Chat
          </button>
        </div>
        <div className="chat-header-actions">
          {onToggleMaximize && (
            <button
              className="btn-icon"
              onClick={onToggleMaximize}
              title={maximized ? 'Restore panel size' : 'Maximize panel'}
            >
              {maximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          )}
          {onCollapse && (
            <button
              className="btn-icon"
              onClick={onCollapse}
              title="Collapse panel"
            >
              <ChevronDown size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="chat-tab-content">
        {/* Terminal - always rendered but hidden when not active */}
        <div 
          className="chat-mode-panel"
          style={{ display: mode === 'terminal' ? 'flex' : 'none' }}
        >
          <ZellijTerminal
            projectPath={projectPath}
            projectName={projectName}
            focused={maximized}
          />
        </div>
        
        {/* AI Chat - always rendered but hidden when not active */}
        <div 
          className="chat-mode-panel"
          style={{ display: mode === 'chat' ? 'flex' : 'none' }}
        >
          <div className="ai-chat-placeholder">
            <Bot size={48} />
            <h3>AI Chat</h3>
            <p>Direct chat with AI assistant coming soon!</p>
            <p className="hint">
              For now, use the Terminal mode to interact with 
              Claude, Kimi, or other AI agents in Zellij.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
