# ID Design

## Unified ID Strategy

All IDs in this module use the same generation logic (`ms_48`) and the same allocator API.

- `spaceId`
- `objectId`
- `versionId`
- `versionIdPrev`
- `versionIdHead`

This keeps ID behavior consistent across metadata, object current tables, history tables, and status tables.

## `ms_48` Format

- 64-bit ID: `48-bit unix ms` + `16-bit offset`
- high 48 bits: unix timestamp milliseconds
- low 16 bits: per-millisecond offset/counter

```text
# 64-bit id based on unix timestamp
high |-------48bit------|---16bit---| low
high |---unix_stamp_ms--|---offset--| low
```

## Why no per-object sequential version integers

`versionId` intentionally does not use object-local self-increment values such as `0, 1, 2, ...`.

Reason:
- version history supports tree-like branching through checkout to older versions and append from there
- global `ms_48` IDs plus `versionIdPrev` linkage make branching history simpler and more uniform
- one allocator API for all IDs avoids different generation paths for different ID kinds
