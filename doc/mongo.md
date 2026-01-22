# MongoDB Raw CRUD APIs

Basic MongoDB operations without indexing.

## Database APIs
- `GET /mongo/db/list` - List all databases
- `GET /mongo/status/` - Get connection status

## Collection APIs
- `GET /mongo/db/{dbName}/coll/list` List collections in database
- `POST /mongo/db/{dbName}/coll/{collName}/create` Create collection
- `DELETE /mongo/db/{dbName}/coll/{collName}/delete` Delete collection

## Document APIs
- `GET /mongo/db/{dbName}/coll/{collName}/docs/list?page=1&pageSize=20` List documents with pagination
- `POST /mongo/db/{dbName}/coll/{collName}/docs/create` Create empty document
- `PATCH /mongo/db/{dbName}/coll/{collName}/docs/{docId}/update` Update document
  - Body: `{action: "setValue", path: "field.path", value: any}`
  - Actions: setValue, deleteField, replaceFields
- `DELETE /mongo/db/{dbName}/coll/{collName}/docs/{docId}/delete` Delete document
- `GET /mongo/db/{dbName}/coll/{collName}/doc/query?key=value` Query single document
