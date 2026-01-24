# MongoDB Document Creation/Update in Mongo-Index

## Endpoint
`PUT /mongo-index/{indexName}/doc/{dbName}/{collName}/{docId}/update`

Creates or updates a MongoDB document and indexes it to Elasticsearch.

## Request
```json
{
  "updateDict": {
    "field.path": "value",
    "nested.field": "value"
  },
  "updateIndex": true
}
```

Parameters:
- `updateDict`: Fields to update (uses MongoDB `$set` operator)
- `updateIndex`: Whether to trigger ES indexing (default: true)

## Response
```json
{
  "code": 0,
  "message": "Document updated successfully",
  "data": {
    "docId": "user123",
    "updateAt": 1705982400,
    "updateVersion": 3
  }
}
```

## How It Works

1. **MongoDB Update**: Updates document in specified collection (creates if missing)
2. **IndexQueue**: Creates/updates entry with `status=-1` (needs indexing) and increments version
3. **ES Indexing** (if `updateIndex=true`): Async job indexes document to ES with:
   - `flat`: array of `{path, value}` pairs (character-level indexed)
   - `updateVersion`, `updateAt`, `updateAtTimeZone`: version metadata
   - `source`: `{dbName: "xxx", collName: "yyy"}`
4. **Transaction**: MongoDB update and IndexQueue update are atomic

## Example

**Create/update a user document:**

```bash
PUT /mongo-index/my-index/doc/mydb/users/user123/update
{
  "updateDict": {
    "id": "user123",
    "name": "John Doe",
    "email": "john@example.com",
    "profile.bio": "Software engineer"
  },
  "updateIndex": true
}
```

**Response:**
```json
{
  "code": 0,
  "message": "Document updated successfully",
  "data": {
    "docId": "user123",
    "updateAt": 1705982400,
    "updateVersion": 1
  }
}
```

**Resulting ES document:**
```json
{
  "flat": [
    {"path": "id", "value": "user123"},
    {"path": "name", "value": "John Doe"},
    {"path": "email", "value": "john@example.com"},
    {"path": "profile.bio", "value": "Software engineer"}
  ],
  "updateVersion": 1,
  "updateAt": 1705982400,
  "updateAtTimeZone": -480,
  "source": {
    "dbName": "mydb",
    "collName": "users"
  }
}
```

## Notes

- Document ID (`docId`) must have an `id` field in the document data
- If document doesn't exist, it will be created (upsert)
- Character-level indexing allows searching for any substring in field names or values
- Version tracking prevents race conditions during concurrent updates
