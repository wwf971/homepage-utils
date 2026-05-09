# Object Versioning Design

## Core Object Versioning Model

An object history is not a simple linear chain. In its most complete form, it is a **tree**.

- each version has a unique `versionId`, which is timestamp based, and adhere to ms_48 id format defined in /doc/id.md
- each version point to one previous version: `versionIdPrev`, except the first version of the object.
- the version that is currently checked is tracked by `versionIdHead` in status table(refer to `Status tables` part in /doc/database.md)

Why it is a tree in practice:

- checkout can move HEAD to any older version
- after checkout to an older node, a new update can be appended from that older node
- this creates a new branch instead of extending the latest branch tip
- `versionId` is intentionally not object-local self-increment (`0, 1, 2, ...`) to better support tree-like history

Example:

- start with linear history: `version1 -> version2 -> version3 -> version4*`
- checkout to `version2`, then update once
- new shape becomes: `version -> version -> version*`, while `3 -> 4` still exists as another branch path

`*` means current HEAD.

Per payload type (`text`, `bytes`, `json`), object versioning uses three table groups under one space:

- current table: `space_{spaceId}_object_*`
- history table: `space_{spaceId}_object_*_history`
- status table: `space_{spaceId}_object_*_status`

## Table Roles In Versioning

### History table

`space_{spaceId}_object_*_history` is append-only and stores full version trace:

- `objectId`
- `versionId`
- `versionIdPrev` (nullable for first version)
- payload column (`valueText` or `valueBytes` or `valueJson`)
- `isDataDeleted`
- change and time fields

Primary key is (`objectId`, `versionId`).

### Status table

`space_{spaceId}_object_*_status` stores current object state:

- `versionIdHead`: currently checked-out version ID
- `isDeleted`: logical deletion flag
- `editType`: write strategy (`UPDATE-ONLY` / `UPDATE-AND-EDIT` / `EDIT-ONLY`)
- change and update time fields

### Current table

`space_{spaceId}_object_*` materializes the payload of current HEAD:

- one row per non-deleted object
- `versionId` column should equal `status.versionIdHead`

## Operation Semantics

### Create object

1. Allocate initial `versionId`.
2. Insert first history row (`versionIdPrev = null`).
3. Insert current row with same payload and version.
4. Insert status row: `versionIdHead = <initial version>`, `isDeleted = false`.

### Update object

Write behavior is selected by `status.editType`.

#### Mode 0: `UPDATE-ONLY` (append-only)

1. Read `versionIdHead` from status.
2. Allocate new `versionId`.
3. Insert new history row with `versionIdPrev = oldHead`.
4. Upsert current row to new payload and `versionId = newVersion`.
5. Update status row: `versionIdHead = newVersion`, `isDeleted = false`.

Old history rows are never modified.
`versionId` is deliberately non-sequential per object; we do not use `0, 1, 2, ...` as object-local auto-increment versions, because global ID allocation plus `versionIdPrev` linkage makes branch creation and merge-like history operations easier to support.

#### Mode 1: `UPDATE-AND-EDIT`

User can choose one of two write paths on each save:

1. append path: same as mode 0 (allocate a new `versionId`, append history row, move `versionIdHead`).
2. in-version edit path: update value in current row and rewrite the history row at `versionId = versionIdHead`.

`versionIdHead` stays unchanged in the in-version edit path.

#### Mode 2: `EDIT-ONLY`

Only in-version edit is allowed:

1. read current `versionIdHead`.
2. update current row value.
3. update history row at (`objectId`, `versionIdHead`).

No new version row is created in this mode.

### Switching object `editType`

Changing one object's `editType` is a status-only update.

- no history rows need to be changed
- no current `versionIdHead` rewrite is needed
- the new policy only affects later writes

Example: switch from `UPDATE-ONLY` to `EDIT-ONLY`, then every later save rewrites current version instead of appending new version rows.

### Checkout / rollback to a history version

Checkout means moving current HEAD pointer to an existing history node.

1. Read target history row by (`objectId`, `targetVersionId`).
2. Update status row: `versionIdHead = targetVersionId`, `isDeleted = false`.
3. Upsert current row using target payload and `versionId = targetVersionId`.

`rollback` is an alias name for this checkout behavior.

### Soft delete object

Delete representation is split between status and current tables:

- in status table (`space_{spaceId}_object_*_status`):
  - `isDeleted = true`
  - `versionIdHead` keeps its value (unless policy introduces explicit delete marker versions)
- in current table (`space_{spaceId}_object_*`):
  - row is removed (no current payload row for deleted objects)
- in history table (`space_{spaceId}_object_*_history`):
  - existing history rows stay unchanged

So a deleted object is represented by:
- status row exists with `isDeleted = true`
- no row in current table for that `objectId`
- historical rows still queryable

### Restore object

1. Read `versionIdHead` from status.
2. Read corresponding history payload.
3. Set `isDeleted = false`.
4. Re-materialize current row with that HEAD version payload.

## History Payload Release

History trace can be retained while releasing payload data for specific old versions.

In `space_{spaceId}_object_*_history`:
- set payload column to `null`
- set `isDataDeleted = true`
- keep `objectId`, `versionId`, `versionIdPrev`, and audit fields unchanged

This preserves the topology of the version tree even when some payloads are removed.
