# Database Notes

## Table Structure

### 1) Global metadata table

`metadata`

| Column | Type | Notes |
|--------|------|-------|
| `tag` | `text` PK | metadata key |
| `rank` | `varchar(10)` | lexorank-style order key |
| `valueType` | `smallint` | uint8 semantic |
| `valueText` | `text` | nullable |
| `valueJson` | `jsonb` | nullable |
| `valueBytes` | `bytea` | nullable |
| `valueInt` | `bigint` | nullable |
| `valueBoolean` | `boolean` | nullable |
| `updatedAt` | `timestamptz` | default `now()` |
| `updatedAtTz` | `varchar(6)` | nullable, `±HH:MM` |

Conventional tags (all optional; when present, format should match):
- `spacesIdList` with `valueType = 2` (json array)
- `spaceNameById:{spaceId}` with `valueType = 1` (text)
- `spaceCreateAtById:{spaceId}` with `valueType = 1` or `4`
- `spaceCreateAtTzById:{spaceId}` with `valueType = 1` and `±HH:MM`

### 2) Global change log table

`change_log`

| Column | Type | Notes |
|--------|------|-------|
| `changeLogId` | `bigserial` PK | |
| `createdAt` | `timestamptz` | default `now()` |
| `createdAtTz` | `varchar(6)` | nullable |
| `commentText` | `text` | nullable |
| `commentJson` | `jsonb` | nullable |

### 3) Per-space tables (design model)

For each `spaceId`, table names should use prefix `space_{spaceId}_`.

Tables:
- `space_{spaceId}_object_text`
- `space_{spaceId}_object_bytes`
- `space_{spaceId}_object_json`
- `space_{spaceId}_object_text_history`
- `space_{spaceId}_object_bytes_history`
- `space_{spaceId}_object_json_history`
- `space_{spaceId}_object_text_status`
- `space_{spaceId}_object_bytes_status`
- `space_{spaceId}_object_json_status`
- `space_{spaceId}_metadata`

#### Current object tables (`space_{spaceId}_object_*`)

Current tables contain checked-out HEAD payload for non-deleted objects.

| Column | Type | Notes |
|--------|------|-------|
| `objectId` | `bigint` PK | ms_48 ID |
| `versionId` | `bigint` | current HEAD version |
| payload | typed column | `valueText` or `valueBytes` or `valueJson` |
| `changeLogId` | `bigint` FK | -> `change_log.changeLogId` |
| `createdAt` | `timestamptz` | |
| `createdAtTz` | `varchar(6)` | |
| `updatedAt` | `timestamptz` | |
| `updatedAtTz` | `varchar(6)` | |

#### History tables (`space_{spaceId}_object_*_history`)

History tables are append-only.

| Column | Type | Notes |
|--------|------|-------|
| `objectId` | `bigint` | |
| `versionId` | `bigint` | ms_48 version ID |
| `versionIdPrev` | `bigint` | nullable |
| payload | typed column | nullable payload |
| `isDataDeleted` | `boolean` | default `false` |
| `changeLogId` | `bigint` FK | -> `change_log.changeLogId` |
| `createdAt` | `timestamptz` | |
| `createdAtTz` | `varchar(6)` | |

Primary key:
- (`objectId`, `versionId`)

When releasing history payload:
- set payload to `null`
- set `isDataDeleted = true`
- keep trace fields unchanged

#### Status tables (`space_{spaceId}_object_*_status`)

| Column | Type | Notes |
|--------|------|-------|
| `objectId` | `bigint` PK | |
| `versionIdHead` | `bigint` | current HEAD version |
| `type` | `integer` | object-level business type |
| `isDeleted` | `boolean` | soft delete state |
| `editType` | `smallint` | update strategy code (`0/1/2`) |
| `changeLogId` | `bigint` FK | -> `change_log.changeLogId` |
| `updatedAt` | `timestamptz` | |
| `updatedAtTz` | `varchar(6)` | |

#### Per-space metadata (`space_{spaceId}_metadata`)

Same column set as global `metadata`.

## `valueType` Mapping

| valueType | Meaning | Active column |
|-----------|---------|---------------|
| `1` | text | `valueText` |
| `2` | json | `valueJson` |
| `3` | bytes | `valueBytes` |
| `4` | int | `valueInt` |
| `5` | boolean | `valueBoolean` |

Only one value column should be populated according to `valueType`.

## `editType` Mapping

| editType | Meaning |
|-----------:|---------|
| `0` | `UPDATE-ONLY`: append next version only, in-version edit is forbidden |
| `1` | `UPDATE-AND-EDIT`: user can append next version or stay on current version |
| `2` | `EDIT-ONLY`: in-version edit only, append next version is forbidden |

## SQL Constraint Suggestions

- check `objectId > 0`
- check `spaceId > 0`
- check `versionId > 0` for all version fields
- deleted objects should not appear in current table (enforced in service layer)
- FK `changeLogId -> change_log.changeLogId`
- metadata one-value-column-only rule by `valueType`

## Initialization Scripts

- schema init: `database/init_db.sql`
- example data: `database/init_data_example.sql`

