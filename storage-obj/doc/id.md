# ID Design

## API Representation

IDs are returned as strings in HTTP responses and are used as strings in S3 keys.

## Space ID

`spaceId` contains lowercase `0-9a-z`. A caller may provide it during space creation. Otherwise, the backend creates one.

## Object and S3 Version IDs

Object IDs use the service `ms_48` allocator.

AWS S3 version IDs also use this allocator.

- 64-bit ID: `48-bit unix ms` + `16-bit offset`
- high 48 bits: unix timestamp milliseconds
- low 16 bits: per-millisecond offset/counter

```text
# 64-bit id based on unix timestamp
high |-------48bit------|---16bit---| low
high |---unix_stamp_ms--|---offset--| low
```

## PostgreSQL Version IDs

The PostgreSQL backend stores object-local sequential version numbers. The API exposes them through the `versionId` field.

Clients must treat version IDs as opaque strings and must not assume the same allocation format across storage endpoint types.
