

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

### MongoApp File Access Point Registrations

Each MongoApp can register access to specific folders inside file access points (FAPs). See `mongo_app_file_access_point.md` for full documentation.

### MongoApp Groovy Scripts (Dynamic APIs)

Each MongoApp can have custom Groovy scripts for dynamic API endpoints. See `mongo_app_dynamic_api.md` for detailed documentation.

**Quick overview:**
- Scripts are stored in MongoDB or loaded from files/folders
- Three types: inline, file-based, auto-loaded from folders
- Scripts are scoped to their app and cannot access other apps' data
- Backend automatically scans configured folders on startup

## API Endpoints

### App Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/mongo-app/create` | Initialize app |
| GET | `/mongo-app/list` | List all mongo apps |
| GET | `/mongo-app/get-id/{appName}` | Get app IDs by name |
| GET | `/mongo-app/{appId}/config` | Get app info |
| DELETE | `/mongo-app/{appId}/delete` | Delete app (also deletes all scripts) |

### Collection Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/mongo-app/{appId}/coll/create` | Create collection |
| GET | `/mongo-app/{appId}/coll/list` | List collections |
| GET | `/mongo-app/{appId}/coll/get-detail` | List collections with detailed info |
| GET | `/mongo-app/{appId}/coll/exists/{collName}` | Check if collection exists |

### Document Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/mongo-app/{appId}/coll/{collName}/doc/create` | Create document |
| PUT | `/mongo-app/{appId}/coll/{collName}/doc/{docId}/update` | Update document |
| GET | `/mongo-app/{appId}/coll/{collName}/doc/{docId}/get` | Get document |
| DELETE | `/mongo-app/{appId}/coll/{collName}/doc/{docId}/delete` | Delete document |
| GET | `/mongo-app/{appId}/coll/{collName}/doc/list` | List all documents |

### Groovy API Scripts (Dynamic APIs)

See `mongo_app_dynamic_api.md` for complete API documentation and examples.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST/GET | `/mongo-app/{appId}/api/{endpoint}` | Execute script |
| POST | `/mongo-app/{appId}/api-config/create` | Create inline script |
| POST | `/mongo-app/{appId}/api-config/create-from-file` | Create from file |
| POST | `/mongo-app/{appId}/api-folders/scan` | Scan all folders |