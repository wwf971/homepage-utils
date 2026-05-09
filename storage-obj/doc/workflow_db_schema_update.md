# Workflow: DB Schema Update

## Source of truth

For table definition, `doc/database.md` should be the only source of truth. 

`/database/init_db.sql` should be full based on `doc/database.md`, and it might contain some implementation details that is specific to database product(like postgresql).

Upon updating database schema, the overall principle is to make backend/frontend keep compatible with latest schema.

## Steps

1. Confirm the schema change scope.
   - global tables (`metadata`, `change_log`) or per-space tables.
   - column add/remove/rename/type change and default/nullability.
2. Update `doc/database.md` first, as source of truth for schema changes.
3. Update SQL definitions in `database/init_db.sql`.
4. If schema change affects existing production tables, add in-place migration script under `migration/`.
5. Check in `database/init_data_example.sql`, and update example data rows for any newly added columns.
6. Check in `backend/app.py` backend apis related to updated tables whether they need to update their implementation. Proceed if true.
7. Check frontend utilizing these backend apis if they need to update their useage of updated backend apis. In case api url/parameters do not change, it's likely that they don't need to change.
8. Recreate local DB schema from updated SQL and run backend flow.
9. Run integration checks covering:
   - space list/create/delete
   - metadata list/upsert/delete/insert/move
   - any endpoint touching changed columns
10. Update docs including but not limited to:
   - `database.md` (table/column model)
   - `api.md` (request/response field impact, if any)
   - `object_version.md` (if versioning/status/history semantics change)

## Things To Be Careful About

- Naming styles: `snake_case` for table names, and `camelCase` for column names.

- All columns related to time should be timestamp based in principle, and each timestamp column should be paired with a timezone column. The naming style of such pair should be `...At` with nullable `...AtTz`, such as `updatedAt` and `updatedAtTz`.
- In PostgreSQL, use `timestamptz` and keep at least microsecond precision for stored timestamp values.

- Do not break `valueType` mapping contract.
- For versioning tables:
  - history rows remain append-only
  - soft delete keeps status row and removes current row
- If a column rename is needed, confirm all read/write paths are updated together.
- For naming migration such as `updateMode` -> `editType`, include backward-compatible in-place migration logic for existing rows.
- Avoid doc/code drift: schema SQL, backend behavior, and docs must match in one change.
