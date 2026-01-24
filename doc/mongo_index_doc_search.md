# Mongo Index Search API

## Endpoint
`POST /elasticsearch/indices/{indexName}/search/`

## Request
```json
{
  "query": "search text",
  "search_in_paths": false,
  "search_in_values": true,
  "page": 1,
  "page_size": 20
}
```

## Response
```json
{
  "code": 0,
  "message": "Search completed successfully",
  "data": {
    "results": [
      {
        "id": "doc_id",
        "matched_keys": [
          {
            "key": "field.path",
            "value": "field value",
            "match_in": "value",
            "start_index": 0,
            "end_index": 5
          }
        ]
      }
    ],
    "total": 150,
    "page": 1,
    "page_size": 20,
    "total_pages": 8
  }
}
```

## Example

**Search for "abc" in values:**
```bash
POST /elasticsearch/indices/my-index/search/
{
  "query": "abc",
  "search_in_paths": false,
  "search_in_values": true,
  "page": 1,
  "page_size": 20
}
```

**Response:**
```json
{
  "code": 0,
  "message": "Search completed successfully",
  "data": {
    "results": [
      {
        "id": "6841706772fdabf0287afd73",
        "matched_keys": [
          {
            "key": "user.name",
            "value": "abcdefg",
            "match_in": "value",
            "start_index": 0,
            "end_index": 3
          },
          {
            "key": "description",
            "value": "Contains abc and more abc text",
            "match_in": "value",
            "start_index": 9,
            "end_index": 12
          },
          {
            "key": "description",
            "value": "Contains abc and more abc text",
            "match_in": "value",
            "start_index": 22,
            "end_index": 25
          }
        ]
      }
    ],
    "total": 1,
    "page": 1,
    "page_size": 20,
    "total_pages": 1
  }
}
```

Note: Multiple matches in the same field are returned as separate items with different `start_index`/`end_index` positions.

## ES Document Format
Each document in Elasticsearch contains:
- `flat`: array of `{path, value}` pairs (character-level indexed)
- `updateVersion`, `updateAt`, `updateAtTimeZone`: version metadata
- `source`: MongoDB source metadata `{dbName: "xxx", collName: "yyy"}`
