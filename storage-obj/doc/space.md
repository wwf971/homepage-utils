# Space Concept

`space` is the top-level isolation unit in object storage.

- each space has independent object tables and its own metadata table
- access control and lifecycle are evaluated per space
- `spaceId` is an identity key only (human display name is metadata)

## Metadata Stipulation

Metadata is generally free-form. Any tag can be added, updated, or deleted.

Some tags have reserved semantics in frontend/backend logic.

### Reserved semantics

- `name`
  - used as the space display name
  - tree label shows `name + id`
  - if missing/empty, UI displays `ANONY + id`

- `spacesIdList` (global metadata table)
  - canonical ordered list of existing spaces
  - stored as json list of space IDs

- `spaceNameById:{spaceId}`
  - optional explicit mapping from space ID to display name

- `spaceCreateAtById:{spaceId}`
  - optional space creation time

- `spaceCreateAtTzById:{spaceId}`
  - optional timezone text (`±HH:MM`)

### Ordering

Metadata row order is persisted by `rank`:

- lexorank-style ordering using alphabet `0-9a-z`
- implementation is in `backend/utils.py`
- backend returns rows sorted by `rank`

## Version Flow

Detailed versioning mechanism is documented in `./object_version.md`.

### Create object

1. Allocate initial version.
2. Insert version row into `space_{spaceId}_object_*_history`.
3. Insert same version into `space_{spaceId}_object_*` (current table).
4. Insert or update `space_{spaceId}_object_*_status` with:
   - `versionIdHead = <new version>`
   - `isDeleted = false`

### Update object

1. Read current HEAD from status table.
2. Allocate a new version.
3. Insert new history row.
4. Upsert current row to new version payload.
5. Update status row (`versionIdHead`, `isDeleted = false`).

### Delete object (soft delete)

1. Set `isDeleted = true` in status table.
2. Keep `versionIdHead` as current policy head.
3. Remove row from current table.

### Rollback or checkout

1. Read target history version.
2. Set `versionIdHead = targetVersionId`.
3. Set `isDeleted = false`.
4. Materialize target payload into current table.

Rollback is checkout of an existing history node to current.
