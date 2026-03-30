# Nginx reverse proxy for KingsPay Admin

This folder contains a lightweight Nginx setup to serve the Vite build and forward `/api` calls to the correct backend for each environment.

## Files

- `default.conf.template`: Nginx template processed by the official `nginx` Docker image.
- `docker-compose.yml`: Convenience compose file that serves the built app and proxies `/api` to the configured `API_ROOT`.

## Usage

1. Build the app output that Nginx will serve:
   ```bash
   npm install
   npm run build
   ```

2. Start the proxy:
   ```bash
   npm run nginx:up
   ```

   - If Docker is available, it uses `nginx/docker-compose.yml`.
   - If Docker is not installed but `nginx` is installed on the host, it starts a local Nginx runtime using the same proxy rules.

3. Optional overrides:
   ```bash
   PORT=80 API_ROOT=http://103.235.75.231:3000 npm run nginx:up
   ```

4. Stop the proxy:
   ```bash
   npm run nginx:down
   ```

5. View logs:
   ```bash
   npm run nginx:logs
   ```

6. Visit your host (for example, `http://localhost:8080/login` or your mapped host) and API calls to `/api` will be proxied to `API_ROOT`.
