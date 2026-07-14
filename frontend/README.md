# BuddyScript Frontend

BuddyScript's frontend is a Next.js application that implements the authentication and social-feed interfaces. It communicates with the Express API through a same-origin Next.js rewrite, keeps access and refresh tokens in backend-owned HTTP-only cookies, and validates every API response before it reaches the UI.

## Contents

- [Technology](#technology)
- [Prerequisites](#prerequisites)
- [Complete local setup](#complete-local-setup)
- [Frontend environment variables](#frontend-environment-variables)
- [Available routes](#available-routes)
- [Commands](#commands)
- [Testing and validation](#testing-and-validation)
- [Architecture](#architecture)
- [Authentication and API behavior](#authentication-and-api-behavior)
- [Image uploads](#image-uploads)
- [Production build](#production-build)
- [Troubleshooting](#troubleshooting)

## Technology

- Next.js 16 with the App Router and Turbopack
- React 19 and TypeScript
- TanStack Query for server-state caching and mutations
- Zod for response validation
- Vitest, Testing Library, and jsdom for component and unit tests
- ESLint with the Next.js ruleset
- Plain responsive CSS and local SVG/image assets

## Prerequisites

For the frontend by itself:

- Node.js 20.9 or newer
- pnpm 11.7.0

For the complete BuddyScript stack, use Node.js 22 or newer because the backend requires it.

If pnpm is not active, enable the package-manager version declared in `package.json`:

```bash
corepack enable
corepack prepare pnpm@11.7.0 --activate
```

The frontend and backend are separate pnpm projects with separate lockfiles. Install dependencies inside each directory rather than at the repository root.

## Complete local setup

### 1. Configure and start the backend

Follow the full [backend setup guide](../backend/README.md). At minimum, the backend needs:

1. A configured `backend/.env` file.
2. A reachable PostgreSQL/Neon database.
3. The committed Prisma migrations applied.
4. The generated Prisma client.
5. The API running on `http://localhost:4000`.

The backend quick-start commands are:

```bash
cd backend
pnpm install
pnpm db:migrate:deploy
pnpm db:generate
pnpm db:seed
pnpm dev
```

Create and configure `backend/.env` before running `pnpm install`; the backend postinstall script runs Prisma generation and therefore reads the database configuration.

### 2. Create the frontend environment file

From the repository root, on macOS or Linux:

```bash
cd frontend
cp .env.example .env.local
```

On Windows PowerShell:

```powershell
Set-Location frontend
Copy-Item .env.example .env.local
```

The default file is suitable when the API runs on port 4000:

```dotenv
NEXT_PUBLIC_APP_NAME=BuddyScript
BACKEND_URL=http://localhost:4000
```

### 3. Install and start the frontend

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The root route redirects to `/login` or `/feed` according to the current session.

If the backend demo seed was applied, use:

```text
Email:    alex@buddy.test
Password: Password123!
```

All seeded accounts use the same demo password. These credentials are development fixtures only.

### 4. Verify the connection

- Open `http://localhost:4000/health/ready` and confirm that the API reports ready.
- Open `http://localhost:3000/login` and sign in.
- Confirm that `/feed` loads seeded posts.
- Create a text post to verify cookies, CSRF handling, and the API rewrite.

## Frontend environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `BACKEND_URL` | No | `http://localhost:4000` | Server-side destination for the `/api/v1/*` Next.js rewrite. It must be an absolute URL. |
| `NEXT_PUBLIC_APP_NAME` | No | `BuddyScript` in `.env.example` | Public application name reserved for frontend branding/configuration. |

`BACKEND_URL` is intentionally not prefixed with `NEXT_PUBLIC_`; browser code should call the same-origin `/api/v1/*` paths rather than the API host directly.

Restart `pnpm dev` after changing `.env.local` or `BACKEND_URL`.

## Available routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Public | Resolves the current session and redirects to login or feed. |
| `/login` | Public | Login form with optional persistent-session preference. |
| `/register` | Public | Registration form with name, consent, password policy, and confirmation UX. |
| `/feed` | Authenticated | Posts, visibility, image uploads, reactions, comments, replies, and responsive feed UI. |

`AuthGuard` protects `/feed`. `AuthProvider` checks `/api/v1/auth/me` during session bootstrap.

## Commands

Run these from `frontend/`:

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the Next.js development server on port 3000. |
| `pnpm build` | Create an optimized production build. |
| `pnpm start` | Run the previously built production application. |
| `pnpm lint` | Run ESLint across the frontend. |
| `pnpm typecheck` | Run TypeScript without emitting files. |
| `pnpm test` | Run all Vitest tests once. |
| `pnpm test:watch` | Run Vitest in watch mode. |

To use another frontend port:

```bash
pnpm dev -- --port 3001
```

When changing the frontend origin, also update `ALLOWED_ORIGINS` in `backend/.env`, for example `ALLOWED_ORIGINS=http://localhost:3001`.

## Testing and validation

Run the complete frontend quality gate:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Tests cover:

- Login and registration validation
- Password requirements, confirmation, and visibility controls
- Authentication request mapping, including Remember Me
- Auth layout and reference artwork
- API envelopes, CSRF, and session refresh behavior
- Feed rendering and responsive structure
- Composer visibility selection and post creation
- Typed reactions and optimistic cache updates
- Comment/reply creation, editing, deletion, previews, and expansion
- Menus, dialogs, and accessibility-oriented interactions

Vitest uses `src/test/setup.ts`, the jsdom environment, and the `@` alias mapped to `src/`.

## Architecture

```text
frontend/
├── public/
│   ├── assets/                 Static reference images and icons
│   └── fonts/                  Local Poppins font files
├── src/
│   ├── app/
│   │   ├── feed/               Protected feed route
│   │   ├── login/              Login route
│   │   ├── register/           Registration route
│   │   ├── globals.css         Auth and feed design system
│   │   └── providers.tsx       Query and authentication providers
│   ├── features/
│   │   ├── auth/               Auth state, forms, validation, and service
│   │   └── feed/               Feed types, schemas, repository, upload, and UI
│   ├── shared/
│   │   ├── api/                Same-origin API client and envelope schemas
│   │   └── result.ts           Result type shared by feature services
│   └── test/                   Test setup
├── next.config.ts              Rewrite, image, and security-header configuration
├── vitest.config.ts            Frontend test configuration
└── package.json                Scripts and dependency versions
```

### State ownership

- TanStack Query owns remote feed, comments, replies, and reaction data.
- `AuthProvider` owns the authenticated user and session-bootstrap state.
- Forms use local React state and submit through typed feature services.
- Optimistic reaction mutations update cached feed data and roll back on failure.

### Response validation

The API client validates the common success/error envelope and feature payloads with Zod. A successful HTTP response containing an unexpected body becomes an `INVALID_RESPONSE` frontend error instead of silently entering application state.

## Authentication and API behavior

Next.js rewrites:

```text
/api/v1/:path*  ->  BACKEND_URL/api/v1/:path*
```

This design provides several important properties:

- Browser requests remain same-origin.
- Access and refresh JWTs stay in HTTP-only cookies.
- The frontend never stores tokens in local storage or exposes them to React code.
- Mutating requests read the backend CSRF cookie immediately before sending and attach `X-CSRF-Token`.
- Each request receives a client-generated `X-Request-Id`.
- A protected request that receives `401` performs one coalesced refresh attempt before retrying once.
- Requests time out after 15 seconds unless a feature supplies another timeout.

Registration passwords require at least eight characters, one uppercase character, and one punctuation/symbol character. The frontend mirrors the rule for live UX, while the backend remains authoritative.

## Image uploads

Post images use a signed direct-to-Cloudinary flow:

1. The frontend requests `/api/v1/uploads/signature`.
2. The browser uploads the file directly to Cloudinary and reports progress.
3. The signed Cloudinary result is included in the post request.
4. The backend verifies ownership, URL, signature, format, dimensions, and byte size before persistence.

Supported formats are JPG/JPEG, PNG, and WebP. The default maximum is 5 MB.

Cloudinary is optional on the backend. Without all three Cloudinary credentials, text posts still work, but image signature/upload requests are unavailable.

## Production build

Set the production backend origin before building or starting:

```dotenv
BACKEND_URL=https://api.example.com
```

Then run:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

The deployment must preserve HTTPS and a same-site routing arrangement compatible with the backend cookies and CSRF origin checks. If the browser-facing frontend origin changes, add that exact origin to backend `ALLOWED_ORIGINS`.

`next.config.ts` supplies CSP, referrer policy, permissions policy, content-type protection, Cloudinary image allow-listing, and the API rewrite.

## Troubleshooting

### Login succeeds in the API but the browser returns to `/login`

- Access the app through `http://localhost:3000`, not through a different hostname unless it is configured.
- Keep `COOKIE_SECURE=false` for plain HTTP local development.
- Confirm `ALLOWED_ORIGINS` includes the exact frontend origin.
- Clear stale local BuddyScript cookies after changing cookie mode or hostnames.

### `/api/v1/*` returns a proxy or connection error

- Confirm the backend is running on the URL in `BACKEND_URL`.
- Check `http://localhost:4000/health/ready`.
- Restart Next.js after editing `.env.local`.
- Ensure `BACKEND_URL` includes `http://` or `https://`; relative URLs are rejected at startup.

### The feed opens but image upload fails

- Confirm `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` are all present in `backend/.env`.
- Confirm the selected file is JPG/JPEG, PNG, or WebP and within the configured byte limit.
- Verify that browser CSP/network tooling is not blocking `https://api.cloudinary.com`.

### Requests fail with `403 FORBIDDEN`

- Check the backend `ALLOWED_ORIGINS` value.
- Use the frontend rewrite instead of calling the backend directly from browser code.
- For mutations, verify that cookies are enabled so the CSRF cookie can be read and echoed.

### Port 3000 is already in use

Start on another port and update the backend origin allow-list:

```bash
pnpm dev -- --port 3001
```

### UI-only controls do not perform an action

Google authentication, Forgot Password, stories, search, sharing, following, video, event, article, messaging, and notifications are intentionally presentational. Core authentication, post, visibility, reaction, comment, reply, editing, deletion, and image-upload flows are functional.
