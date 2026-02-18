module.exports = {
  apps: [
    {
      name: 'terminal-service',
      script: './server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      log_file: '/tmp/terminal.log',
      out_file: '/tmp/terminal.log',
      error_file: '/tmp/terminal.log',
      merge_logs: true
    }
  ]
};
