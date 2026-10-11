# Deepn — web app

The desktop web app (task-475 onwards): a single-page app on **Vite, React 19 and React Router**,
following the owner's direction (`mobile-design-mockups/web_app_owner_direction/README.md`, which
is authoritative screen by screen). The decision behind it is
`docs/research/task-424-website-and-browser-extension/README.md`, *Owner Validation*, as refined by
`complement-response-2026-10-11.md`.

- **Shared code** comes from `packages/core` (`@media-summarizer/core/...`): API types, the API
  client, the translation catalogues and their runtime. Never import from `mobile/src` — modules
  there reach for Expo and React Native; the lint of this package refuses it. What the web needs
  and is platform-neutral goes into `packages/core` under its rule (`AGENTS.md`, "packages/core").
- **Session**: `src/session/sessionStore.ts`. Every `/api/auth` call carries
  `X-Session-Transport: cookie`; the refresh token is an `HttpOnly` cookie set by the API host
  (task-473, `docs/AUTHENTICATION_SETUP.md`). The access token lives in memory only — never in
  `localStorage`. A page load reopens the session with one `/refresh`.
- **Under 900 px** the app is not rendered: only the install page (`src/pages/InstallPage.tsx`).
- **i18n**: the shared catalogues, plus the web app's own labels in `src/i18n/` (11 languages,
  `en` is the reference and a missing key is a `tsc` error). The interface language follows the
  browser unless one is chosen in My account; the choice, like the theme, stays in this browser.
- **Themes**: light and dark tokens in `src/styles.css`, the same values as
  `mobile/src/constants/theme.ts`. The choice stays in this browser.

## Commands

From the repository root, once: `npm ci` (one workspace install; never inside `web/`). Then, from
`web/`:

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on http://localhost:5173 (fixed port: it is the origin the dev API allows) |
| `npm run build` | Typecheck, then a production build in `web/dist/` |
| `npm run preview` | Serve `web/dist/` on http://localhost:5173 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint, with the guard against imports from `mobile/` |

A change to `packages/core` is also a mobile change: typecheck and lint `mobile/` and
`packages/core` too.

## Running against the -dev API

1. `cp web/.env.example web/.env.local` (git-ignored) and set `VITE_API_BASE_URL` to the dev API:
   `AWS_PROFILE=second-brain-app terraform -chdir=infrastructure/terraform/envs/dev output -raw api_endpoint`.
2. Optional: `VITE_GOOGLE_CLIENT_ID` (the Web OAuth client, whose *Authorised JavaScript origins*
   must list `http://localhost:5173`). Apple needs a verified domain and stays empty for now. An
   unconfigured provider's button is not shown.
3. `npm run dev` in `web/`, and open http://localhost:5173 in a window at least 900 px wide.

What works and what does not **until `api.<domain>` exists** (task-443, then task-445):

- The dev API must run the task-473 backend and carry its CORS (`web_app_origin =
  "http://localhost:5173"` in `infrastructure/terraform/envs/dev/main.tf`, applied). Before that
  `apply`, the dev API answers `access-control-allow-origin: *`, which a browser refuses for a
  credentialed request: sign-in fails with a CORS error in the console.
- Once it is applied, signing in works and the app is usable, **but the session does not survive
  a reload**: the refresh cookie is set by the `execute-api` host, a third party to `localhost`,
  and `SameSite=Strict` keeps the browser from sending it back. Sign in again after a reload.
- With `app.<domain>` and `api.<domain>` on the same site, the cookie rides along and a reload
  keeps the session.
- Importing a file sends its bytes from the browser straight to S3 through a presigned PUT. The
  `documents` and `audio` buckets answer that origin's CORS preflight only once the same
  `web_app_origin` is applied (`aws_s3_bucket_cors_configuration` in
  `infrastructure/terraform/modules/platform/s3.tf`); before that, a link imports but a file does not.

## Deployment

Not covered here: `app.<domain>` is S3 + CloudFront in Terraform (task-445, runbook of task-471).
The bucket serves `web/dist/`, with every unknown path answered by `index.html` (client-side
routes). The `VITE_*` variables are build-time: a build is made per environment.
