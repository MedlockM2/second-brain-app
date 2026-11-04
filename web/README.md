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

## CI checks

Both PR and main run `npm ci` at the repository root, then
`npm run typecheck --workspace web`, `npm run lint --workspace web` and
`npm run build --workspace web -- --mode ci`. The tracked `web/.env.ci` supplies
only a loopback compilation address; these checks make no API calls and produce
no deployment. Distribution builds must use their environment's public settings.
The separate `web-parity` job checks the `Web:` trailer on mobile commits; mobile
and `packages/core` keep their own typecheck and lint jobs.

## Running against the -dev API

1. `cp web/.env.example web/.env.local` (git-ignored) and set `VITE_API_BASE_URL` to the dev API:
   `AWS_PROFILE=second-brain-app terraform -chdir=infrastructure/terraform/envs/dev output -raw api_endpoint`.
2. Configurer Google et Apple dans Cognito via Terraform (task-526), et vérifier le retour
   `http://localhost:5173/auth/callback`. Les deux boutons passent par Cognito ; aucun SDK
   fournisseur ni identifiant OAuth supplémentaire n’est intégré au bundle. Voir
   `docs/AUTHENTICATION_SETUP.md` pour la bascule et les secrets de fédération.
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

## Legal links

Sign-in, sign-up and My account use `LegalLinks` and the two public constants in
`packages/core/src/constants/legal.ts`. Mobile's `src/constants/legal.ts`
re-exports those same destinations (TASK-358); its store and contact settings
remain platform-specific. The beta destinations follow TASK-357's owner amendment
of 2026-10-30, updated on 2026-11-01: the published dev CloudFront privacy page and
Apple's standard EULA. No Deepn `/terms` page is assumed to exist.

After the owner publishes the domain-backed legal page (TASK-444), update the
shared privacy constant once and rebuild web; mobile receives the same change
through its normal OTA/build delivery. Change Terms only if the owner actually
publishes Deepn terms and chooses them. TASK-591 owns the web cutover; TASK-454
tracks the production metadata and contact changes. Changing `VITE_SITE_URL`
alone does not change legal destinations.
