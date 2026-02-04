

### Groovy Api Management endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/mongo-app/{appId}/api-config/create` | Create custom API script |
| GET | `/mongo-app/{appId}/api-config/list` | List API scripts |
| GET | `/mongo-app/{appId}/api-config/get/{scriptId}` | Get API script |
| PUT | `/mongo-app/{appId}/api-config/update/{scriptId}` | Update API script |
| DELETE | `/mongo-app/{appId}/api-config/delete/{scriptId}` | Delete API script |
| POST | `/mongo-app/{appId}/api/{endpoint}` | Execute custom API (POST) |
| GET | `/mongo-app/{appId}/api/{endpoint}` | Execute custom API (GET) |

## Available Script Parameters

Scripts have access to three input parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `requestParams` | Map<String, Object> | Request body parameters sent in POST/GET requests |
| `requestHeaders` | Map<String, String> | HTTP request headers |
| `backendApis` | MongoAppScriptBackendApis | Backend API methods scoped to the current app |

## Backend API Methods (backendApis)

**Security Model:**
- The `backendApis` instance is pre-initialized with the appId from the request URL (`/mongo-app/{appId}/api/{endpoint}`)
- Scripts have NO access to the appId and CANNOT change it
- All backend API methods automatically use the pre-set appId
- Scripts are isolated and can only access their own app's data
- The appId is determined by the backend, not by the script

**Implementation:**
```java
// Backend creates wrapper with appId from URL path
MongoAppScriptBackendApis backendApis = new MongoAppScriptBackendApis(appId, mongoAppService);

// Script binding
binding.setVariable("backendApis", backendApis);
binding.setVariable("requestParams", params);
binding.setVariable("requestHeaders", headers);
```

All methods below are automatically scoped to the current app. Scripts cannot access other apps' data.

### Collection Operations

| Method | Parameters | Return | Description |
|--------|------------|--------|-------------|
| `listAllCollections()` | none | ApiResponse<List<String>> | List all collection names for this app |
| `createCollection(collName)` | String | ApiResponse<Map> | Create a new collection |
| `collectionExists(collName)` | String | ApiResponse<Map> | Check if collection exists (returns `{exists: true/false}`) |

### Doc Operations

| Method | Parameters | Return | Description |
|--------|------------|--------|-------------|
| `createDoc(collName, docId, content)` | String, String, Map | ApiResponse<Map> | Create a new document with specified ID |
| `getDoc(collName, docId)` | String, String | ApiResponse<Map> | Get document by ID |
| `updateDoc(collName, docId, updates)` | String, String, Map | ApiResponse<Map> | Update document fields |
| `deleteDoc(collName, docId)` | String, String | ApiResponse<Map> | Delete a document |
| `listDocs(collName, limit, skip)` | String, Integer, Integer | ApiResponse<Map> | List documents with pagination |
| `searchDocs(collName, query)` | String, Map | ApiResponse<Map> | Search documents using MongoDB query |

### Index Operations

| Method | Parameters | Return | Description |
|--------|------------|--------|-------------|
| `listAllEsIndices()` | none | ApiResponse<List<String>> | List all Elasticsearch index names for this app |
| `indexExists(indexName)` | String | ApiResponse<Map> | Check if index exists (returns `{exists: true/false}`) |

### App Metadata

| Method | Parameters | Return | Description |
|--------|------------|--------|-------------|
| `getAppInfo()` | none | ApiResponse<Map> | Get current app's metadata (appId, appName, collections, indices) |

