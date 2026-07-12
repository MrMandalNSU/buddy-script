# BuddyScript frontend

Next.js implementation of the supplied BuddyScript login, registration, and feed designs.

## Run locally

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`. Any syntactically valid email and non-empty password can be used by the mock login. Registration validates all fields required by the selection task.

## Architecture

- `src/app` contains App Router pages, mock authentication route handlers, and the Next.js request proxy.
- `src/features/auth` owns authentication models, validation, UI, and the replaceable `AuthService` contract.
- `src/features/feed` owns feed models, immutable transformations, UI, and the replaceable `FeedRepository` contract.
- `src/shared` contains cross-feature primitives.

The feed adapter is intentionally in-memory and resets when the browser reloads. Authentication is also a frontend demonstration: its HTTP-only cookie protects navigation but is not a secure credential system. A production backend must validate credentials, issue signed/opaque sessions, enforce authorization, persist data, store uploaded images, paginate the feed, rate-limit mutations, and apply CSRF and abuse protections. The service/repository interfaces isolate that later integration.

## Commands

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

## Implemented scope

The complete supplied visual shell is represented. Required interactions include mock login/registration/logout, protected routing, public/private posts, text and image creation, newest-first ordering, post/comment/reply likes, nested comments and replies, liker lists, and persisted light/dark theme. Supplied out-of-scope controls remain visibly and accessibly disabled.
