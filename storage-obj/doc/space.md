# Space Concept

`space` is an isolation unit inside one storage endpoint.

- each storage endpoint has its own spaces
- each space has independent objects and metadata
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

## Objects

Refer to [object.md](./object.md) for object identity and current state.

Refer to [obj_version.md](./obj_version.md) for version behavior.
