# Metronic 9 | All-in-One Tailwind based HTML/React/Next.js Template for Modern Web Applications

## Getting Started

Refer to the [Metronic Vite Documentation](https://docs.keenthemes.com/metronic-react)
for comprehensive guidance on setting up and getting started your project with Metronic.

## ReUI Components

Metronic now leverages [ReUI](https://reui.io), our open-source React component library.

Star the [ReUI on GitHub](https://github.com/keenthemes/reui) to help us grow the project and stay updated on new features!

## Login with Supabase Auth

This project uses Supabase for authentication. Follow these steps to set up and test the login functionality:

### Prerequisites

- Node.js 16.x or higher
- Npm or Yarn
- Tailwind CSS 4.x
- React 19.x
- A Supabase account and project

### Installation

To set up the project dependencies, including those required for React 19, use the `--force` flag to resolve any dependency conflicts:

```bash
npm install --force
```

### Environment Setup

1. Make sure your `.env` file is configured with Supabase credentials:

```

VITE_SUPABASE_URL=https://your-project-url.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-for-admin-functions

```

### Creating a Demo User

For testing purposes, you can create a demo user with:

```bash
npm run create-demo-user
```

This will create a user with the following credentials:

- Email: demo@kt.com
- Password: demo123

### Login Features

The login implementation includes:

- Email/Password authentication
- Google OAuth integration
- Password reset flow
- Error handling
- Token management
- Protected routes

### Setting Up the Demo Layout

Follow the [Metronic Vite Documentation](https://docs.keenthemes.com/metronic-vite/guides/layouts) to configure and use the demo layout of your choice.

### Development

Start the development server:

```bash
npm run dev
```

Visit `http://localhost:5173/auth/signin` to test the login functionality.

If you want local requests to hit the testing backend without CORS errors, keep `VITE_API_ROOT=/api` in your `.env` and set a
proxy target:

```
VITE_API_PROXY_TARGET=http://103.235.75.231:3000
```

With this configuration, Vite will proxy `/api` calls to the testing endpoint while you run `npm run dev`.

### Serving with Nginx and an API reverse proxy

If you want local or on-server hosting with a reverse proxy to your API, an Nginx setup is available under `nginx/`.

1. Build the app so Nginx can serve the static output:
   ```bash
   npm install
   npm run build
   ```
2. Start the Nginx container with the desired API backend (testing shown below). The host port can be customized with `PORT` so
   you don't have to expose a nonstandard port to users:
   ```bash
   PORT=80 API_ROOT=http://103.235.75.231:3000 docker compose -f nginx/docker-compose.yml up --build
   ```
3. Open your host (for example, `https://kingspay-admin.vercel.app/login` when fronted by Nginx) and your `/api` requests will be
   proxied to `http://103.235.75.231:3000` by default or whatever value you set in `API_ROOT`. This keeps the user-facing URL clean
   while the API traffic is routed to the backend port behind Nginx. Set `API_ROOT` to your production endpoint when deploying.

### Deploying to Vercel (testing environment)

To build for Vercel against the testing backend, use the dedicated script:

```bash
npm run vercel-build
```

This sets `VITE_API_ROOT` to `http://103.235.75.231:3000/api` for the build, so Vercel deployments point at the testing API.

### Deploying to Vercel (testing environment)

To build for Vercel against the testing backend, use the dedicated script:

```bash
npm run vercel-build
```

This sets `VITE_API_ROOT` to `http://103.235.75.231:3000/api` for the build, so Vercel deployments point at the testing API.

### Deploying to Vercel (testing environment)

To build for Vercel against the testing backend, use the dedicated script:

```bash
npm run vercel-build
```

This sets `VITE_API_ROOT` to `http://103.235.75.231:3000/api` for the build, so Vercel deployments point at the testing API.

### Testing Login

You can test login using:

1. The demo account credentials
2. Register a new account (when implemented)
3. Google Sign-in (requires proper OAuth setup in Supabase)

### Reporting Issues

If you encounter any issues or have suggestions for improvement, please contact us at [support@keenthemes.com](mailto:support@keenthemes.com).
Include a detailed description of the issue or suggestion, and we will work to address it in the next stable release.
