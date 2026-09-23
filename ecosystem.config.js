// PM2 process definition for the JDK backend (serves the public site,
// /admin, and the API on one port via start_server.sh -> single uvicorn
// process — no gunicorn, no worker pool).
//
// First-time setup (see start_server.sh's own header for the full list):
//   npm install && npm run build
//   cd backend && python3 -m venv venv && venv/bin/pip install -r requirements.txt
//
// Usage:
//   pm2 start ecosystem.config.js
//   pm2 save          # persist across reboots (with pm2 startup)
//   pm2 logs jdk-web
//   pm2 restart jdk-web
//   pm2 stop jdk-web
//
// Don't also run deploy/jdk-web.service under systemd at the same time —
// pick one process manager for this app, not both.
module.exports = {
  apps: [
    {
      name: "jdk-web",
      script: "./start_server.sh",
      interpreter: "bash",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      env: {
        // 0.0.0.0 so the app is reachable on the server's public IP, not
        // just localhost, when nothing else (nginx, etc.) is proxying to
        // it — see start_server.sh's own default (127.0.0.1) for local/dev
        // runs, which this overrides for the PM2/production entry point.
        HOST: "0.0.0.0",
        PORT: "7001",
      },
    },
  ],
};
