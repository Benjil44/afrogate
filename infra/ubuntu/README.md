# Ubuntu Deployment Notes

This is the first deployment path for AfroGate. Docker is optional later; the first Ubuntu setup can stay simple and native.

## Services

- PostgreSQL installed on the host or a managed database.
- Backend as a `systemd` service.
- Dashboard as a Next.js process behind Nginx.
- Nginx as the public reverse proxy.

## Suggested Ports

- Backend API: `4000`
- Dashboard: `3000`
- PostgreSQL: `5432`

## First Setup Outline

```bash
sudo apt update
sudo apt install -y nginx postgresql

cd /opt/afrogate
npm install
npm --workspace @afrogate/backend run build
npm --workspace @afrogate/dashboard run build
```

Copy the service and Nginx samples from this folder, then adjust paths, domains, and environment values.

