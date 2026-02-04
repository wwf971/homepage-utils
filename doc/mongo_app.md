

### MongoApp metadata

- mongo app instance metadata is stored as mongo document in a special collection. typical database name: `mongo-app`. typical collection name: `__app__`

- mongo app document data format:

```
app mongodb document
 ├── appId (unique)
 ├── appName
 ├── esIndices (array of index names, default includes one index)
 ├── collections []
 └── createdAt
```

**appId**: upon creation, each mongo app is assigned a unique app id. app id is string, consisting of 0-9, a-z chars.
**createdAt**: unix timestamp in milliseconds.
**createAtTimezone**: optional. integer with range [-12, 12].


### MongoApp collections
- each mongo app instance can apply for multiple mongodb collections to store their data.
- all mongo app instances' collections are put in same mongodb database. typical database name: `mongo-app`.
- the actual collection name is `{appId}_{collectionName}`.

### MongoApp indices
- each mongo app instance can apply for elasticsearch indices.
- a default elasticsearch index is generated for each newly created mongo app.
  - default elasticsearch index name: `{appId}_index_default`

### MongoApp dynamic apis

Each MongoApp can have its own Groovy scripts for custom API endpoints. These scripts are managed through the Groovy API system with `owner=appId` and `source=mongoApp`.

Scripts are accessed via: `POST /mongo-app/{appId}/api/{endpoint}` or `GET /mongo-app/{appId}/api/{endpoint}`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/mongo-app/create` | Initialize app |
| GET | `/mongo-app/list` | List all mongo apps |
| GET | `/mongo-app/get-id/{appName}` | Get app IDs by name |
| GET | `/mongo-app/{appId}/config` | Get app info |
| POST | `/mongo-app/{appId}/coll/create` | Create collection |
| GET | `/mongo-app/{appId}/coll/list` | List collections |
| GET | `/mongo-app/{appId}/coll/exists/{collName}` | Check if collection exists |
| DELETE | `/mongo-app/{appId}/delete` | Delete app |
| POST | `/mongo-app/{appId}/coll/{collName}/doc/create` | Create document |
| PUT | `/mongo-app/{appId}/coll/{collName}/doc/{docId}/update` | Update document |
| GET | `/mongo-app/{appId}/coll/{collName}/doc/{docId}/get` | Get document |
| DELETE | `/mongo-app/{appId}/coll/{collName}/doc/{docId}/delete` | Delete document |
| GET | `/mongo-app/{appId}/coll/{collName}/doc/list` | List all documents |

**Dynamic API Endpoints**: Refer to ./mongo_app_dynamic_api.md