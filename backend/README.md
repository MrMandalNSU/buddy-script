# BuddyScript API

BuddyScript's backend is a production-oriented Express and TypeScript API backed by PostgreSQL/Neon through Prisma. It provides cookie-based authentication, rotating refresh sessions, CSRF protection, posts, visibility controls, typed reactions, comments, one-level replies, signed Cloudinary uploads, caching, metrics, structured logging, and health checks.

## Contents

- [Technology](#technology)
- [Prerequisites](#prerequisites)
- [First-time local setup](#first-time-local-setup)
- [Environment variables](#environment-variables)
- [Database and Prisma workflows](#database-and-prisma-workflows)
- [Demo data](#demo-data)
- [Running the API](#running-the-api)
- [Commands](#commands)
- [Tests](#tests)
- [API overview](#api-overview)
- [Authentication and security](#authentication-and-security)
- [Images and Cloudinary](#images-and-cloudinary)
- [Project structure](#project-structure)
- [Production and Docker](#production-and-docker)
- [Troubleshooting](#troubleshooting)

## Technology

- Node.js, TypeScript, and native ESM
- Express 5
- PostgreSQL/Neon
- Prisma 7 with the Neon adapter
- Argon2id password hashing
- JOSE JWT signing and verification
- Zod request/environment validation
- Pino structured logging
- Prometheus metrics through `prom-client`
- NodeCache for the bounded single-process public-feed cache
- Vitest and Supertest
- Cloudinary signed direct uploads

## Prerequisites

- Node.js 22 or newer
- pnpm 11.7.0
- A PostgreSQL database; Neon is the supported/recommended configuration
- A pooled runtime URL and preferably a direct migration URL
- Optional Cloudinary account for post image uploads

No database Docker Compose file is included. The current runtime uses `@prisma/adapter-neon`, so Neon is the simplest supported local-development database.

Enable the declared pnpm version if necessary:

```bash
corepack enable
corepack prepare pnpm@11.7.0 --activate
```

## First-time local setup

### 1. Create `backend/.env` before installing

Prisma generation runs during `pnpm install`, and `prisma.config.ts` requires a database URL. Create the environment file first.

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

### 2. Add database URLs

For Neon, use the pooled hostname for application traffic and the direct hostname for migrations:

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@YOUR-ENDPOINT-pooler.REGION.aws.neon.tech/DATABASE?sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@YOUR-ENDPOINT.REGION.aws.neon.tech/DATABASE?sslmode=require"
```

`DATABASE_URL_DEV` is a compatibility fallback and is not needed when `DATABASE_URL` is set.

URL precedence is important:

| Consumer | URL precedence |
| --- | --- |
| Running API | `DATABASE_URL`, then `DATABASE_URL_DEV` |
| Prisma CLI/migrations | `DIRECT_URL`, then `DATABASE_URL`, then `DATABASE_URL_DEV` |
| Seed script and DB integration tests | `DATABASE_URL`, then `DATABASE_URL_DEV` |

Because the seed script does not use `DIRECT_URL`, always configure `DATABASE_URL` or `DATABASE_URL_DEV` before running `pnpm db:seed`.

### 3. Generate application secrets

The API cannot start without the two JWT secrets and the cursor-signing secret. Each must contain at least 32 characters. Generate a fresh value with:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Run the command three times and assign separate values:

```dotenv
JWT_ACCESS_SECRET="..."
JWT_REFRESH_SECRET="..."
CURSOR_SIGNING_SECRET="..."
```

Never commit `.env` or reuse local secrets in production.

### 4. Complete the local environment

A minimal local configuration looks like:

```dotenv
NODE_ENV=development
PORT=4000
LOG_LEVEL=debug
TRUST_PROXY=false
ALLOWED_ORIGINS=http://localhost:3000
SHUTDOWN_TIMEOUT_MS=10000

JWT_ACCESS_SECRET="REPLACE_WITH_A_UNIQUE_SECRET_OF_AT_LEAST_32_CHARACTERS"
JWT_REFRESH_SECRET="REPLACE_WITH_ANOTHER_UNIQUE_SECRET_OF_AT_LEAST_32_CHARACTERS"
JWT_ISSUER=buddyscript-api
JWT_AUDIENCE=buddyscript-web
JWT_KEY_ID=primary-2026
ACCESS_TOKEN_TTL_SECONDS=600
REFRESH_TOKEN_TTL_SECONDS=2592000
COOKIE_SECURE=false
CURSOR_SIGNING_SECRET="REPLACE_WITH_A_THIRD_UNIQUE_SECRET_OF_AT_LEAST_32_CHARACTERS"

DATABASE_URL="YOUR_POOLED_NEON_URL"
DIRECT_URL="YOUR_DIRECT_NEON_URL"

CACHE_ENABLED=true
CACHE_PUBLIC_FEED_TTL_SECONDS=5
CACHE_MAX_KEYS=1000
```

Cloudinary values may be omitted when only text posts are needed.

### 5. Install dependencies

```bash
pnpm install
```

`postinstall` regenerates the Prisma client into `src/generated/prisma`.

### 6. Validate and apply committed migrations

For a new development database or a fresh checkout:

```bash
pnpm db:validate
pnpm db:migrate:deploy
pnpm db:generate
```

`db:migrate:deploy` applies every committed migration that has not yet run. It does not create a new migration or attempt an interactive schema reset.

### 7. Seed optional demo data

```bash
pnpm db:seed
```

The seed is deterministic and safe to rerun: it upserts known demo records and recalculates denormalized counters.

### 8. Start and verify the API

```bash
pnpm dev
```

The default API URL is `http://localhost:4000`.

Verify:

```text
http://localhost:4000/health/live
http://localhost:4000/health/ready
http://localhost:4000/docs/openapi.json
http://localhost:4000/metrics
```

Then configure and run the [frontend](../frontend/README.md).

## Environment variables

### Server

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `NODE_ENV` | No | `development` | `development`, `test`, or `production`. |
| `PORT` | No | `4000` | HTTP listening port, from 1 through 65535. |
| `LOG_LEVEL` | No | `info` | Pino level: `fatal`, `error`, `warn`, `info`, `debug`, `trace`, or `silent`. |
| `TRUST_PROXY` | No | `false` | Enable only when the API is behind a trusted reverse proxy. |
| `ALLOWED_ORIGINS` | No | `http://localhost:3000` | Comma-separated exact browser origins accepted by CORS and production origin checks. |
| `SHUTDOWN_TIMEOUT_MS` | No | `10000` | Graceful-shutdown deadline, between 1000 and 60000 ms. |

### Authentication and cookies

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `JWT_ACCESS_SECRET` | Yes | None | Access-token HMAC secret, at least 32 characters. |
| `JWT_REFRESH_SECRET` | Yes | None | Refresh-token HMAC secret, at least 32 characters and different from the access secret. |
| `JWT_ISSUER` | No | `buddyscript-api` | JWT issuer claim. |
| `JWT_AUDIENCE` | No | `buddyscript-web` | JWT audience claim. |
| `JWT_KEY_ID` | No | `primary-2026` | JWT key identifier. |
| `ACCESS_TOKEN_TTL_SECONDS` | No | `600` | Access lifetime; allowed range is 60–3600 seconds. |
| `REFRESH_TOKEN_TTL_SECONDS` | No | `2592000` | Refresh lifetime; allowed range is 3600–31536000 seconds. |
| `COOKIE_SECURE` | No | `true` in production, otherwise `false` | Require HTTPS and secure cookie names. Keep `false` for plain HTTP localhost. |
| `CURSOR_SIGNING_SECRET` | Yes | None | HMAC secret for opaque pagination cursors, at least 32 characters. |

### Database

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Recommended/Runtime | Pooled Neon URL used by the API, seed, and DB integration tests. |
| `DIRECT_URL` | Recommended/Migrations | Non-pooled URL preferred by Prisma CLI migration commands. |
| `DATABASE_URL_DEV` | Optional fallback | Used when `DATABASE_URL` is absent; retained for compatibility. |

At least one database URL must be available. The running API specifically requires `DATABASE_URL` or `DATABASE_URL_DEV`.

### Cloudinary

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `CLOUDINARY_CLOUD_NAME` | Optional | None | Cloudinary account cloud name. |
| `CLOUDINARY_API_KEY` | Optional | None | Cloudinary public API key. |
| `CLOUDINARY_API_SECRET` | Optional | None | Cloudinary signing secret. |
| `CLOUDINARY_POST_FOLDER` | No | `buddyscript` | Root upload folder; letters, numbers, underscores, and hyphens only. |
| `CLOUDINARY_MAX_IMAGE_BYTES` | No | `5000000` | Maximum image size; allowed range is 100 KB–20 MB. |

Set all three Cloudinary credentials together. If any are missing, the upload router is not mounted and image-backed post mutations return an unavailable/configuration error. Text-only posts remain functional.

### Cache

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `CACHE_ENABLED` | No | `true` | Enable the local first-page public-feed ID cache. |
| `CACHE_PUBLIC_FEED_TTL_SECONDS` | No | `5` | Cache lifetime from 1–60 seconds. |
| `CACHE_MAX_KEYS` | No | `1000` | Local cache key limit from 10–100000. |

## Database and Prisma workflows

### Validate the Prisma schema

```bash
pnpm db:validate
```

### Regenerate the Prisma client

Run after pulling schema changes, changing `schema.prisma`, or resolving generated-client type errors:

```bash
pnpm db:generate
```

Generated files are written to `src/generated/prisma`.

### Apply existing migrations locally

Use this after pulling committed migrations:

```bash
pnpm db:migrate:deploy
```

### Create a migration during schema development

1. Edit `prisma/schema.prisma`.
2. Create and apply a named development migration:

```bash
pnpm db:migrate:dev -- --name describe_the_change
```

3. Review the generated SQL in `prisma/migrations/<timestamp>_describe_the_change/migration.sql`.
4. Regenerate and validate:

```bash
pnpm db:generate
pnpm db:validate
pnpm typecheck
pnpm test
```

Commit the schema and migration directory together. Do not use `migrate dev` against production.

### Apply migrations in production

Run once as a release job before or alongside a compatible deployment:

```bash
pnpm db:migrate:deploy
```

Use `DIRECT_URL` for this command. Do not run migrations independently in every API replica.

### Check migration status

```bash
pnpm exec prisma migrate status
```

### Inspect data with Prisma Studio

```bash
pnpm db:studio
```

Studio uses the Prisma CLI URL precedence described above. Treat production access as privileged access.

### Current migrations

The committed migration history currently includes:

- Initial users, sessions, posts, comments, likes, constraints, counters, and indexes
- Typed post/comment reactions
- Persistent versus browser-session refresh-session mode

Never edit a migration that has already been applied to a shared database. Add a new forward migration instead.

## Demo data

Seed with:

```bash
pnpm db:seed
```

Primary demo login:

```text
Email:    alex@buddy.test
Password: Password123!
```

The seed creates multiple users, public/private posts, stock images, comments, replies, and all supported reaction types. Every seeded account uses `Password123!`.

The script:

- Uses stable UUIDs and upserts known records
- Hashes the shared demo password with Argon2id
- Preserves unrelated records
- Recomputes post/comment denormalized counters
- Can be rerun to restore deterministic demo records

Never use the deterministic demo accounts or shared credential in a production system.

## Running the API

### Development watch mode

```bash
pnpm dev
```

`tsx watch` restarts the API when TypeScript source files change.

### Production-style local run

```bash
pnpm build
pnpm start
```

The build emits native ESM JavaScript into `dist/`.

### Readiness behavior

The server verifies the database connection before listening. `/health/ready` reports readiness only after that check succeeds and becomes unready during graceful shutdown.

## Commands

Run these from `backend/`:

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start TypeScript watch mode. |
| `pnpm build` | Compile production output to `dist/`. |
| `pnpm start` | Run `dist/server.js`. |
| `pnpm lint` | Run strict ESLint checks. |
| `pnpm typecheck` | Run TypeScript without emitting files. |
| `pnpm test` | Run unit and HTTP contract tests once. |
| `pnpm test:watch` | Run tests in watch mode. |
| `pnpm check` | Run lint, typecheck, tests, and build in sequence. |
| `pnpm db:generate` | Generate the Prisma client. |
| `pnpm db:validate` | Validate Prisma schema/configuration. |
| `pnpm db:migrate:dev` | Create/apply migrations during development. |
| `pnpm db:migrate:deploy` | Apply already committed migrations. |
| `pnpm db:seed` | Upsert deterministic demo data. |
| `pnpm db:studio` | Open Prisma Studio. |

## Tests

### Default suite

```bash
pnpm test
```

The default run includes unit, schema, cookie, security, service, cache, and non-database HTTP contract tests. Database suites are skipped unless explicitly enabled.

### Database integration suite

Use a dedicated development/test Neon branch or disposable database. Integration tests create, update, and delete records.

On macOS or Linux:

```bash
RUN_DATABASE_TESTS=true pnpm test
```

On Windows PowerShell:

```powershell
$env:RUN_DATABASE_TESTS = "true"
pnpm test
Remove-Item Env:RUN_DATABASE_TESTS
```

The database must already have all committed migrations applied. Tests use `DATABASE_URL` and then `DATABASE_URL_DEV`; they do not use `DIRECT_URL`.

### Complete quality gate

```bash
pnpm check
pnpm db:validate
```

## API overview

All business endpoints are under `/api/v1` and return the common success/error envelope with a request ID and timestamp.

### Platform endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health/live` | Process liveness. |
| `GET` | `/health/ready` | Database-backed readiness. |
| `GET` | `/docs/openapi.json` | OpenAPI document. |
| `GET` | `/metrics` | Prometheus metrics. Restrict in production. |

### Authentication

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/auth/register` | Create an account and persistent session. |
| `POST` | `/api/v1/auth/login` | Login; accepts optional `remember`, defaulting to `true`. |
| `POST` | `/api/v1/auth/refresh` | Rotate refresh token and renew session cookies. |
| `POST` | `/api/v1/auth/logout` | Revoke the current refresh session. |
| `POST` | `/api/v1/auth/logout-all` | Revoke all sessions for the current user. |
| `GET` | `/api/v1/auth/me` | Return the authenticated account. |

Registration password policy: 8–128 characters, at least one uppercase letter, and at least one punctuation/symbol character. Login intentionally accepts historical passwords without applying the registration-strength rule.

### Posts and reactions

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/posts` | Cursor-paginated visible feed. |
| `POST` | `/api/v1/posts` | Create a public/private text and/or verified-image post. |
| `PATCH` | `/api/v1/posts/:postId` | Edit an owned post. |
| `DELETE` | `/api/v1/posts/:postId` | Delete an owned post. |
| `POST/DELETE` | `/api/v1/posts/:postId/like` | Compatibility like toggle. |
| `PUT/DELETE` | `/api/v1/posts/:postId/reaction` | Set/remove a typed reaction. |
| `GET` | `/api/v1/posts/:postId/likers` | Paginated liker identities. |
| `GET` | `/api/v1/posts/:postId/reactors` | Paginated typed reactors. |

### Comments and replies

| Method | Path | Purpose |
| --- | --- | --- |
| `GET/POST` | `/api/v1/posts/:postId/comments` | List/create root comments. |
| `GET/POST` | `/api/v1/comments/:commentId/replies` | List/create one-level replies. |
| `PATCH` | `/api/v1/comments/:commentId` | Edit an owned comment/reply. |
| `DELETE` | `/api/v1/comments/:commentId` | Delete according to author/post-owner permissions. |
| `POST/DELETE` | `/api/v1/comments/:commentId/like` | Compatibility like toggle. |
| `PUT/DELETE` | `/api/v1/comments/:commentId/reaction` | Set/remove a typed reaction. |
| `GET` | `/api/v1/comments/:commentId/likers` | Paginated liker identities. |
| `GET` | `/api/v1/comments/:commentId/reactors` | Paginated typed reactors. |

Replies cannot be nested beyond one level.

### Uploads

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/uploads/signature` | Return an owner-scoped signed Cloudinary upload request. |

## Authentication and security

- Access JWTs default to 10 minutes; refresh JWTs default to 30 days.
- JWTs are stored in HTTP-only, SameSite=Strict cookies.
- Production uses secure cookie prefixes; local HTTP uses non-prefixed cookie names.
- `remember=false` creates browser-session access, refresh, and CSRF cookies without `Expires`.
- Refresh tokens rotate once; replay revokes the token family.
- Only SHA-256 refresh-token hashes and hashed client metadata are persisted.
- Authenticated mutations require the readable CSRF cookie echoed in `X-CSRF-Token`.
- Production mutations also enforce allowed Origin/Referer values.
- Unknown-user login still performs an Argon2 verification and returns a generic error.
- Authentication, post, comment, and upload endpoints have rate limits.
- Logs redact authorization, cookie, token, password, and database URL fields.
- Pagination cursors are opaque, bounded, keyset-based, and HMAC signed.
- Private-post visibility checks are applied inside database queries.

## Images and Cloudinary

The API never buffers browser image bytes. It signs a short-lived owner-specific upload, then verifies the Cloudinary result before accepting post metadata.

Verification includes:

- Cloudinary signature
- Expected account hostname and HTTPS URL
- User-owned folder prefix
- JPG/JPEG, PNG, or WebP format
- Configured byte limit
- Positive dimensions no greater than 8000×8000

If an image is replaced or removed, the service attempts to delete the previous Cloudinary resource. Before a public launch, add a scheduled cleanup job that removes pending Cloudinary uploads older than the chosen retention period when their public IDs are not attached to a post.

## Project structure

```text
backend/
├── prisma/
│   ├── migrations/             Reviewed SQL migration history
│   ├── schema.prisma           Database models and indexes
│   ├── seed-data.ts            Deterministic demo fixtures
│   └── seed.ts                 Idempotent seed runner
├── src/
│   ├── config/                 Environment parsing and validation
│   ├── generated/prisma/       Generated Prisma client
│   ├── infrastructure/         Database, cache, logging, metrics, lifecycle
│   ├── middleware/             Request IDs, logs, origin guard, errors
│   ├── modules/
│   │   ├── auth/               Registration, login, tokens, sessions, cookies
│   │   ├── posts/              Feed, posts, visibility, reactions
│   │   ├── comments/           Comments, replies, reactions
│   │   └── uploads/            Cloudinary signatures and verification
│   ├── openapi/                OpenAPI document
│   ├── routes/                 Health, metrics, and docs endpoints
│   ├── shared/                 HTTP, errors, pagination, and types
│   ├── app.ts                  Express middleware composition
│   └── server.ts               Runtime wiring and graceful shutdown
├── tests/                      HTTP, DB integration, schema, and performance tests
├── docs/                       Architecture, security, seed, and deployment notes
├── load/k6-feed.js             Authenticated feed load scenario
├── Dockerfile                  Multi-stage production image
├── prisma.config.ts            Prisma CLI URL and seed configuration
└── package.json                Scripts and dependency versions
```

## Production and Docker

### Build and run directly

```bash
pnpm install --frozen-lockfile
pnpm db:migrate:deploy
pnpm build
NODE_ENV=production pnpm start
```

On Windows PowerShell, set `$env:NODE_ENV = "production"` before `pnpm start`.

Production requires HTTPS when `COOKIE_SECURE=true`. Keep the frontend and API in a same-site routing topology compatible with SameSite cookies and origin validation.

### Build the Docker image

The repository contains a multi-stage `Dockerfile`, but its dependency layer currently runs the `postinstall` Prisma generation step without supplying a database URL. Because `prisma.config.ts` requires a URL even for client generation, a clean Docker build will stop at `pnpm install` until the Dockerfile separates dependency installation from generation or supplies a build-safe Prisma configuration.

After that release gate is fixed, the intended command from `backend/` is:

```bash
docker build -t buddyscript-api .
```

Run the application image with the required environment values supplied by your platform. The image exposes port 4000 and includes a `/health/live` health check.

The runtime image intentionally contains the compiled server rather than the full migration workspace. Run `pnpm db:migrate:deploy` as a separate release job from a source/build environment before shifting traffic.

### Release order

1. Validate and build an immutable artifact.
2. Apply committed migrations once with `DIRECT_URL`.
3. Start the new API version.
4. Wait for `/health/ready`.
5. Shift traffic and monitor latency, errors, event-loop lag, and DB connections.

Migrations should be backward compatible for rolling releases. Prisma migrations are forward-only; prefer application rollback to a compatible image and explicit database recovery over automatic down migrations.

The current cache and rate-limit stores are process-local. Replace both with a shared store such as Redis before horizontal scaling if globally consistent limits/cache hit rates are required. Restrict `/metrics` at the private network or reverse-proxy layer, validate backup restoration, and keep a compatible previous application artifact for rollback.

## Troubleshooting

### `pnpm install` fails with a Prisma database URL error

Create `backend/.env` first and set `DIRECT_URL`, `DATABASE_URL`, or `DATABASE_URL_DEV`. `postinstall` evaluates `prisma.config.ts` while generating the client.

### API startup says database configuration is missing

The running API reads `DATABASE_URL` and then `DATABASE_URL_DEV`; `DIRECT_URL` alone is not enough for runtime or seed operations.

### API startup says JWT or cursor secrets are required

Set `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `CURSOR_SIGNING_SECRET`, each to a non-placeholder value of at least 32 characters.

### `pnpm db:seed` cannot find a database URL

Set `DATABASE_URL` or `DATABASE_URL_DEV`. The seed intentionally does not use `DIRECT_URL`.

### Prisma migration fails against Neon

- Confirm `DIRECT_URL` uses the non-pooler hostname.
- Confirm `sslmode=require` is present when required by the connection string.
- Run `pnpm exec prisma migrate status` to inspect applied migrations.
- Do not edit an already applied migration; create a new migration.

### Frontend requests receive CORS or origin errors

Set `ALLOWED_ORIGINS` to the exact browser origin, including scheme and port. Multiple values are comma-separated:

```dotenv
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

### Cookies are not set locally

Use `COOKIE_SECURE=false` with plain `http://localhost`. Secure cookies require HTTPS.

### Image upload endpoint returns 404 or 503

Set all three Cloudinary credentials and restart the API. The upload router is mounted only when Cloudinary is fully configured.

### `/health/live` works but `/health/ready` fails

The process is alive but has not established database readiness. Check `DATABASE_URL`, Neon status, credentials, network access, and server logs.

### Database integration tests are skipped

Set `RUN_DATABASE_TESTS=true` and provide `DATABASE_URL` or `DATABASE_URL_DEV`. Apply migrations to that dedicated test database first.
