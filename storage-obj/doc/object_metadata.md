# Object Metadata

Object metadata is ordered key/value information attached to one object.

Conceptually, it belongs to the whole object, not the object's one specific version.

```text
object
  -> metadata
  -> version A
  -> version B
  -> version C
```

Checking out another version does not replace object metadata. Creating another version does not copy metadata into that version.

## User Metadata

Each item contains:

- `tag`
- `rank`
- `valueType`
- one applicable value field

Supported value fields are:

- `valueText`
- `valueJson`
- `valueBytes`
- `valueInt`
- `valueBoolean`

`rank` controls display order.

PostgreSQL stores user metadata in `space_{spaceId}_object_{dataType}_metadata`.

S3 stores it under:

```text
{spaceId}/{dataType}/{objectId}/__metadata__/items/{tagEncoded}.json
```

## System Metadata

The metadata list also presents these reserved status fields:

- `versionIdHead`
- `isDeleted`
- `type`
- `editType`

They are read from object status and cannot be changed through metadata write APIs.

## APIs

- `GET /api/object/metadata/list`
- `POST /api/object/metadata/upsert`
- `POST /api/object/metadata/ensure`
- `POST /api/object/metadata/insert`
- `POST /api/object/metadata/delete`
- `POST /api/object/metadata/move`

The backend supports these APIs for PostgreSQL and S3 storage endpoints.
