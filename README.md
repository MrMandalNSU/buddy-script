# BuddyScript

BuddyScript is a full-stack social-feed application built from the supplied reference designs. The repository contains a Next.js frontend and an Express/TypeScript API backed by PostgreSQL/Neon through Prisma.

The implemented product includes account registration and login, persistent or browser-session authentication, a responsive feed, public/private posts, direct image uploads, typed reactions, comments, one-level replies, editing/deletion, cursor pagination, health checks, metrics, and production-oriented API security.

## Repository guides

- [Feature and System Design](PROJECT_DOCUMENTATION.md)
- [Frontend documentation](frontend/README.md)
- [Backend documentation](backend/README.md)

Use this README for the complete stack. The application-specific guides contain full environment references, architecture notes, command descriptions, and troubleshooting.

## Stack

### Frontend

- Next.js 16 and React 19
- TypeScript
- TanStack Query
- Zod
- Vitest and Testing Library
- Responsive CSS using local reference assets

### Backend

- Node.js, Express 5, and TypeScript
- PostgreSQL/Neon
- Prisma 7 with the PostgreSQL adapter
- Argon2id and JOSE
- Zod request/environment validation
- Pino logs and Prometheus metrics
- Vitest and Supertest
- Optional Cloudinary signed uploads

## Prerequisites

- Node.js 22 or newer for the complete stack
- pnpm 11.7.0
- A Neon/PostgreSQL database
- Optional Cloudinary account for image uploads

Enable the package manager declared by both applications:

```bash
corepack enable
corepack prepare pnpm@11.7.0 --activate
```

The repository does not have a root package manifest. `frontend/` and `backend/` are separate pnpm projects with independent lockfiles, so run package commands in the relevant directory.

## Local setup

### 1. Configure the backend environment

The backend environment must exist before dependency installation because `postinstall` generates Prisma and loads `prisma.config.ts`.

On macOS or Linux:

```bash
cd backend
cp .env.example .env
```

On Windows PowerShell:

```powershell
Set-Location backend
Copy-Item .env.example .env
```

Configure at least:

```dotenv
NODE_ENV=development
PORT=4000
ALLOWED_ORIGINS=http://localhost:3000
COOKIE_SECURE=false

DATABASE_URL="YOUR_POOLED_NEON_URL"
DIRECT_URL="YOUR_DIRECT_NEON_URL"

JWT_ACCESS_SECRET="A_UNIQUE_SECRET_OF_AT_LEAST_32_CHARACTERS"
JWT_REFRESH_SECRET="ANOTHER_UNIQUE_SECRET_OF_AT_LEAST_32_CHARACTERS"
CURSOR_SIGNING_SECRET="A_THIRD_UNIQUE_SECRET_OF_AT_LEAST_32_CHARACTERS"
```

Generate each secret independently:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

For image uploads, also set all three Cloudinary credentials:

```dotenv
CLOUDINARY_CLOUD_NAME="..."
CLOUDINARY_API_KEY="..."
CLOUDINARY_API_SECRET="..."
```

Without Cloudinary, text posts work but image uploads do not.

See [backend environment variables](backend/README.md#environment-variables) for every supported setting.

### 2. Install, migrate, and optionally seed the backend

From `backend/`:

```bash
pnpm install
pnpm db:validate
pnpm db:migrate:deploy
pnpm db:generate
pnpm db:seed
```

For a fresh checkout, `db:migrate:deploy` applies the committed migration history. When intentionally developing a schema change, create a new migration with:

```bash
pnpm db:migrate:dev -- --name describe_the_change
```

Never use `migrate dev` against production. Production releases should run `pnpm db:migrate:deploy` once as a release step.

### 3. Start the backend

```bash
pnpm dev
```

The API starts at `http://localhost:4000` after confirming database connectivity.

Useful endpoints:

- [Liveness](http://localhost:4000/health/live)
- [Readiness](http://localhost:4000/health/ready)
- [OpenAPI JSON](http://localhost:4000/docs/openapi.json)
- [Prometheus metrics](http://localhost:4000/metrics)

### 4. Configure and install the frontend

Open a second terminal from the repository root.

On macOS or Linux:

```bash
cd frontend
cp .env.example .env.local
pnpm install
```

On Windows PowerShell:

```powershell
Set-Location frontend
Copy-Item .env.example .env.local
pnpm install
```

The default frontend environment is:

```dotenv
NEXT_PUBLIC_APP_NAME=BuddyScript
BACKEND_URL=http://localhost:4000
```

Next.js rewrites same-origin browser requests from `/api/v1/*` to the configured backend. Browser code does not call the backend origin directly.

### 5. Start the frontend

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

After running the seed, use:

```text
Email:    alex@buddy.test
Password: Password123!
```

All seeded demo users share that password. Demo credentials must never be used for a production deployment.

## Local startup summary

Terminal 1:

```bash
cd backend
pnpm dev
```

Terminal 2:

```bash
cd frontend
pnpm dev
```

Browser:

```text
http://localhost:3000
```

## Architecture

```text
Browser
  │
  │ same-origin /api/v1/*
  ▼
Next.js frontend :3000
  │
  │ server rewrite to BACKEND_URL
  ▼
Express API :4000
  ├── HTTP-only access/refresh cookies
  ├── CSRF and origin validation
  ├── Auth, posts, comments, replies, reactions
  ├── Signed Cloudinary upload flow
  ├── Pino logs, health, and Prometheus metrics
  ▼
PostgreSQL / Neon
```

The browser uploads image bytes directly to Cloudinary after receiving a signed, owner-scoped upload request from the API. The backend validates the signed upload result before storing image metadata.

## Application routes

| Frontend route | Purpose                                   |
| -------------- | ----------------------------------------- |
| `/`            | Session-aware redirect to login or feed.  |
| `/login`       | Account login and Remember Me preference. |
| `/register`    | Account creation and password policy UX.  |
| `/feed`        | Protected social feed.                    |

All business API routes are under `/api/v1`. See the [backend API overview](backend/README.md#api-overview) or the running OpenAPI document.

## Common commands

### Frontend

Run from `frontend/`:

| Command          | Purpose                      |
| ---------------- | ---------------------------- |
| `pnpm dev`       | Start development mode.      |
| `pnpm lint`      | Run ESLint.                  |
| `pnpm typecheck` | Run TypeScript checks.       |
| `pnpm test`      | Run frontend tests.          |
| `pnpm build`     | Create the production build. |
| `pnpm start`     | Run the built frontend.      |

### Backend

Run from `backend/`:

| Command                  | Purpose                                 |
| ------------------------ | --------------------------------------- |
| `pnpm dev`               | Start API watch mode.                   |
| `pnpm check`             | Run lint, types, tests, and build.      |
| `pnpm test`              | Run tests without DB suites by default. |
| `pnpm build`             | Compile to `dist/`.                     |
| `pnpm start`             | Run the compiled API.                   |
| `pnpm db:validate`       | Validate Prisma schema/configuration.   |
| `pnpm db:generate`       | Regenerate the Prisma client.           |
| `pnpm db:migrate:deploy` | Apply committed migrations.             |
| `pnpm db:migrate:dev`    | Create/apply a development migration.   |
| `pnpm db:seed`           | Upsert deterministic demo data.         |
| `pnpm db:studio`         | Open Prisma Studio.                     |

## Quality checks

Frontend:

```bash
cd frontend
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Backend:

```bash
cd backend
pnpm check
pnpm db:validate
```

Database integration tests require a migrated, dedicated test database.

On macOS or Linux:

```bash
cd backend
RUN_DATABASE_TESTS=true pnpm test
```

On Windows PowerShell:

```powershell
Set-Location backend
$env:RUN_DATABASE_TESTS = "true"
pnpm test
Remove-Item Env:RUN_DATABASE_TESTS
```

These tests use `DATABASE_URL` or `DATABASE_URL_DEV` and create/update/delete database records. Do not point them at production.

## Database release workflow

1. Edit `backend/prisma/schema.prisma` only for an intentional schema change.
2. Generate a named development migration.
3. Review the generated SQL.
4. Commit the schema and migration directory together.
5. Run backend checks and DB integration tests against a disposable database.
6. In deployment, run `pnpm db:migrate:deploy` once using `DIRECT_URL`.
7. Start the new API and wait for `/health/ready` before shifting traffic.

Do not edit migration files that have already been applied to a shared database.

## Production configuration summary

Before a real deployment:

- Use unique high-entropy JWT and cursor secrets from a secret manager.
- Use HTTPS and `COOKIE_SECURE=true`.
- Configure exact frontend origins in `ALLOWED_ORIGINS`.
- Set `TRUST_PROXY=true` only behind a trusted proxy that normalizes forwarding headers.
- Use Neon's pooled URL for runtime and direct URL for migrations.
- Apply migrations once as a release job.
- Restrict `/metrics` to monitoring infrastructure.
- Replace demo accounts and credentials.
- Configure Cloudinary or remove/disable image-upload UI.
- Store frontend `BACKEND_URL` for the production API destination.
- Run all frontend/backend quality gates and DB integration tests.
- Validate backup/restore, alerting, log aggregation, and rollback procedures.

See [backend production and Docker guidance](backend/README.md#production-and-docker) and [frontend production build guidance](frontend/README.md#production-build).

## Repository structure

```text
buddy-script/
├── .github/workflows/          Continuous-integration workflows
├── annals/                    Supplied reference HTML/assets (gitignored)
├── backend/
│   ├── prisma/                Schema, migrations, and demo seed
│   ├── src/                   API application source
│   ├── tests/                 HTTP and database integration tests
│   └── README.md              Backend setup and reference
├── frontend/
│   ├── public/                Local assets and fonts
│   ├── src/                   Next.js routes and features
│   └── README.md              Frontend setup and reference
├── .gitignore
└── README.md                  Full-stack guide
```

## Implemented and presentational features

Functional flows include registration, login/logout, Remember Me session mode, protected session bootstrap, posts, post visibility, image upload, typed reactions, comments, one-level replies, editing, deletion, and cursor-based loading.

Google authentication, Forgot Password, search, stories, sharing, following, video, event, article, messaging, and notification actions are currently presentational. Treat them as product gaps if they are required for the intended launch scope.

## Troubleshooting

### Backend install fails before dependencies finish

Create and configure `backend/.env` first. Prisma generation runs during `postinstall` and requires a database URL.

### API starts but the frontend cannot sign in

- Confirm `http://localhost:4000/health/ready` succeeds.
- Confirm frontend `BACKEND_URL=http://localhost:4000`.
- Confirm backend `ALLOWED_ORIGINS=http://localhost:3000`.
- Use `COOKIE_SECURE=false` for plain HTTP localhost.
- Restart both servers after environment changes.

### Seed command cannot find the database

The seed uses `DATABASE_URL` and then `DATABASE_URL_DEV`; it does not use `DIRECT_URL` by itself.

### Image uploads fail

Configure all three Cloudinary credentials in the backend, restart it, and use a JPG/JPEG, PNG, or WebP image within the byte limit.

### A different frontend port is needed

Start Next.js with:

```bash
cd frontend
pnpm dev -- --port 3001
```

Then add `http://localhost:3001` to backend `ALLOWED_ORIGINS`.
