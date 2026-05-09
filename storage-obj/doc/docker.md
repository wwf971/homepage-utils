# Docker Notes

## What gets built

- `docker/backend.Dockerfile` builds the Flask backend image.
- `docker/frontend.Dockerfile` builds the Vite frontend image and outputs static files.
- `docker/docker-compose.yml` wires backend, frontend build output, and PostgreSQL for local container testing.

## Folder Mapping

Recommended mappings in compose:
- map project root to container path, for example `/workspace/storage-obj`
- map frontend build output to a shared path used by backend static serving
- map PostgreSQL data directory to a persistent host folder

## Environment Variables

Key variables:
- `DIR_BASE`: base directory where backend resolves frontend static build as `DIR_BASE/build`
- `PORT`: backend listening port
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`

## Test Environment vs Container Environment

### Local test mode (`script/launch-test.sh`)
- script sets `DIR_BASE` to local project root
- frontend dev server and backend run together
- backend can still serve `DIR_BASE/build` after frontend build

### Container mode
- `DIR_BASE` should point to mounted project root inside container
- backend serves static files from mounted `DIR_BASE/build`
- DB variables are provided by compose environment section
