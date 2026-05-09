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

## API Endpoints

IDs should be passed through query params (`GET`) or request body (`POST`), not URL path variables.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/objectStorage/health/test` | test PostgreSQL connection |
| GET | `/objectStorage/space/list` | list all spaces |
| POST | `/objectStorage/space/create` | create new space and initialize per-space tables |
| POST | `/objectStorage/space/delete` | delete or disable a space |
| POST | `/objectStorage/space/metadata/set` | set one space metadata entry |
| GET | `/objectStorage/space/metadata/get` | get one space metadata entry |
| GET | `/objectStorage/space/metadata/list` | list space metadata entries |
| POST | `/objectStorage/metadata/set` | set one global metadata entry |
| GET | `/objectStorage/metadata/get` | get one global metadata entry |
| GET | `/objectStorage/metadata/list` | list global metadata entries |
| POST | `/objectStorage/object/create` | create object first version (history + current + status) |
| GET | `/objectStorage/object/get` | get current object payload |
| GET | `/objectStorage/object/status/get` | get object status (`versionIdHead`, `isDeleted`) |
| POST | `/objectStorage/object/update` | append new version and move HEAD |
| POST | `/objectStorage/object/delete` | set deleted state and remove current row |
| POST | `/objectStorage/object/restore` | restore object from HEAD |
| GET | `/objectStorage/object/version/list` | list history versions |
| GET | `/objectStorage/object/version/get` | get one history version |
| POST | `/objectStorage/object/version/checkout` | checkout target history version |
| POST | `/objectStorage/object/version/rollback` | compatibility alias of checkout |
| POST | `/objectStorage/object/version/data/delete` | release history payload data only |
| GET | `/objectStorage/object/list` | list objects by filters and paging |

## Request Notes

- IDs should be passed by query (`GET`) or request body (`POST`), not path variables.
- Core object APIs require:
  - `spaceId`
  - `dataType` (`text` | `bytes` | `json`)
  - `objectId` (except create when server allocates)
- `spaceId`, `objectId`, `versionId*` use `ms_48` (`bigint` in DB).
- Payload fields:
  - text: `valueText`
  - bytes: `valueBase64` (decoded to `bytea` in backend)
  - json: `valueJson`
- `/object/create` accepts optional `editType` (`0`/`1`/`2`), default `0`.
- `/object/update` accepts optional nullable `isUpdateVersion`.
  - mode `0` (`UPDATE-ONLY`): `null` is treated as `true`; `false` is rejected.
  - mode `1` (`UPDATE-AND-EDIT`): `null` is treated as `false`.
  - mode `2` (`EDIT-ONLY`): `null` is treated as `false`; `true` is rejected.
- Change comment fields:
  - `commentText` (nullable)
  - `commentJson` (nullable)
- Timezone fields where relevant:
  - `createdAtTz`
  - `updatedAtTz`
  - format `±HH:MM`
