"""Zellij session manager for remote (Beast) AI agent integration.

This module manages Zellij sessions that run on the remote Beast server,
not on the local machine where Flask runs.
"""

import os
import json
import paramiko
from typing import Optional, Dict, List, Any
from dataclasses import dataclass, asdict

from config import BEAST_HOST, BEAST_PORT, BEAST_USER, BEAST_KEY_PATH, ROOT_JAIL


@dataclass
class ZellijSession:
    """Represents a Zellij session on the remote server."""
    name: str
    is_active: bool
    attached_clients: int
    created_at: str
    project_path: Optional[str] = None
    agent_type: Optional[str] = None  # 'claude', 'kimi', etc.
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class ZellijManager:
    """Manages Zellij sessions on the remote Beast server."""
    
    SESSION_PREFIX = "pm-"
    
    def __init__(self):
        self._bindings: Dict[str, str] = {}  # project_path -> session_name
        
    def _get_ssh_client(self) -> paramiko.SSHClient:
        """Create and return an SSH client connected to Beast."""
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(
            hostname=BEAST_HOST,
            port=BEAST_PORT,
            username=BEAST_USER,
            key_filename=BEAST_KEY_PATH,
        )
        return client
    
    def _run_remote_command(self, cmd: str) -> tuple[int, str, str]:
        """Run a command on Beast and return (exit_code, stdout, stderr)."""
        client = None
        try:
            client = self._get_ssh_client()
            # Source common profile files to get cargo and other user-installed tools
            # Non-interactive shells don't source .bashrc/.zshrc by default
            full_cmd = f'source ~/.bashrc 2>/dev/null || source ~/.zshrc 2>/dev/null || true; export PATH="$HOME/.cargo/bin:$HOME/.local/bin:$PATH"; {cmd}'
            stdin, stdout, stderr = client.exec_command(full_cmd, timeout=30)
            exit_code = stdout.channel.recv_exit_status()
            return exit_code, stdout.read().decode('utf-8'), stderr.read().decode('utf-8')
        except Exception as e:
            return -1, "", str(e)
        finally:
            if client:
                client.close()
    
    def is_zellij_available(self) -> bool:
        """Check if Zellij is installed on Beast."""
        exit_code, _, _ = self._run_remote_command('zellij --version')
        return exit_code == 0
    
    def list_sessions(self) -> List[ZellijSession]:
        """List all active Zellij sessions on Beast."""
        sessions = []
        
        # Get session list
        exit_code, stdout, stderr = self._run_remote_command(
            'zellij list-sessions --no-formatting 2>/dev/null || echo "NO_ZELLIJ"'
        )
        
        if exit_code != 0 or 'NO_ZELLIJ' in stdout:
            return sessions
        
        # Parse output: "session_name [active/detached] [attached clients] [created]"
        for line in stdout.strip().split('\n'):
            if not line or line.startswith('(') or 'NO_ZELLIJ' in line:
                continue
                
            parts = line.split()
            if len(parts) >= 4:
                name = parts[0]
                is_active = 'active' in line.lower() or parts[1] == 'attached'
                try:
                    attached = int(parts[2]) if parts[2].isdigit() else 0
                except:
                    attached = 0
                created = ' '.join(parts[3:]) if len(parts) > 3 else ''
                
                # Try to determine project binding
                project_path = self._get_session_project(name)
                agent_type = self._detect_agent_type(name)
                
                sessions.append(ZellijSession(
                    name=name,
                    is_active=is_active,
                    attached_clients=attached,
                    created_at=created,
                    project_path=project_path,
                    agent_type=agent_type
                ))
        
        return sessions
    
    def _get_session_project(self, session_name: str) -> Optional[str]:
        """Get the project path associated with a session."""
        # Check explicit bindings first
        for project, session in self._bindings.items():
            if session == session_name:
                return project
        
        # Check naming convention: pm-{project-name}
        if session_name.startswith(self.SESSION_PREFIX):
            project_slug = session_name[len(self.SESSION_PREFIX):]
            # The project path on Beast
            potential_path = f"{ROOT_JAIL}/{project_slug}"
            # Check if directory exists on Beast
            exit_code, _, _ = self._run_remote_command(f'test -d {potential_path}')
            if exit_code == 0:
                return potential_path
        
        return None
    
    def _detect_agent_type(self, session_name: str) -> Optional[str]:
        """Detect what AI agent is running based on session name."""
        name_lower = session_name.lower()
        if 'claude' in name_lower:
            return 'claude'
        elif 'kimi' in name_lower or 'kimi-cli' in name_lower:
            return 'kimi'
        elif 'aider' in name_lower:
            return 'aider'
        elif 'codellama' in name_lower or 'ollama' in name_lower:
            return 'ollama'
        return None
    
    def get_project_session(self, project_path: str) -> Optional[ZellijSession]:
        """Get the Zellij session associated with a project."""
        # Check explicit binding
        if project_path in self._bindings:
            session_name = self._bindings[project_path]
            sessions = self.list_sessions()
            for session in sessions:
                if session.name == session_name:
                    return session
        
        # Check naming convention - extract project name from path
        project_name = os.path.basename(project_path.rstrip('/'))
        expected_session = f"{self.SESSION_PREFIX}{project_name}"
        
        sessions = self.list_sessions()
        for session in sessions:
            if session.name == expected_session:
                return session
        
        return None
    
    def bind_session(self, project_path: str, session_name: str) -> bool:
        """Explicitly bind a project to a Zellij session."""
        self._bindings[project_path] = session_name
        return True
    
    def create_session(self, project_path: str, agent_type: str = 'claude') -> Optional[str]:
        """Create a new Zellij session for a project on Beast."""
        project_name = os.path.basename(project_path.rstrip('/'))
        session_name = f"{self.SESSION_PREFIX}{project_name}"
        
        # Check if session already exists
        sessions = self.list_sessions()
        for session in sessions:
            if session.name == session_name:
                return session_name  # Return existing
        
        # Create new session on Beast
        # We create a detached session that runs the AI agent
        agent_cmd = {
            'claude': 'claude',
            'kimi': 'kimi',
            'aider': 'aider',
        }.get(agent_type, 'bash')
        
        # Create the session with the agent running in it
        cmd = f'cd {project_path} && zellij --session {session_name} options --default-shell {agent_cmd} 2>/dev/null || cd {project_path} && zellij --session {session_name}'
        
        # Run in background on Beast
        exit_code, stdout, stderr = self._run_remote_command(
            f'nohup sh -c "{cmd}" > /dev/null 2>&1 &'
        )
        
        # Give it a moment to start
        import time
        time.sleep(1)
        
        # Verify it was created
        sessions = self.list_sessions()
        for session in sessions:
            if session.name == session_name:
                return session_name
        
        return None
    
    def kill_session(self, session_name: str) -> bool:
        """Kill a Zellij session on Beast."""
        exit_code, _, _ = self._run_remote_command(
            f'zellij kill-session {session_name}'
        )
        return exit_code == 0
    
    def get_ssh_client_for_terminal(self) -> paramiko.SSHClient:
        """Get an SSH client for terminal WebSocket connection.
        
        This is used by the WebSocket handler to create an interactive
        SSH session for attaching to zellij.
        """
        return self._get_ssh_client()


# Global instance
_zellij_manager: Optional[ZellijManager] = None


def get_zellij_manager() -> ZellijManager:
    """Get or create the global ZellijManager instance."""
    global _zellij_manager
    if _zellij_manager is None:
        _zellij_manager = ZellijManager()
    return _zellij_manager
