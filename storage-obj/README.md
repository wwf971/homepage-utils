# storage-obj

Versioned object storage service with PostgreSQL and AWS S3 storage endpoints.

Start with [doc/storage-obj.md](./doc/storage-obj.md) for the semantic model and document map.

Core concepts:

```text
storage endpoint
  -> space
      -> object
          -> current data
          -> version history
          -> object metadata
```

The frontend uses Vite, React, MobX, and components from `@wwf971/react-comp-misc`.

The backend uses Flask, PostgreSQL, and AWS S3 through boto3.
