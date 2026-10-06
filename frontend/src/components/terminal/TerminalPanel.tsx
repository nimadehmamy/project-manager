import { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { io, Socket } from 'socket.io-client';
import { useTheme } from '../../contexts/ThemeContext';
import 'xterm/css/xterm.css';

interface TerminalPanelProps {
  projectId: string;
  projectPath?: string;
  zellijSessionName?: string;
  mode?: 'new' | 'zellij';
  onClose?: () => void;
}

// Dark theme (default)
const darkTheme = {
  background: '#1e1e1e',
  foreground: '#d4d4d4',
  cursor: '#d4d4d4',
  selectionBackground: '#264f78',
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#e5e5e5',
};

// Light theme
const lightTheme = {
  background: '#ffffff',
  foreground: '#333333',
  cursor: '#333333',
  selectionBackground: '#add6ff',
  black: '#000000',
  red: '#cd3131',
  green: '#008000',
  yellow: '#795e26',
  blue: '#0000ff',
  magenta: '#af00db',
  cyan: '#098658',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#cd3131',
  brightGreen: '#008000',
  brightYellow: '#795e26',
  brightBlue: '#0000ff',
  brightMagenta: '#af00db',
  brightCyan: '#098658',
  brightWhite: '#e5e5e5',
};

export default function TerminalPanel({ 
  projectId, 
  projectPath = '/home/nima/__work/project_manager',
  zellijSessionName,
  mode = 'new',
  onClose 
}: TerminalPanelProps) {
  const { theme: appTheme } = useTheme();
  const isDark = appTheme === 'dark';
  
  const terminalRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initTerminal = useCallback(() => {
    if (!terminalRef.current) return;

    // Create terminal with current theme
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"JetBrains Mono", "Fira Code", "Hack", "DejaVu Sans Mono", "SF Mono", "Monaco", "Menlo", monospace',
      theme: isDark ? darkTheme : lightTheme,
      cols: 80,
      rows: 24,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    term.open(terminalRef.current);
    fitAddon.fit();
    
    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Connect to terminal service
    const socket = io('http://localhost:3001', {
      transports: ['websocket', 'polling'],
      timeout: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to terminal service');
      setConnected(true);
      setError(null);
      
      // Start terminal session - use correct event name
      if (mode === 'zellij' && zellijSessionName) {
        socket.emit('attach_zellij', {
          path: projectPath,
          session: zellijSessionName,
        });
      } else {
        socket.emit('new_terminal', {
          path: projectPath,
        });
      }
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setConnected(false);
      setError('Failed to connect to terminal service. Is it running on port 3001?');
    });

    socket.on('output', (data: string) => {
      console.log('Terminal output:', data.length, 'chars');
      term.write(data);
    });

    socket.on('ready', (data: any) => {
      console.log('Terminal ready:', data);
      // Focus terminal when ready
      setTimeout(() => {
        term.focus();
        fitAddon.fit();
        console.log('Terminal focused and fitted');
      }, 100);
    });

    socket.on('exit', () => {
      term.write('\r\n\n[Terminal session ended]\n');
      setConnected(false);
    });

    socket.on('error', (err: string) => {
      console.error('Terminal error:', err);
      setError(err);
    });

    // Handle terminal input
    term.onData((data) => {
      if (socket.connected) {
        socket.emit('input', data);
      }
    });

    // Handle resize
    const handleResize = () => {
      if (fitAddonRef.current && termRef.current && socket.connected) {
        fitAddonRef.current.fit();
        const { cols, rows } = termRef.current;
        socket.emit('resize', { cols, rows });
      }
    };

    window.addEventListener('resize', handleResize);

    // Initial resize
    setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [projectId, projectPath, zellijSessionName, mode, isDark]);

  useEffect(() => {
    const cleanup = initTerminal();

    return () => {
      cleanup?.();
      socketRef.current?.disconnect();
      termRef.current?.dispose();
    };
  }, [initTerminal]);

  // Update terminal theme when app theme changes
  useEffect(() => {
    const term = termRef.current;
    if (term) {
      term.options.theme = isDark ? darkTheme : lightTheme;
    }
  }, [isDark]);

  const handleNewTerminal = () => {
    socketRef.current?.emit('new_terminal', {
      path: projectPath,
    });
  };

  const handleAttachZellij = () => {
    if (zellijSessionName) {
      socketRef.current?.emit('attach_zellij', {
        path: projectPath,
        session: zellijSessionName,
      });
    }
  };

  // Dynamic styles based on theme
  const containerBg = isDark ? 'bg-[#1e1e1e]' : 'bg-white';
  const toolbarBg = isDark ? 'bg-[#2d2d2d]' : 'bg-gray-100';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-300';
  const textColor = isDark ? 'text-gray-400' : 'text-gray-600';

  return (
    <div className={`flex flex-col h-full ${containerBg} rounded-lg overflow-hidden`}>
      {/* Toolbar */}
      <div className={`flex items-center justify-between px-3 py-2 ${toolbarBg} border-b ${borderColor}`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className={`text-xs ${textColor}`}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {mode === 'zellij' && zellijSessionName && (
            <button
              onClick={handleAttachZellij}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Attach Zellij
            </button>
          )}
          <button
            onClick={handleNewTerminal}
            className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
          >
            New Terminal
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="px-3 py-2 bg-red-900/50 border-b border-red-700 text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Terminal */}
      <div 
        ref={terminalRef} 
        className="flex-1 p-2 min-h-[300px]" 
        style={{ 
          backgroundColor: isDark ? '#1e1e1e' : '#ffffff',
          height: '100%',
          overflow: 'hidden'
        }}
      />
    </div>
  );
}
