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
| POST | `/mongo-app/{appId}/api-folders/remove` | Remove folder |
| GET | `/mongo-app/{appId}/api-folders/list` | List folders |
| POST | `/mongo-app/{appId}/api-folders/scan` | Scan all folders |
| POST | `/mongo-app/{appId}/api-folders/scan-one` | Scan specific folder |
| GET | `/mongo-app/{appId}/api-folders/scripts` | Get folder-scanned scripts |

## Script Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `requestParams` | Map | Request body parameters |
| `requestHeaders` | Map | HTTP request headers |
| `backendApis` | Object | Backend API methods (scoped to app) |
| `params` | Map | Legacy alias for requestParams |
| `headers` | Map | Legacy alias for requestHeaders |


## Backend API Methods (backendApis)

Scripts access backend through `backendApis` object, pre-initialized with appId from URL.

### Collection Operations

| Method | Parameters | Return | Description |
|--------|------------|--------|-------------|
| `listAllCollections()` | none | ApiResponse<List<String>> | List collection names |
| `createCollection(collName)` | String | ApiResponse<Map> | Create collection |
| `collectionExists(collName)` | String | ApiResponse<Map> | Check if exists |

### Document Operations

| Method | Parameters | Description |
|--------|------------|-------------|
| `createDoc(collName, docId, content)` | String, String, Map | Create document |
| `getDoc(collName, docId)` | String, String | Get document |
| `updateDoc(collName, docId, updates)` | String, String, Map | Update document |
| `deleteDoc(collName, docId)` | String, String | Delete document |
| `listDocs(collName, limit, skip)` | String, Int, Int | List with pagination |
| `searchDocs(collName, query)` | String, Map | Search (not implemented) |

### Index Operations

| Method | Parameters | Return | Description |
|--------|------------|--------|-------------|
| `listAllEsIndices()` | none | ApiResponse<List<String>> | List ES index names |
| `indexExists(indexName)` | String | ApiResponse<Map> | Check if exists (not impl) |

### App Metadata

| Method | Parameters | Return | Description |
|--------|------------|--------|-------------|
| `getAppInfo()` | none | ApiResponse<Map> | Get app metadata |
| `getAppId()` | none | String | Get current appId |


## Example Scripts

**Note on String Interpolation**: When using Groovy string interpolation (e.g., `"text ${variable}"`), always append `.toString()` to convert the GString to a plain String. Otherwise, the JSON serialization will include the internal GString structure instead of just the string value.

### 1. Simple Addition

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

### 2. Get App Metadata

```groovy
def result = backendApis.getAppInfo()

if (result.code == 0) {
    return [
        code: 0,
        data: result.data,
        message: "App metadata retrieved successfully"
    ]
} else {
    return [
        code: result.code,
        data: null,
        message: "Failed to get app metadata: ${result.message}".toString()
    ]
}
```

### 3. List All MongoDB Collections

```groovy
def result = backendApis.listAllCollections()

if (result.code == 0) {
    def collections = result.data
    return [
        code: 0,
        data: [
            count: collections.size(),
            collections: collections
        ],
        message: "Successfully listed ${collections.size()} collection(s)".toString()
    ]
} else {
    return [
        code: result.code,
        data: null,
        message: "Failed to list collections: ${result.message}".toString()
    ]
}
```

### 4. List All ES Indices

```groovy
def result = backendApis.listAllEsIndices()

if (result.code == 0) {
    def indices = result.data
    return [
        code: 0,
        data: [
            count: indices.size(),
            indices: indices
        ],
        message: "Successfully listed ${indices.size()} index(es)".toString()
    ]
} else {
    return [
        code: result.code,
        data: null,
        message: "Failed to list ES indices: ${result.message}".toString()
    ]
}
```

