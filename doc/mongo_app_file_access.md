# MongoApp File Accesses

Each MongoApp can register access to specific folders inside file access points (FAPs). Only FAPs of type `local/external` are supported.

A **file access** grants the app read/write access to one folder (and its subtree) inside a FAP. Scripts reference file accesses by a short `id` chosen at registration time.

## Metadata Structure

File accesses are stored in the app's metadata document under the `fileAccesses` array:

```
fileAccesses: [
  {
    id: String,               // short alias, unique within the app; used by scripts to reference this file access
    fileAccessPointId: String, // which FAP
    path: String,             // relative folder path inside the FAP root (empty string = FAP root)
    addedAt: Long             // unix timestamp ms
  },
  ...
]
```

**id**: chosen by the caller. Must be unique within the app. Scripts use this to reference the file access.

**path**: relative to the FAP's `base_dir`. An empty string means the FAP root itself. Path traversal (e.g. `../../`) is rejected by the backend.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/mongo-app/{appId}/file-access-point/add` | Add a file access |
| POST | `/mongo-app/{appId}/file-access-point/remove` | Remove a file access |
| POST | `/mongo-app/{appId}/file-access-point/update` | Update a file access |
| GET | `/mongo-app/{appId}/file-access-point/list` | List all file accesses |

### Add file access

Body:
```json
{
  "id": "my-data",
  "fileAccessPointId": "fap-id-xxx",
  "path": "relative/folder/path"
}
```

Errors if `id` is already used for this app, or if the FAP does not exist or is not of type `local/external`.

### Remove file access

Body:
```json
{ "id": "my-data" }
```

### Update file access

Body: same as add. Identified by `id`; `fileAccessPointId` and/or `path` can be changed.

```json
{
  "id": "my-data",
  "fileAccessPointId": "fap-id-yyy",
  "path": "other/folder"
}
```

### List file accesses

Returns the `fileAccesses` array from app metadata.

## Groovy Script APIs (backendApis)

Scripts access file accesses through `backendApis`. All file paths in the methods below are relative to the file access's registered `path`.

The backend enforces that scripts cannot navigate outside the registered folder (path traversal is rejected).

### File Access Info

| Method | Parameters | Return | Description |
|--------|------------|--------|-------------|
| `listFileAccesses()` | none | ApiResponse<List<Map>> | List all file accesses for this app |

### File Operations

| Method | Parameters | Return | Description |
|--------|------------|--------|-------------|
| `listFiles(fileAccessId, subPath)` | String, String | ApiResponse<Map> | List files/directories at `registeredPath/subPath`. Pass `""` or `"/"` for the file access root |
| `fileExists(fileAccessId, filePath)` | String, String | ApiResponse<Map> | Check if a file or directory exists |
| `readFile(fileAccessId, filePath)` | String, String | ApiResponse<Map> | Read file content as string |
| `writeFile(fileAccessId, filePath, content)` | String, String, String | ApiResponse<Map> | Write (create or overwrite) a file |
| `deleteFile(fileAccessId, filePath)` | String, String | ApiResponse<Map> | Delete a file |

`fileAccessId` is the `id` of the file access (not the FAP's own id).

`filePath` / `subPath` is relative to the file access's `path`. The backend resolves the final absolute path as: `{fap.base_dir}/{fileAccess.path}/{filePath}`.
