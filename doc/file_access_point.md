# File Access Point

File access points provide a unified interface for accessing files stored in different locations (internal MongoDB storage, external filesystem).

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/file_access_point/special/` | Get or create special file access point by role (body: { "role": "root-browser" }) |
| POST | `/file_access_point/create/` | Create new file access point (auto-generates ID) |
| GET | `/file_access_point/list/` | List all file access points |
| GET | `/file_access_point/mongo_docs/` | Get MongoDB document metadata for all access points |
| GET | `/file_access_point/get/{id}/` | Get specific file access point by ID |
| GET | `/file_access_point/{id}/base_dir/` | Get computed base directory for access point |
| POST | `/file_access_point/reload/` | Reload all file access points from database |
| GET | `/file_access_point/{id}/files/` | List files in access point (query params: path, page, pageSize) |
| GET | `/file_access_point/{accessPointId}/{*filePathOrId}` | Get file content as binary (query param: download) |
| POST | `/file_access_point/{accessPointId}/{*filePathOrId}` | Get file content with metadata as JSON |
| PUT | `/file_access_point/{accessPointId}/{*filePathOrId}/rename` | Rename a file (body: { "name": "newName" }) |

## File Access Point Types

- `local/internal` - Files stored directly in MongoDB documents within the specified directory structure
- `local/external` - Files stored on filesystem, organized in subdirectories within the specified path
- `local/external/time` - Files stored on filesystem, organized by timestamp in subdirectories

## Data Structure

File access points are stored in the MongoDB `note` collection with:
- `type`: `"file_access_point"`
- `id`: Auto-generated unique ID (base36 format)
- `content.name`: Display name
- `content.setting.type`: One of the file access point types above
- `content.setting.dir_path_base`: Base directory path
- `content.systemRole`: (Optional) Special marker for system file access points (e.g., "root-browser")

## Special File Access Points

Special file access points are system-managed FAPs with specific roles:
- **`root-browser`**: Provides access to the server's root filesystem (`/`) for browsing directories when creating new file access points
- Auto-created on first request via `/file_access_point/special/` endpoint
- Marked with `content.systemRole` field
- Hidden from normal UI listings
- Uses auto-generated ID like regular FAPs


┌─────────────────────────────────────────────────────┐
│                  mongoDocStore                      │
│  ┌────────────────────────────────────────────┐     │
│  │ docs: Map<docId, observableDocument>       │     │
│  │ - All MongoDB documents live here          │     │
│  │ - File access points included              │     │
│  └────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────┘
                         ▲
                         │ stores documents
                         │
┌─────────────────────────────────────────────────────┐
│                    fileStore                        │
│  ┌────────────────────────────────────────────┐     │
│  │ fapIds: ['id1', 'id2', ...]    │     │
│  │ fileCache: { 'apId:fileId': fileData }     │     │
│  └────────────────────────────────────────────┘     │
│  get fileAccessPoints() {                           │
│    return ids.map(id => mongoDocStore.getDoc(id))   │
│  }                                                  │
└─────────────────────────────────────────────────────┘