# Backend Mechanisms

## Database Switching

The backend supports runtime database switching through:

- `GET /api/config/database/list`
- `POST /api/config/database/switch`

The switch endpoint validates connectivity to the target database first (`select 1`).  
When that succeeds, backend updates the active DB config used by each request transaction.

### Config Source: `config.js` and `config.0.js`

Database presets are authored in `config/config.js`, and can be overridden in local `config/config.0.js`.

- `config.js` loads `config.0.js` when present.
- The merged config exposes:
  - `DATABASE_LIST`
  - `DATABASE_INDEX`
  - `DATABASE_CURRENT`

At launch time, `script/launch-test.sh` reads merged config values with Node and injects these env vars:

- `DATABASE_LIST_JSON`
- `DATABASE_INDEX`
- and the current `DB_*` fallback values

Backend reads `DATABASE_LIST_JSON` and `DATABASE_INDEX` on startup to build switchable preset options.  
If these env vars are missing, backend falls back to one default preset from `DB_*`.

### Frontend Reload After Switch

After switch success, frontend store:

- flushes cache
- clears service/space in-memory state
- reloads service health (`ping`, `db test`)
- reloads spaces (and metadata if needed by route)

This prevents stale data from previous database context.
