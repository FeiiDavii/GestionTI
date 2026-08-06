# AGENTS.md

Full architectural details, DB schema, API reference, and 19-flag PBAC matrix live in `README.md` (Spanish). Read it before editing. This file only records workflow facts that are hard to derive and easy to get wrong.

## Stack & layout
- Monorepo-ish: `frontend/` = React 19 + Vite 6 + Tailwind 4; `backend/` = PHP 8 (PDO) REST API; `SQL_sripts/inventario_db_set_up.sql` = full DB bootstrap.
- **No test framework, no lint, no typecheck.** Verify by running the app (`npm run dev`). The repo is intentionally bare-bones.
- Frontend scripts are only `dev`, `build`, `preview` (see `frontend/package.json`).

## Running the app (order matters)
1. Start **Apache and MySQL in XAMPP** — the API runs under Apache on port 80, NOT the PHP built-in server (multipart uploads + PHP sessions only work reliably via Apache).
2. Load DB once: run `SQL_sripts/inventario_db_set_up.sql` -> creates `inventario_db` (30 tables + seed data + initial users).
3. Project must be located at `C:\xampp\htdocs\GestionTI\` so the proxy path `/GestionTI/backend/index.php` resolves.
4. `cd frontend && npm install && npm run dev` -> serves at `http://localhost:5173`.

## Proxy / request quirks
- Vite proxies `/api/*` to Apache and rewrites to `/GestionTI/backend/index.php`; `/api/stream` goes to `stream.php` (SSE). See `frontend/vite.config.js`.
- The proxy rewrites `Set-Cookie` (path and domain) so PHP session cookies work across :5173 -> :80. Do NOT remove the `configure` proxies.
- All frontend HTTP goes through the single axios instance `frontend/src/api/client.js` (`baseURL: '/api'`, `withCredentials: true`). Add new endpoints there.
- Adding a new route means editing `backend/index.php` (~82 routes; dispatches to `backend/controllers/*`). PBAC permission per endpoint is enforced in the router and in `middleware/Permission.php`.

## External config (backend/config/env.php)
- `db.php`, `index.php`, `stream.php`, and `functions.php` read config via `env()` (`backend/config/env.php`): precedence real env vars > `backend/.env` > XAMPP defaults. Never hardcode credentials, CORS origins, or the avatar URL in controllers.
- `APP_ORIGINS` (CSV) controls CORS for both the REST API and the SSE stream. `.htaccess` no longer sets CORS; PHP does it dynamically.
- Avatar provider: frontend reads `VITE_AVATAR_URL` (`frontend/.env`, placeholders `{name}`,`{size}`) via `frontend/src/config.js`; empty = local initials (default, no third-party calls). `get_avatar()` in `backend/includes/functions.php` mirrors it via `AVATAR_URL`.
- Copy `.env.example` files (backend/ and frontend/) to `.env` to override defaults.

## Security / DB conventions
- Passwords bcrypt-hashed; sessions are PHP stateful, no JWT.
- When a controller catches a PDO error, return it through `get_friendly_error()` (`backend/config/db.php`) for localized messages against `1062/1451/1452/1364` etc. Reuse it; don't emit raw `$e->getMessage()`.
- Table/column naming is snake_case; Spanish domain names (`funcionarios`, `equipos_de_computo`, `bajas`). Match existing fixtures (e.g. `celular`, not `cellular`).

## Notes
- Permission flags are column `tinyint(1)` on `roles` (PBAC); 19 flags, single source of truth is `Auth::PERMISSIONS` in `backend/middleware/Auth.php`. `PermissionController` reads that list too. The frontend role matrix (`Configuracion.jsx`, `PERMISOS_LISTA`) is a separate list — keep its `key`s in sync when adding/renaming a permission. No intermediate permission table.
- Real-time uses SSE under Apache (`backend/stream.php`) — keep it Apache-routed, not PHP built-in.
- `SQL_sripts/` (sic, typo in dir name) is committed; schema changes belong there (it's the single source for DB).