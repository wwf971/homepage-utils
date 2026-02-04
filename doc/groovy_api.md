# Groovy API - Dynamic Lambda Functions

A subsystem for uploading and executing Groovy scripts as dynamic API endpoints, similar to AWS Lambda.

### Script data format

At backend, each script's data is stored as a mongodb document. Typical database name: main. Typical collection name: groovy-api

At frontend, scripts data are managed by mobx store. mobx store structure:

```javascript
{
  scripts: {
    "3xk9a": {
      id: "3xk9a",
      endpoint: "list-apps",
      description: "List all MongoDB apps",
      scriptSource: "...",
      owner: "mongo-app-system",      // Optional: identifies who owns this script
      source: "mongo-app-id-123",     // Optional: identifies source context
      createdAt: 1706789012345,
      createdAtTimezone: 0,
      updatedAt: 1706789012345,
      updatedAtTimezone: 0
    },
    "7pm2f": { ... }
  },
  loading: false
}
```


## Available Input Parameters

Scripts can access these variables:

- `backendApis` - Backend API methods for the current app (MongoAppScriptBackendApis)
- `requestParams` - Request body parameters (Map<String, Object>)
- `requestHeaders` - HTTP request headers (Map<String, String>)

**Note:** For MongoApp scripts, `backendApis` provides scoped access to only the current app's data. For system-level Groovy API scripts, `backendApis` may have broader access.

## Script Response Format

All Groovy scripts **must** return a standardized response format:

```groovy
[
    code: 0,           // 0 = success, negative = failure
    data: someData,    // Optional: the actual response data
    message: "msg"     // Optional: descriptive message
]
```

- `code`: Integer, `0` means success, `< 0` means failure (required)
- `data`: Any type, the actual response payload (optional)
- `message`: String, descriptive message (optional)

If the script returns data without this format, it will be automatically wrapped as:
```groovy
[code: 0, data: yourReturnValue, message: null]
```

## Example Scripts

### Example 1: List all collections in current app

```groovy
// List all collections for this app
def response = backendApis.listAllCollections()

if (response.code == 0) {
    def collections = response.data
    
    return [
        code: 0,
        data: [
            collections: collections,
            count: collections.size()
        ],
        message: "Found ${collections.size()} collections"
    ]
} else {
    return [
        code: -1,
        data: null,
        message: response.message
    ]
}
```

### Example 2: Create and query documents

```groovy
// Get parameters from request
def collectionName = requestParams.collection
def userId = requestParams.userId

if (!collectionName || !userId) {
    return [
        code: -1,
        data: null,
        message: "Missing required parameters: collection, userId"
    ]
}

// Create a document
def docId = "user_${userId}_${System.currentTimeMillis()}"
def content = [
    userId: userId,
    name: requestParams.name ?: "Unknown",
    email: requestParams.email,
    createdAt: System.currentTimeMillis()
]

def createResult = backendApis.createDoc(collectionName, docId, content)

if (createResult.code == 0) {
    return [
        code: 0,
        data: [
            docId: docId,
            content: content
        ],
        message: "Document created successfully"
    ]
} else {
    return [
        code: -1,
        data: null,
        message: "Failed to create document: ${createResult.message}"
    ]
}
```

### Example 3: Search documents

```groovy
// Search for documents with specific criteria
def collectionName = requestParams.collection ?: "users"
def searchQuery = requestParams.query ?: [:]

def response = backendApis.searchDocs(collectionName, searchQuery)

if (response.code == 0) {
    return [
        code: 0,
        data: response.data,
        message: "Search completed successfully"
    ]
} else {
    return [
        code: -1,
        data: null,
        message: response.message
    ]
}
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/groovy-api/upload` | Upload/update script (params: id, endpoint, scriptSource, description, owner, source, timezone) |
| GET | `/groovy-api/list` | List all scripts (returns map keyed by ID) |
| GET | `/groovy-api/get/{id}` | Get script by ID |
| DELETE | `/groovy-api/delete/{id}` | Delete script by ID |
| POST | `/groovy-api/reload` | Reload all scripts from DB |
| POST | `/groovy-api/{endpoint}` | Execute script (with request body) |
| GET | `/groovy-api/{endpoint}` | Execute script (with query params) |

### Upload Parameters

- `id` (optional): Script ID for updating existing script
- `endpoint` (required): Endpoint name (alphanumeric, dash, underscore only)
- `scriptSource` (required): Groovy script source code
- `description` (optional): Description of the script
- `owner` (optional): Identifies who owns this script (e.g., "mongo-app-system")
- `source` (optional): Identifies source context (e.g., "mongo-app-id-123")
- `timezone` (optional): Timezone offset in hours (-12 to +12). Sets `createdAtTimezone` on creation, `updatedAtTimezone` on update
