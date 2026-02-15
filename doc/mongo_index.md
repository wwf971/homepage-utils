# MongoIndex: An elasticsearch-based index system for mongodb.

Core classes: `MongoIndexService.java` and `MongoIndexController.java`.

Index format: see ./mongo_index_doc_create.md

## Key Structures:
### `__IndexQueue__`

`__IndexQueue__` is an auxiliary collection in each mondodb database, used to track index status of documents in the same mongodb database. Schema of `__IndexQueue__`:

```
{
  docId: String,
  collection: String,
  mongoId: String,
  updateVersion: Long,
  indexVersion: Long,
  status: Int,          // 0=indexed, -1=needs indexing
  createAt: Long,
  createAtTimeZone: Int, // -12 to 12. optional
  updateAt: Long,
  updateAtTimeZone: Int, // -12 to 12. optional
  isDeleted: Boolean
}
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/mongo-index/list` | List all indices |
| POST | `/mongo-index/create` | Create index (params: name, esIndex, collections: [{database, collection}]) |
| GET | `/mongo-index/{indexName}` | Get single index |
| PUT | `/mongo-index/{indexName}/update` | Update index collections (params: esIndex, collections: [{database, collection}]) |
| DELETE | `/mongo-index/{indexName}/delete` | Delete index |
| POST | `/mongo-index/{indexName}/rebuild?maxDocs=N` | Full rebuild (clear and reindex) |
| POST | `/mongo-index/{indexName}/rebuild-incremental?maxDocs=N` | Incremental rebuild (only status=-1 docs) |
| GET | `/mongo-index/{indexName}/stats` | Get index statistics |
| POST | `/mongo-index/{indexName}/search` | Search in ES (params: query, search_in_paths, search_in_values) |
| PUT | `/mongo-index/{indexName}/doc/{dbName}/{collName}/{docId}/update` | Update doc with indexing (params: updateDict: {field: value}, updateIndex: true) |
| GET | `/mongo-index/{indexName}/doc/{dbName}/{collName}/{docId}/get` | Get document |
| DELETE | `/mongo-index/{indexName}/doc/{dbName}/{collName}/{docId}/delete` | Soft delete doc |
| GET | `/mongo-index/db/{dbName}/coll/{collName}/index/list` | List indices monitoring collection |
| DELETE | `/mongo-index/db/{dbName}/coll/{collName}/delete` | Delete collection and remove from all indices |
| POST | `/elasticsearch/indices/{indexName}/search/` | Character-level search in indexed documents (see mongo_index_doc_search.md) |
| GET | `/mongo-index/search/collections?database=db&query=text` | Search collections |
| GET | `/mongo-index/indices-of-collection?database=db&collection=coll` | Get indices for collection |
| POST | `/mongo-index/rebuild-collection-mapping` | Rebuild collection to indices mapping |

**Useage**: check if there is 

**Operations**:
On doc update: upsert with `status=-1`, increment `updateVersion` (both in transaction)  
On ES indexed: set `status=0` for that `(docId, collection, updateVersion)`  
Query pending: find `status=-1`, sorted by `updateVersion`

## Key methods

### `updateDoc()`

As es indexing might be significantly slower than mongodb doc update, no lock is added to make the operation of updating mongodb doc and es index atomic.

It is possible to completely avoid overwriting newer verion with older version in es, by utilizing `_version` and `if_seq_no`+`if_primary_term`

```
updateDoc()
  [NO OUTER LOCK]
    → MongoDB Transaction (fast)
      → Update doc
      → Update auxiliary doc in __IndexQueue__ that stores metadata
    → updateEsIndexAfterUpdateMongoDoc() [async, returns immediately]
        → ES indexing (slow, no lock)
        [ACQUIRE INNER LOCK]
        → Check version
        → Update IndexQueue
        [RELEASE INNER LOCK]
  [NO OUTER LOCK]
```