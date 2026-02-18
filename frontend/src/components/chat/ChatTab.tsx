import { useState } from 'react';
import { ZellijTerminal } from '../zellij/ZellijTerminal';
import { Bot, Terminal } from 'lucide-react';

interface ChatTabProps {
  projectPath: string | null;
  projectName: string;
}

export function ChatTab({ projectPath, projectName }: ChatTabProps) {
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
