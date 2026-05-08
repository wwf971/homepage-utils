# Object Storage (Versioned, Space-Isolated)

## Overview

This module is a Dockerized middle layer between app backends and PostgreSQL.

It stores versioned objects with payload type:
- `text`
- `bytes`
- `json`

Core response and transaction rules are defined in `./api.md`.

## Core Concepts

- **space isolation**: each space has independent object tables and metadata table
- **status model**: object state uses `versionIdHead` and `isDeleted`
- **history tree model**: versions form a history tree; current checkout is tracked by `versionIdHead`
- **checked-out current copy**: current payload is materialized in current object tables
- **history durability with optional data release**: history trace can stay while payload is removed (`isDataDeleted = true`)
- **immutable version rows**: history rows are append-only
- **append-only update**: update creates a new version and moves `versionIdHead`

## ID Strategy

Detailed ID design is in `./id.md`.

Short notes:
- all IDs use the same `ms_48` schema, which is based on unix timestamp. all IDs are generated via one unique allocator API
- ID genres include `spaceId`, `objectId`, `versionId`, `versionIdPrev`, `versionIdHead`

## Document Map

- space concept, metadata semantics, lifecycle flow: `./space.md`
- object history tree and version operation semantics: `./object_version.md`
- unified ID design and allocator contract: `./id.md`
- database schema model and constraints: `./database.md`
- endpoint model, request notes, response contract: `./api.md`
- folder structure: `./dir_config.md`
- config conventions: `./config.md`
- workflow entry and job checklists: `./workflow.md`
- docker and runtime environment notes: `./docker.md`
- frontend/backend route and mechanism notes: `./route.md`, `./backend.md`

## Dependencies

`storage-obj` itself does not declare direct runtime third-party dependencies in its own `package.json`.

In practice, the frontend uses `@wwf971/react-comp-misc`. Through that package, these runtime libraries are used:
- `react` and `react-dom` (peer dependencies)
- `jotai`
- `js-yaml`
- `mobx`
- `mobx-react-lite`

## Design Principles (Small)

### Database design

- table names use `snake_case`
- column names use `camelCase`
- for every `...At` column, add paired nullable timezone column `...AtTz`
- timezone format in `...AtTz`: `±HH:MM` (minute precision), for example `+09:00`, `-05:30`

### API design

- IDs are passed in query parameters (`GET`) or request body (`POST`), not URL path variables
- version rows are immutable
- update is append-only and advances `versionIdHead`
- `spaceId`, `objectId`, and version IDs use `ms_48` (global unique, tree-friendly), stored as `bigint`
