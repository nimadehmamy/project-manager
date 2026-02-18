export function ChatPanel() {
  return (
    <div className="chat-panel">
      <div className="panel-header">
        <h3>AI Assistant</h3>
        <span className="status-indicator offline">Offline</span>
      </div>
      <div className="chat-placeholder">
        <div className="placeholder-icon">🤖</div>
        <p>AI Chat coming soon</p>
        <p className="placeholder-hint">Ask questions about your projects</p>
      </div>
    </div>
  );
}
