# BuddyScript API

Production-oriented Express and TypeScript API for BuddyScript. The completed delivery covers runtime foundations, Neon/PostgreSQL persistence, authentication, posts, comments, signed image uploads, bounded caching, observability, tests, and deployment assets.

## Requirements

- Node.js 22 or newer
- pnpm 11

## Local setup

1. Copy `.env.example` to `.env` and set local values.
2. Install dependencies with `pnpm install`.
3. Start the development server with `pnpm dev`.

The API listens on `http://localhost:4000` by default.

## Commands

- `pnpm dev` - watch mode
- `pnpm lint` - strict ESLint checks
- `pnpm typecheck` - TypeScript without emission
- `pnpm test` - unit and HTTP contract tests
- `pnpm build` - compile production output to `dist`
- `pnpm start` - run the compiled production output
- `pnpm check` - lint, type-check, test, and build
- `pnpm db:generate` - regenerate the Prisma client
- `pnpm db:migrate:deploy` - apply reviewed production migrations using `DIRECT_URL`
- `pnpm db:seed` - load deterministic development data

## Platform endpoints

- `GET /health/live`
- `GET /health/ready`
- `GET /docs/openapi.json`
- `GET /metrics` (restrict to the monitoring network in production)

Every API response includes a request ID and timestamp. Send a valid `X-Request-Id` to correlate requests across a reverse proxy and the application.

## Runtime design

- Configuration is parsed once and validated before the server binds a port.
- Logs are structured and redact authorization, cookies, tokens, passwords, and database URLs.
- The service stops accepting traffic before graceful shutdown and enforces a shutdown deadline.
- Liveness represents process health; readiness includes database connectivity.
- Business modules remain separated from HTTP and infrastructure concerns.

## Database foundation

- The running API uses the pooled Neon `DATABASE_URL`; Prisma CLI operations use the non-pooled `DIRECT_URL`.
- `DATABASE_URL_DEV` remains a temporary compatibility fallback for local development.
- UUIDv7 application IDs, keyset-oriented composite indexes, partial feed indexes, bounded page sizes, and denormalized counters support high-read workloads.
- Database constraints protect normalized emails, post content, image metadata, non-negative counters, unique reactions, and one-level comment replies.
- Generated Prisma code is not committed; `postinstall` and `pnpm db:generate` recreate it deterministically.
- Demo seed accounts use Argon2id hashes for the shared interview credential `Password123!`; replace these accounts before adapting the system beyond the interview deployment.

The interview deployment includes a production-capable, non-destructive demo seed. See the [demo database inventory](docs/demo-seed.md) for every account, credential, post scenario, stock asset, and rerun guarantee.

Run schema integration tests explicitly against the configured development database:

```bash
RUN_DATABASE_TESTS=true pnpm test
```

## Authentication

- Access JWTs default to 10 minutes; refresh JWTs default to 30 days.
- Both are delivered in HTTP-only, SameSite=Strict cookies. Production uses `Secure` cookie prefixes; local development uses non-prefixed names because browsers require HTTPS for `__Host-`/`__Secure-` cookies.
- Refresh tokens rotate once. Reuse or concurrent replay revokes the entire token family.
- Only SHA-256 refresh-token hashes and hashed client metadata are stored in PostgreSQL.
- Mutating authenticated routes require the readable CSRF cookie value in `X-CSRF-Token`, in addition to strict production Origin/Referer checks.
- Login failures are deliberately generic and unknown users still incur an Argon2 verification.
- Current in-memory rate limits are single-process; the store is replaced with Redis during horizontal scale-out.

Authentication endpoints are available under `/api/v1/auth`: `register`, `login`, `refresh`, `logout`, `logout-all`, and `me`.

## Posts and feed

- `GET /api/v1/posts` returns public posts plus the authenticated user's private posts, newest first.
- `POST /api/v1/posts` creates a text and/or verified-image post with `public` or `private` visibility.
- `POST|DELETE /api/v1/posts/:postId/like` are idempotent and update the denormalized count in the same transaction.
- `GET /api/v1/posts/:postId/likers` returns bounded liker identities without email addresses.
- Feed, liker, and later engagement pagination use HMAC-signed `(createdAt, id)` keyset cursors. Default page size is 20 and maximum is 50.
- Feed queries return two bounded root-comment previews and viewer-specific reaction state; they never load unrestricted comment trees.
- Visibility predicates are part of database queries. An inaccessible private post returns the same 404 response as a missing post.

## Comments and replies

- `GET|POST /api/v1/posts/:postId/comments` lists or creates root comments.
- `GET|POST /api/v1/comments/:commentId/replies` lists or creates one-level replies.
- `POST|DELETE /api/v1/comments/:commentId/like` toggles reactions idempotently.
- `GET /api/v1/comments/:commentId/likers` returns bounded liker identities.
- Replies cannot be nested further. Every lookup applies the parent post's visibility predicate, and counter mutations are transactional.

## Image uploads

- `POST /api/v1/uploads/signature` returns a short-lived, owner-scoped Cloudinary signature.
- Browsers upload directly to Cloudinary; the API never buffers image bytes.
- Post creation verifies the Cloudinary result signature, account URL, owner folder, format, byte size, and dimensions before persisting metadata.
- Images are optional, and a post must contain text, a verified image, or both.

## Scale and observability

- The local NodeCache adapter caches only the first public-feed page's post IDs for a few seconds. It uses single-flight loading, immutable values, bounded keys, and invalidation after public post creation.
- Viewer-specific fields and private posts are always hydrated through authoritative visibility-scoped database queries. Redis is the intended distributed cache and rate-limit store when multiple API replicas are deployed.
- Prometheus process/default metrics and labeled HTTP latency/count metrics are exposed at `/metrics`.
- The k6 scenario in `load/k6-feed.js` exercises authenticated feed reads and enforces latency/error thresholds.

## Deployment

Build the multi-stage image with `docker build -t buddyscript-api .`. Run migrations as a release step, not in every application replica. The CI workflow starts PostgreSQL, applies migrations and seed data, then runs validation, lint, types, tests, and the production build.

Operational details are in [architecture](docs/architecture.md), [security](docs/security.md), [deployment](docs/deployment.md), and [frontend integration](docs/frontend-integration.md).
