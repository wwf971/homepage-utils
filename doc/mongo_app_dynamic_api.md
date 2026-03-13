# MongoApp Dynamic API (Groovy Scripts)

Each MongoApp can have its own Groovy scripts for custom API endpoints.

## Storage

- Scripts stored in MongoDB: database `main`, collection `groovy-api`  
- Each script has `owner` field (appId) and `source` field ("mongoApp")
- Scripts are scoped and isolated per app

## Script Types

### 1. Inline Scripts
Code stored directly in `scriptSource.rawText`

### 2. File-Based Scripts  
Code loaded from file access point with file metadata

### 3. Auto-Loaded Scripts
Automatically loaded from configured folders

**Folder Configuration:**
- Folders configured in app metadata: `groovyScriptFolders` array
- Each entry: `fileAccessPointId`, `path`, `addedAt`
- Scans last to first (first folder has priority)
- Only `.groovy` files
- Endpoint name = filename without `.groovy`
- **IN-MEMORY ONLY** - not persisted to database
- Always loaded fresh from filesystem on execution
- Backend scans all folders on startup

## Execution

### What is provided to a script as parameters?
- **`requestParams`** (or `params` for legacy support): A `Map<String, Object>` containing the request parameters (from query string or JSON body)
- **`requestHeaders`** (or `headers` for legacy support): A `Map<String, String>` containing the HTTP request headers
- **`backendApis`**: A `MongoAppScriptBackendApis` object providing scoped access to backend operations (MongoDB collections, documents, Elasticsearch indices, and app metadata)

These variables are injected via Groovy's `Binding` mechanism before script execution, so you can directly reference them in your script without any import or initialization.

### How to access api corresponding to a groovy script?

Via the following endpoints:
- `POST /mongo-app/{appId}/api/{endpoint}`
- `GET /mongo-app/{appId}/api/{endpoint}`

**Security:**
- Scripts cannot access other apps' data
- `appId` determined by backend from URL, not by script

## API Endpoints

### Script Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/mongo-app/{appId}/api-config/create` | Create inline script |
| POST | `/mongo-app/{appId}/api-config/create-from-file` | Create from file |
| GET | `/mongo-app/{appId}/api-config/list` | List all scripts |
| GET | `/mongo-app/{appId}/api-config/get/{scriptId}` | Get script by ID |
| PUT | `/mongo-app/{appId}/api-config/update/{scriptId}` | Update script |
| DELETE | `/mongo-app/{appId}/api-config/delete/{scriptId}` | Delete script |
| POST | `/mongo-app/{appId}/api-config/{scriptId}/refresh` | Refresh file-based script |
| POST | `/mongo-app/{appId}/api/{endpoint}` | Execute (POST) |
| GET | `/mongo-app/{appId}/api/{endpoint}` | Execute (GET) |

### Folder Auto-Loading

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/mongo-app/{appId}/api-folders/add` | Add folder |
| POST | `/mongo-app/{appId}/api-folders/update` | Update folder (change FAP or path) |
| POST | `/mongo-app/{appId}/api-folders/remove` | Remove folder |
| GET | `/mongo-app/{appId}/api-folders/list` | List folders |
| POST | `/mongo-app/{appId}/api-folders/scan` | Scan all folders |
| POST | `/mongo-app/{appId}/api-folders/scan-one` | Scan specific folder |
| GET | `/mongo-app/{appId}/api-folders/scripts` | Get folder-scanned scripts |

### Script Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `requestParams` | Map | Request body parameters |
| `requestHeaders` | Map | HTTP request headers |
| `backendApis` | Object | Backend API methods (scoped to app) |
| `params` | Map | Legacy alias for requestParams |
| `headers` | Map | Legacy alias for requestHeaders |

## Groovy Scripts input parameters

### Backend API Methods (backendApis)

Scripts access backend through `backendApis` object, pre-initialized with appId from URL.

#### Collection Operations

| Method | Parameters | Return | Description |
|--------|------------|--------|-------------|
| `listAllCollections()` | none | ApiResponse<List<String>> | List collection names |
| `createCollection(collName)` | String | ApiResponse<Map> | Create collection |
| `collectionExists(collName)` | String | ApiResponse<Map> | Check if exists |

#### MongoDB Document Operations

| Method | Parameters | Description |
|--------|------------|-------------|
| `createDoc(collName, docId, content)` | String, String, Map | Create document |
| `getDoc(collName, docId)` | String, String | Get document |
| `updateDoc(collName, docId, updates)` | String, String, Map | Update document (also triggers ES reindex) |
| `updateDoc(collName, docId, updates, shouldUpdateIndex)` | String, String, Map, Boolean | Update document, control whether ES index is updated |
| `deleteDoc(collName, docId)` | String, String | Delete document |
| `listDocs(collName, limit, skip)` | String, Int, Int | List with pagination |
| `searchDocs(collName, query)` | String, Map | Search (not implemented) |

#### Elasticsearch Index Operations

| Method | Parameters | Return | Description |
|--------|------------|--------|-------------|
| `listAllEsIndices()` | none | ApiResponse<List<String>> | List ES index names |
| `esIndexExists(indexName)` | String | ApiResponse<Map> | Check if index exists and whether it belongs to current app |
| `createEsIndex(indexName)` | String | ApiResponse<Map> | Create app-owned ES index |
| `deleteEsIndex(indexName)` | String | ApiResponse<Map> | Delete app-owned ES index (cannot delete last index) |
| `renameEsIndex(oldIndexName, newIndexName)` | String, String | ApiResponse<Map> | Rename app-owned ES index |
| `getEsIndexInfo(indexName)` | String | ApiResponse<Map> | Get ES index details and doc count |
| `listEsDocs(indexName, page, pageSize)` | String, Int, Int | ApiResponse<Map> | List docs in ES index |
| `getEsDoc(indexName, docId)` | String, String | ApiResponse<Map> | Get one ES doc by id |
| `indexDocWithCustomSource(collName, docId, docForIndex, indexName)` | String, String, Map, String | ApiResponse<Map> | Index doc using a custom source object (instead of raw Mongo doc) into a specific app-owned ES index. Typical usage: call `updateDoc(..., false)` first, then this. |

#### App Metadata

| Method | Parameters | Return | Description |
|--------|------------|--------|-------------|
| `getAppInfo()` | none | ApiResponse<Map> | Get app metadata (ES index names are returned without the `appId_` prefix) |
| `getAppId()` | none | String | Get current appId |

#### Cross-Script Calls

| Method | Parameters | Return | Description |
|--------|------------|--------|-------------|
| `executeApiScript(endpoint, requestParams)` | String, Map | Map | Execute another Groovy API endpoint within the same app |
| `executeApiScript(endpoint, requestParams, requestHeaders)` | String, Map, Map | Map | Same, with explicit request headers |

#### Access to File Access Points

Scripts can read/write files inside the app's registered FAP folders. See `mongo_app_file_access_point.md` for registration management and the full method list.


## Example Scripts

**Note on String Interpolation**: When using Groovy string interpolation (e.g., `"text ${variable}"`), always append `.toString()` to convert the GString to a plain String. Otherwise, the JSON serialization will include the internal GString structure instead of just the string value.

### Basic Example (Inline Script)

```groovy
def a = requestParams.a
def b = requestParams.b
def sum = a + b

return [
    code: 0,
    data: [a: a, b: b, sum: sum],
    message: "Successfully calculated sum"
]
```

Test with: `{"a": 5, "b": 10}`

### File-Based Example Scripts

All full examples are stored in:
`example/mongo-app-groovy-scripts/`

| File Name | Demonstrates |
|-----------|--------------|
| `exception-response.groovy` | Standard error return vs thrown exception |
| `get-app-metadata.groovy` | Reading app metadata with `backendApis.getAppInfo()` |
| `list-all-mongo-collection.groovy` | Listing app collections (legacy naming example) |
| `list-all-es-index.groovy` | Listing app ES indices (legacy naming example) |
| `mongo-collection-create.groovy` | Creating an app collection |
| `mongo-collection-list.groovy` | Listing collections and optional existence check |
| `mongo-collection-create-doc.groovy` | Create document in app collection |
| `mongo-collection-read-doc.groovy` | Read document from app collection |
| `mongo-collection-update-doc.groovy` | Update document in app collection |
| `mongo-collection-delete-doc.groovy` | Delete document from app collection |
| `es-index-list.groovy` | List ES indices bound to current app |
| `es-index-check-exists.groovy` | Check index existence through `backendApis.esIndexExists()` |
| `es-index-create-doc.groovy` | Create document and trigger indexing |
| `es-index-read-doc.groovy` | Read document while showing app index context |
| `es-index-update-doc.groovy` | Update document and trigger reindexing |
| `es-index-delete-doc.groovy` | Delete document (and remove from index) |

