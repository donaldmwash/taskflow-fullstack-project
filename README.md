# TaskFlow — Full-Stack Task Workspace

TaskFlow is a full-stack task management application with account registration, private workspaces and persistent task management. Users can create tasks, set priorities and due dates, update progress, search their work and keep a focused view of what remains.

The project is structured as a small monorepo: a React client and an Express API backed by PostgreSQL.

## Features

- Register and sign in with email and password.
- Create a private workspace for each account.
- Create, update, filter, search and delete tasks.
- Set task priority, status, description and due date.
- Keep task records in PostgreSQL through Prisma.
- Validate request data with Zod.
- Hash passwords with bcrypt and use signed HTTP-only session cookies.
- Apply API security headers, a CORS allow-list and authentication rate limits.
- Start the database locally with Docker Compose.

## Technology

**Frontend:** React 18, TypeScript, Vite, Lucide

**Backend:** Node.js, Express, TypeScript, Prisma, PostgreSQL, Zod, bcryptjs, JSON Web Tokens

**Tooling:** npm workspaces, Docker Compose, Vitest, GitHub Actions

## Requirements

- Node.js 20+
- npm 10+
- Docker Desktop or Docker Engine with Compose

## Run locally

1. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

2. Set `JWT_SECRET` in `.env` to a unique random value of at least 32 characters. Do not commit the real `.env` file.

3. Start PostgreSQL:

   ```bash
   docker compose up -d database
   ```

4. Install dependencies and generate the Prisma client:

   ```bash
   npm install
   npm run db:generate
   ```

5. Apply the committed database migration:

   ```bash
   npm run db:migrate
   ```

6. Start the API and frontend:

   ```bash
   npm run dev
   ```

The frontend is available at http://localhost:5173 and the API at http://localhost:4000.

## Useful commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the API and frontend together |
| `npm run build` | Build both workspaces |
| `npm test` | Run API validation tests |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:migrate` | Apply committed migrations |

## API overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | API health check |
| POST | `/api/auth/register` | Register and create a workspace |
| POST | `/api/auth/login` | Sign in |
| GET | `/api/auth/me` | Read the current session |
| POST | `/api/auth/logout` | Clear the session cookie |
| GET | `/api/tasks` | List tasks in the current workspace |
| POST | `/api/tasks` | Create a task |
| PATCH | `/api/tasks/:id` | Update a task |
| DELETE | `/api/tasks/:id` | Delete a task |

## Engineering notes

- Passwords are stored as bcrypt hashes.
- Session cookies are HTTP-only, signed and configured as secure in production.
- Task operations use the workspace ID from the verified session, not a workspace ID supplied by the browser.
- Request bodies are validated before database operations.
- The Prisma schema and initial SQL migration are committed to source control.

## Production considerations

This is a portfolio project, not a production-ready SaaS. Before public deployment, add CSRF protection suited to the deployment topology, email verification, password recovery, workspace invitations and roles, end-to-end tests, structured logging, monitoring, managed database backups and a reviewed secret-management strategy. Configure HTTPS and production cookie settings at the hosting layer.

## Author

**Donald Mwashegha** · [GitHub](https://github.com/donaldmwash)
