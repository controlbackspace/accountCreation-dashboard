module.exports = {
  apps: [
    {
      name: 'account-provisioning-system',
      script: 'app.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      watch: false,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      out_file: 'logs/pm2-out.log',
      error_file: 'logs/pm2-error.log',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
