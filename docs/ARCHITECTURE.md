# Architecture

The root entry starts the Express server in `public/Program/General/backend/server.js`. The hub serves the login/dashboard, maintains in-memory bearer sessions, checks application access and mounts eight lazy routers. Frontends use script-loaded JavaScript, HTML and CSS; no frontend framework is required.

## Data boundaries

`platform-paths.js` is the common path resolver. All runtime paths resolve inside this checkout's `.demo-data/`. External data-root overrides, path traversal and existing symlinks/junctions are rejected. The compatibility migration helper is deliberately inert; no legacy data folders are inspected or copied.

The public repository holds schema and seed-generator source only. Running `npm run demo:seed` constructs fictional records, demo accounts, fictional offices and a synthetic text attachment. Generated JSON/CSV/SQLite/blob files are excluded from Git.

Records and held-item stores use `node:sqlite`. Shared storage uses a small adapter around the same API to preserve its existing synchronous statements, PRAGMA calls and transactions. Organization storage uses SQL.js. Renewal/decision exports use CSV, while requests/approvals use JSON.

## Authentication and attachments

APIs accept bearer tokens and enforce application access. Shared storage additionally applies ownership/role visibility. Unified search has a privileged-role check and limits sources to the caller's allowed applications.

Browser image/iframe/download requests cannot set custom authorization headers. Login therefore also sets a unique `administrative_demo_session` cookie with HttpOnly and SameSite Strict flags. Cookie authentication is accepted only on named attachment paths and only for GET/HEAD; API writes still require a bearer token. Logout revokes the token and clears the cookie.

Direct data-directory serving is disabled. Report photos, organization uploads and temporary exported files are guarded before broad static frontend middleware. The public local demo uses HTTP on loopback; it contains no TLS keys or machine-specific certificates.

## Build

`tools/build-static.mjs` transforms frontend scripts/styles, creates asset hashes and precompressed bundles, rewrites HTML references and validates the resulting references. Its file walk excludes runtime folders and copies only JS/CSS/HTML. Build outputs stay in `.platform-build/`.

## Publication adaptations

The public variant replaces institution-specific branding/reference labels with generic fictional counterparts and removes logo markup. Desktop shell automation is replaced with an explicit disabled adapter, and external OCR model discovery/inference is unavailable. The original working system is a separate workspace and is not modified by this demo.

The authentication and storage choices are suitable for exploring this demo's architecture. A production fork should redesign password/session storage, audit row-level authorization, validate upload handling and introduce backup/recovery/operational controls for its own data.
