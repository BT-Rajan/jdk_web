// PM2 process definition for the JDK backend (serves the public site,
// /admin, and the API on one port via start_server.sh -> single uvicorn
// process — no gunicorn, no worker pool).
//
// First-time setup (see start_server.sh's own header for the full list):
//   npm install && npm run build
//   cd backend && python3 -m venv venv && venv/bin/pip install -r requirements.txt
//
// Named .cjs, not .js: package.json has "type": "module", so a plain
// .js file here would be loaded as ESM and `module.exports` wouldn't
// work — .cjs forces CommonJS regardless of that setting.
//
// Usage:
//   pm2 start ecosystem.config.cjs
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
        // 0.0.0.0, not the literal public IP: on most cloud VPS the
        // public IP is NAT'd to the NIC rather than assigned to it, so
        // binding to that exact address fails to bind. 0.0.0.0 listens
        // on every interface and is reachable at the public IP as long
        // as the firewall/security group allows the port through.
        HOST: "0.0.0.0",
        PORT: "7173",
      },
    },
  ],
};
