# Backend Mechanisms

## Storage Endpoint Resolution

Each data request resolves one storage endpoint:

```text
read storageEndpointKey from query or request body
  -> if present, find that configured endpoint
  -> otherwise, use runtime default endpoint
  -> if missing, return HTTP 404
  -> dispatch to PostgreSQL or AWS S3
```

PostgreSQL requests run in a transaction connected to the selected endpoint.

S3 requests use `S3StorageBackend` in `backend/s3_utils.py`. S3 functions are centralized there.

## Runtime Default

`POST /api/config/storage-endpoint/default/set` changes the endpoint used when later requests omit `storageEndpointKey`.

This change is in memory. Restarting the backend restores the endpoint marked `is_default: true` in merged YAML config.

## Endpoint Test

`POST /api/config/storage-endpoint/test` dispatches by endpoint type:

- PostgreSQL executes `select 1`.
- S3 writes, reads, compares, and deletes one temporary object.

Credentials are never included in endpoint list or test responses.

## Frontend Endpoint Change

After selecting another endpoint, the frontend:

- clears space and object state
- reloads spaces from the selected endpoint
- sends `storageEndpointKey` with space and object requests

This prevents data from different endpoints from sharing frontend state.

## Legacy Database Admin APIs

The `/api/config/database/*` APIs remain for compatibility and database-specific administration. Storage endpoint APIs are the common interface for endpoint listing, testing, and default selection.
