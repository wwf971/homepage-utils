# API Notes

## JSON Response Contract

All backend endpoints return JSON in this shape:

```json
{
  "code": 0,
  "data": {},
  "message": ""
}
```

Rules:
- `code = 0` means success.
- `code < 0` means failure.
- `data` is optional. Include it only when useful.
- `message` is optional. Include it only when useful.

## Transaction and Rollback Rule

For database write logic, backend should use this flow:
- open transaction
- run business logic
- commit on success
- rollback in exception branch
- return `code < 0` with useful failure message

For read endpoints, keep the same error contract (`code/data/message`) and keep responses concise.

## Route Prefix

Each endpoint below is registered at both `/api/...` and `/...` (same handler, without the `/api` prefix).

## API Endpoints

IDs should be passed through query params (`GET`) or request body (`POST`), not URL path variables.

### Storage Endpoint

Every space, object, version, and metadata request accepts an optional storage endpoint selector:

- `GET`: `storageEndpointKey` query parameter
- `POST`: `storageEndpointKey` request body field

When omitted, the runtime default endpoint is used. An unknown key returns HTTP 404 and `code = -1`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/config/storage-endpoint/list` | list safe endpoint information and runtime default |
| POST | `/api/config/storage-endpoint/test` | test one PostgreSQL or S3 endpoint |
| POST | `/api/config/storage-endpoint/default/set` | change runtime default endpoint |

Refer to [storage_endpoint.md](./storage_endpoint.md) for the semantic model.

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health/ping` | lightweight liveness check |
| GET | `/api/health/test` | test PostgreSQL connection |

### Space

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/space/list` | list all spaces |
| GET | `/api/space/find-by-name` | find one space by `name` query param |
| POST | `/api/space/create` | create a new space |
| POST | `/api/space/delete` | delete a space and its data |
| POST | `/api/space/clear` | clear objects and metadata inside one space |

### Space Metadata

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/space/metadata/list` | list metadata entries in one space |
| POST | `/api/space/metadata/upsert` | insert or update one metadata entry by `tag` |
| POST | `/api/space/metadata/ensure` | create one metadata entry if missing |
| POST | `/api/space/metadata/insert` | insert one metadata entry at a rank position |
| POST | `/api/space/metadata/delete` | delete one metadata entry by `tag` |
| POST | `/api/space/metadata/move` | move one metadata entry to another rank |

### Global Metadata

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/metadata/list` | list global metadata entries |
| POST | `/api/metadata/upsert` | insert or update one global metadata entry by `tag` |

Global metadata is stored in the `metadata` table.

### Object

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/object/list` | list objects by filters and paging |
| GET | `/api/object/get` | get object data |
| POST | `/api/object/create` | create object first version (current + history) |
| POST | `/api/object/update` | update object and append or edit history |
| POST | `/api/object/delete` | set `isDeleted=true` on current row |
| POST | `/api/object/restore` | restore deleted object from HEAD |

### Object Metadata

Object metadata uses the same tag/value model as space metadata and global metadata.

System-reserved tags (read from the object status row, not writable via metadata upsert):
- `versionIdHead`
- `isDeleted`
- `type`
- `editType`

User-defined tags are stored in `space_{spaceId}_object_{dataType}_metadata`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/object/metadata/list` | list metadata entries for one object, including reserved system tags |
| POST | `/api/object/metadata/upsert` | insert or update one user metadata entry by `tag` |
| POST | `/api/object/metadata/ensure` | create one user metadata entry if missing |
| POST | `/api/object/metadata/insert` | insert one user metadata entry at a rank position |
| POST | `/api/object/metadata/delete` | delete one user metadata entry by `tag` |
| POST | `/api/object/metadata/move` | move one user metadata entry to another rank |

### Object Version

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/object/version/list` | list history versions of one object |
| POST | `/api/object/version/checkout` | checkout target history version as current |
| POST | `/api/object/version/rollback` | compatibility alias of checkout |
| POST | `/api/object/version/delete-data` | release history data only (`isDataDeleted=true`) |

There is no separate version-get endpoint. Use `GET /api/object/get` with optional `versionId` query param (S3-style).

### Batch Transaction

Batch transaction executes a list of edit ops in order inside one database transaction.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/batch/transaction` | execute ordered edit ops atomically |

Rules:
- All ops run in the same transaction.
- Ops run strictly in array order.
- If any op fails, the whole transaction is rolled back.
- On rollback, no earlier op in the same batch should be durable.
- Only write endpoints are allowed in a batch. `GET` endpoints and service-admin endpoints are not allowed.
- Nested batch calls are not allowed.
- The batch endpoint should call the same backend business logic as the single-operation endpoints, not duplicate behavior.
- Batch transaction is supported only by PostgreSQL endpoints. S3 endpoints return an unsupported error.

Workflow:
```
batch_transaction()
  -> run_in_transaction(action)
     -> action runs ops
        -> op fails
        -> batch.py raises BatchOpError
     -> run_in_transaction catches error
     -> db.rollback()
```

Allowed op endpoints:
- `/api/metadata/upsert`
- `/api/space/create`
- `/api/space/delete`
- `/api/space/clear`
- `/api/space/metadata/upsert`
- `/api/space/metadata/ensure`
- `/api/space/metadata/insert`
- `/api/space/metadata/delete`
- `/api/space/metadata/move`
- `/api/object/create`
- `/api/object/update`
- `/api/object/delete`
- `/api/object/restore`
- `/api/object/metadata/upsert`
- `/api/object/metadata/ensure`
- `/api/object/metadata/insert`
- `/api/object/metadata/delete`
- `/api/object/metadata/move`
- `/api/object/version/checkout`
- `/api/object/version/rollback`
- `/api/object/version/delete-data`

Request body:

```json
{
  "ops": [
    {
      "opId": "createObject",
      "endpoint": "/api/object/create",
      "body": {
        "spaceId": "abc123",
        "dataType": "json",
        "valueJson": {
          "title": "slide 1"
        }
      }
    },
    {
      "opId": "setObjectTitle",
      "endpoint": "/api/object/metadata/upsert",
      "body": {
        "spaceId": "abc123",
        "dataType": "json",
        "objectId": "$createObject.data.objectId",
        "tag": "title",
        "valueType": 1,
        "valueText": "slide 1"
      }
    }
  ]
}
```

Op fields:
- `opId`: optional client-chosen identifier. Must be unique inside the batch when present.
- `endpoint`: required. Use the `/api/...` endpoint string.
- `body`: required for `POST` ops.

Reference syntax:
- A string that starts with `$` is resolved from a previous op result.
- Format: `$opId.data.fieldName`.
- References can only point to earlier ops.
- If a reference cannot be resolved, the op fails and the transaction is rolled back.

Success response:

```json
{
  "code": 0,
  "data": {
    "opNum": 2,
    "results": [
      {
        "opId": "createObject",
        "code": 0,
        "data": {
          "objectId": "1152921504606846976"
        }
      },
      {
        "opId": "setObjectTitle",
        "code": 0,
        "data": {
          "tag": "title"
        }
      }
    ]
  }
}
```

Failure response:

```json
{
  "code": -1,
  "data": {
    "opNum": 2,
    "failedOpIndex": 1,
    "failedOpId": "setObjectTitle",
    "isRolledBack": true
  },
  "message": "objectId is required"
}
```

### Service Admin

Storage endpoint APIs are the common admin interface. Database APIs remain for PostgreSQL-specific compatibility and schema administration.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/config/storage-endpoint/list` | list storage endpoints |
| POST | `/api/config/storage-endpoint/test` | test one storage endpoint |
| POST | `/api/config/storage-endpoint/default/set` | change runtime default endpoint |
| GET | `/api/config/database/list` | list database presets |
| POST | `/api/config/database/test` | test one database preset |
| POST | `/api/config/database/switch` | switch active database |
| POST | `/api/config/database/reinit` | run init SQL on active database |
| POST | `/api/config/database/check` | check schema/table shape |
| POST | `/api/config/s3/test` | compatibility test for the default or first S3 endpoint |
| POST | `/api/echo` | echo request body for debugging |

### `/api/config/storage-endpoint/test`

Request body:

```json
{
  "storageEndpointKey": "s3_aws_note",
  "timeoutSeconds": 10
}
```

For PostgreSQL, the endpoint executes `select 1`.

For S3, it writes one temporary object under `{path_prefix}/__test__/read-write/`, reads and verifies it, then deletes it.

`timeoutSeconds` is limited to 1 through 30. Credentials are not returned.

## Request Notes

- IDs should be passed by query (`GET`) or request body (`POST`), not path variables.
- Core object APIs require:
  - `spaceId`
  - `dataType` (`text` | `bytes` | `json`)
  - `objectId` (except create when server allocates)
- IDs are represented as strings in HTTP responses.
- ID allocation details can differ by endpoint implementation. Refer to [id.md](./id.md).
- Data fields:
  - text: `valueText`
  - bytes: `valueBase64` (decoded to `bytea` in backend)
  - json: `valueJson`

### `/api/object/get`

Query params:
- required: `spaceId`, `dataType`, `objectId`
- optional: `versionId`

Behavior:
- without `versionId`: return current checked-out object from current table (`isDeleted=false`)
- with `versionId`: return one history version from history table

Response includes data fields (`valueText` / `valueBase64` / `valueJson`), `type`, `editType`, and timestamps. When `versionId` is present, response should also include that `versionId`.

### `/api/object/create`

- accepts optional `editType` (`0`/`1`/`2`), default `0`.

### `/api/object/update`

- accepts optional nullable `isUpdateVersion`.
  - mode `0` (`UPDATE-ONLY`): `null` is treated as `true`; `false` is rejected.
  - mode `1` (`UPDATE-AND-EDIT`): `null` is treated as `false`.
  - mode `2` (`EDIT-ONLY`): `null` is treated as `false`; `true` is rejected.
- accepts optional `isDeletePrevVersionData` (`true` only when `isUpdateVersion=true`).

### Metadata write body

Common fields for global/space/object metadata upsert/ensure/insert:
- required scope fields:
  - global: none
  - space: `spaceId`
  - object: `spaceId`, `dataType`, `objectId`
- `tag`
- optional rank/value fields: `rank`, `valueType`, `valueText`, `valueJson`, `valueBytes`, `valueInt`, `valueBoolean`

### Other optional fields

- change comment fields (reserved for future version APIs):
  - `commentText` (nullable)
  - `commentJson` (nullable)
- timezone fields where relevant:
  - `createdAtTz`
  - `updatedAtTz`
  - format `±HH:MM`
