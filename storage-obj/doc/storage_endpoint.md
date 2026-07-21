# Storage Endpoint

A storage endpoint is one complete storage backend. Its spaces, objects, versions, and metadata are isolated from every other endpoint.

The endpoint key identifies it in config and APIs.

## Types

### PostgreSQL

`type: from_config_dbs` creates a PostgreSQL endpoint from one entry under `config_dbs`.

The backend normalizes its runtime type to `postgres`.

### AWS S3

`type: s3_aws` creates an endpoint from one S3 bucket and one optional prefix.

S3 bucket versioning is not required. The service stores its own version history. Refer to [backend_s3.md](./backend_s3.md).

## Default and Request Selection

Exactly one configured endpoint has `is_default: true`.

```text
request contains storageEndpointKey
  -> use that endpoint

request omits storageEndpointKey
  -> use runtime default endpoint
```

Changing the runtime default does not rewrite YAML config. Restarting the service restores the configured default.

An unknown key returns HTTP 404 with:

```json
{
  "code": -1,
  "message": "storage endpoint key not found: example"
}
```

## Endpoint APIs

- `GET /api/config/storage-endpoint/list`
- `POST /api/config/storage-endpoint/test`
- `POST /api/config/storage-endpoint/default/set`

Endpoint list responses contain safe connection information only. Passwords and AWS credentials are not returned.

## Backend Equality

PostgreSQL and S3 endpoints expose the same space, object, version, and metadata APIs.

One difference remains:

- PostgreSQL batch operations use one database transaction.
- S3 does not provide transactions across several keys, so batch transaction requests are rejected for S3 endpoints.
