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


## Available Tool Functions

Scripts can access these variables/services:

- `mongoAppService` - MongoAppService for managing MongoDB apps
- `params` - Request body parameters (Map)
- `headers` - HTTP headers (Map)

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

## Example Script

```groovy
// List all MongoDB apps
def response = mongoAppService.listAllApps()

if (response.code == 0) {
    def apps = response.data
    def appNames = apps.collect { it.appName }
    
    return [
        code: 0,
        data: [
            apps: appNames,
            count: apps.size(),
            fullData: apps
        ],
        message: "Found ${apps.size()} apps"
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

POST   /groovy-api/upload                       - Upload/update script (params: id, endpoint, scriptSource, description, owner, source, timezoneOffset)
GET    /groovy-api/list                         - List all scripts (returns map keyed by ID)
GET    /groovy-api/get/{id}                     - Get script by ID
DELETE /groovy-api/delete/{id}                  - Delete script by ID
POST   /groovy-api/reload                       - Reload all scripts from DB
POST   /groovy-api/{endpoint}                   - Execute script (with request body)
GET    /groovy-api/{endpoint}                   - Execute script (with query params)

### Upload Parameters

- `id` (optional): Script ID for updating existing script
- `endpoint` (required): Endpoint name (alphanumeric, dash, underscore only)
- `scriptSource` (required): Groovy script source code
- `description` (optional): Description of the script
- `owner` (optional): Identifies who owns this script (e.g., "mongo-app-system")
- `source` (optional): Identifies source context (e.g., "mongo-app-id-123")
- `timezoneOffset` (optional): Timezone offset in hours for timestamps
