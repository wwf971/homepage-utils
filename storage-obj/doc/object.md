# Object

An object is one logical item inside a space.

```text
object
  -> identity: spaceId + dataType + objectId
  -> status: HEAD, deleted state, type, edit mode
  -> current: checked-out object data
  -> versions: complete history
  -> metadata: key/value information about the whole object
```

`dataType` is `text`, `bytes`, or `json`.

## Current State

`versionIdHead` points to the checked-out version.

The current copy makes normal object reads direct. Checkout replaces this copy with data from the selected version.

Soft delete keeps status and version history, marks `isDeleted`, and removes the current copy. Restore rebuilds the current copy from HEAD.

## Version History

Versions belong to the object. Checkout can move HEAD to an older version, and a later update can create another history branch.

Refer to [obj_version.md](./obj_version.md) for update and checkout rules.

## Object Metadata

Object metadata belongs to the object identity and remains independent from checkout and version history.

Refer to [object_metadata.md](./object_metadata.md).
