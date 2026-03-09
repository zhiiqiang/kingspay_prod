# Nginx reverse proxy for KingsPay Admin

This folder contains a lightweight Nginx setup to serve the Vite build and forward `/api` calls to the correct backend for each environment.

## Files

- `default.conf.template`: Nginx template processed by the official `nginx` Docker image. Set `API_ROOT` to the backend base URL (for testing use `http://103.235.75.231:3000`).
- `docker-compose.yml`: Convenience compose file that serves the built app and proxies `/api` to the configured `API_ROOT`. The host port is configurable via `PORT` (defaults to `8080`).

## Usage

1. Build the app output that Nginx will serve:
   ```bash
   npm install
   npm run build
   ```

2. Start Nginx with the testing backend. Override `PORT` if you want to avoid exposing a custom port to users (for example, set it to `80` when fronted by a domain like `kingspay-admin.vercel.app`):
   ```bash
   PORT=80 API_ROOT=http://103.235.75.231:3000 docker compose -f nginx/docker-compose.yml up --build
   ```

3. Visit your host (for example, `https://kingspay-admin.vercel.app/login` when fronted by Nginx) and API calls to `/api` will be proxied to the value of `API_ROOT`, allowing users to hit the app without needing to specify the backend port explicitly.

4. For production, set `API_ROOT` to your production endpoint before running `docker compose`.
