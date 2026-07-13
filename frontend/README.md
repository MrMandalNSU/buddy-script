# BuddyScript frontend

Next.js implementation of the supplied BuddyScript authentication and feed designs, integrated with the Express/Neon backend.

## Run locally

Create `.env.local` from `.env.example`, then run both applications in separate terminals:

```bash
# backend
cd backend
pnpm dev

# frontend
cd frontend
pnpm dev
```

`BACKEND_URL=http://localhost:4000` is server-only. Next.js rewrites same-origin `/api/v1/*` traffic to Express, so JWTs remain in backend-owned HTTP-only cookies. Open `http://localhost:3000` and use `alex@buddy.test` / `Password123!` after running the backend seed.

## Architecture

- `src/shared/api` validates response envelopes, attaches CSRF and request IDs, enforces timeouts, and coalesces access-token refresh.
- `src/features/auth` owns session bootstrap, authentication state, validation, guards, and backend payload mapping.
- `src/features/feed` owns typed API repositories, cursor pagination, TanStack Query caches, optimistic reactions, comments/replies, likers, and signed Cloudinary uploads.
- `src/app` composes providers and routes. It contains no credential-processing API routes.

Tokens are never exposed to JavaScript or browser storage. Mutations read the backend-issued CSRF cookie immediately before each request. The feed uses bounded independent pagination for posts, comments, replies, and likers.

## Commands

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

Stories, search, sharing, following, video, event, article, messaging, and notifications remain presentational as allowed by the assignment.
