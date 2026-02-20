"""SSH Connection Pool for Project Manager.

Maintains a pool of reusable Paramiko SSH/SFTP connections to avoid
the overhead of establishing a new SSH handshake for every API request.
"""

import threading
import time
from contextlib import contextmanager

import paramiko

from config import BEAST_HOST, BEAST_KEY_PATH, BEAST_PORT, BEAST_USER


class SSHConnectionPool:
    """Pool of reusable SSH connections with SFTP channels."""

    def __init__(self, max_idle=3, idle_timeout=300):
        self._pool: list[tuple[paramiko.SSHClient, paramiko.SFTPClient, float]] = []
        self._lock = threading.Lock()
        self._max_idle = max_idle
        self._idle_timeout = idle_timeout  # seconds

    def _create_connection(self) -> tuple[paramiko.SSHClient, paramiko.SFTPClient]:
        """Create a new SSH + SFTP connection."""
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(
            hostname=BEAST_HOST,
            port=BEAST_PORT,
            username=BEAST_USER,
            key_filename=BEAST_KEY_PATH,
        )
        sftp = client.open_sftp()
        return client, sftp

    def _is_alive(self, client: paramiko.SSHClient) -> bool:
        """Check if an SSH connection is still usable."""
        transport = client.get_transport()
        if transport is None or not transport.is_active():
            return False
        try:
            transport.send_ignore()
            return True
        except Exception:
            return False

    def _acquire(self) -> tuple[paramiko.SSHClient, paramiko.SFTPClient]:
        """Get a connection from the pool or create a new one."""
        now = time.time()
        with self._lock:
            # Try to find a healthy, non-expired connection
            while self._pool:
                client, sftp, created_at = self._pool.pop(0)
                if now - created_at > self._idle_timeout:
                    # Expired — close silently
                    self._close_quiet(client, sftp)
                    continue
                if self._is_alive(client):
                    return client, sftp
                else:
                    self._close_quiet(client, sftp)

        # No reusable connection available — create fresh
        return self._create_connection()

    def _release(self, client: paramiko.SSHClient, sftp: paramiko.SFTPClient):
        """Return a connection to the pool for reuse."""
        with self._lock:
            if len(self._pool) < self._max_idle and self._is_alive(client):
                self._pool.append((client, sftp, time.time()))
            else:
                self._close_quiet(client, sftp)

    def _discard(self, client: paramiko.SSHClient, sftp: paramiko.SFTPClient):
        """Close a connection without returning it to the pool."""
        self._close_quiet(client, sftp)

    @staticmethod
    def _close_quiet(client: paramiko.SSHClient, sftp: paramiko.SFTPClient):
        """Close connections, ignoring errors."""
        try:
            sftp.close()
        except Exception:
            pass
        try:
            client.close()
        except Exception:
            pass

    @contextmanager
    def get_sftp(self):
        """Context manager that yields a reusable SFTP client.

        Usage:
            with pool.get_sftp() as sftp:
                sftp.listdir('/')
        """
        client, sftp = self._acquire()
        try:
            yield sftp
            # Successful — return to pool
            self._release(client, sftp)
        except Exception:
            # Error — discard this connection
            self._discard(client, sftp)
            raise

    @contextmanager
    def get_ssh(self):
        """Context manager that yields (ssh_client, sftp) for endpoints
        that need exec_command in addition to SFTP.

        Usage:
            with pool.get_ssh() as (client, sftp):
                client.exec_command('ls')
        """
        client, sftp = self._acquire()
        try:
            yield client, sftp
            self._release(client, sftp)
        except Exception:
            self._discard(client, sftp)
            raise

    def close_all(self):
        """Shut down the pool, closing all idle connections."""
        with self._lock:
            for client, sftp, _ in self._pool:
                self._close_quiet(client, sftp)
            self._pool.clear()
