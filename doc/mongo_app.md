

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

### MongoApp Groovy Scripts (Dynamic APIs)

Each MongoApp can have its own Groovy scripts for custom API endpoints.

**Storage:**
- Scripts are stored in MongoDB database: `main`, collection: `groovy-api`
- Each script document has `owner` field (set to appId) and `source` field (set to "mongoApp")

**Ownership & Isolation:**
- Scripts are filtered by `owner=appId` and `source=mongoApp`
- This ensures each MongoApp can only see and manage its own scripts
- Endpoint names are prefixed with `{appId}_` to avoid conflicts

**Script Types:**
1. **Inline scripts**: Script code stored directly in `scriptSource.rawText`
2. **File-based scripts**: Script loaded from file access point, with cached content
3. **Auto-loaded scripts**: Scripts automatically loaded from configured folders

**Auto-Loading from Folders:**
- MongoApps can register folders in file access points for auto-loading Groovy scripts
- Folder configurations are stored in app metadata: `groovyScriptFolders` array
- Each folder entry contains: `fileAccessPointId`, `path`, and `addedAt`
- Scanning process:
  - Scans folders from last to first (first folder has priority)
  - Only loads `.groovy` files
  - Endpoint name = filename without `.groovy` suffix
  - Skips duplicate endpoints (first folder wins)

**Lifecycle:**
- When a MongoApp is deleted, all its Groovy scripts are automatically deleted
- Scripts can be refreshed from file source using the refresh endpoint

**Execution:**
- Scripts are accessed via: `POST /mongo-app/{appId}/api/{endpoint}` or `GET /mongo-app/{appId}/api/{endpoint}`
- Scripts have access to MongoApp services (MongoDB, Elasticsearch, etc.)

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

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/mongo-app/{appId}/api-config/create` | Create inline Groovy script |
| POST | `/mongo-app/{appId}/api-config/create-from-file` | Create Groovy script from file |
| GET | `/mongo-app/{appId}/api-config/list` | List all scripts for app |
| GET | `/mongo-app/{appId}/api-config/get/{scriptId}` | Get script by ID |
| PUT | `/mongo-app/{appId}/api-config/update/{scriptId}` | Update script |
| DELETE | `/mongo-app/{appId}/api-config/delete/{scriptId}` | Delete script |
| POST | `/mongo-app/{appId}/api-config/{scriptId}/refresh` | Refresh file-based script |
| POST | `/mongo-app/{appId}/api/{endpoint}` | Execute script (POST) |
| GET | `/mongo-app/{appId}/api/{endpoint}` | Execute script (GET) |

### Groovy Script Folder Auto-Loading

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/mongo-app/{appId}/api-folders/add` | Add folder for auto-loading scripts |
| POST | `/mongo-app/{appId}/api-folders/remove` | Remove folder from auto-loading |
| GET | `/mongo-app/{appId}/api-folders/list` | List configured folders |
| POST | `/mongo-app/{appId}/api-folders/scan` | Scan and load scripts from all folders |
| POST | `/mongo-app/{appId}/api-folders/scan-one` | Scan and load scripts from a specific folder |