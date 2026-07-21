# storage-obj

Versioned object storage service with interchangeable PostgreSQL and AWS S3 backends.

- backend: Flask
- frontend: Vite + React + MobX
- storage endpoint types: PostgreSQL and AWS S3

## Storage Endpoint

`Storage endpoint` is the key concept of this service. It specifies where and how spaces and objects are stored.

Several endpoints can exist at the same time. Endpoints of the same type are equal. One endpoint is the default, but a request can select another endpoint.

```text
storage endpoint
  -> space
      -> object
          -> current checked-out data
          -> version history
          -> object metadata
```

- A storage endpoint owns an independent set of spaces.
- A space groups related objects and has its own metadata.
- An object has one identity across its complete history.
- An object version records object data at one history point.
- Object metadata belongs to the object, not to one version.

Supported endpoint types:

- `postgres`: data stored in PostgreSQL tables
- `s3_aws`: data stored under one AWS S3 bucket prefix

Refer to [storage_endpoint.md](./storage_endpoint.md) for endpoint selection and lifecycle.

## Documents

- [storage_endpoint.md](./storage_endpoint.md): endpoint types, default selection, and request selection
- [space.md](./space.md): space identity and space metadata
- [object.md](./object.md): object identity and current state
- [object_metadata.md](./object_metadata.md): object-level key/value metadata
- [obj_version.md](./obj_version.md): version history and edit modes
- [backend_s3.md](./backend_s3.md): AWS S3 key layout
- [api.md](./api.md): HTTP API
- [config.md](./config.md): two-layer configuration
- [backend.md](./backend.md): backend mechanisms
- [database.md](./database.md): PostgreSQL structures
- [id.md](./id.md): ID formats
- [dir_config.md](./dir_config.md): project folders

## Config

Storage endpoints are configured under `storage_endpoints` in `config/config.yaml` and the local `config/config.0.yaml` override.

Real credentials belong only in `config/config.0.yaml`.
