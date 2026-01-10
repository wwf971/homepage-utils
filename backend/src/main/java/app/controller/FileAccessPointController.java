package app.controller;

import app.pojo.ApiResponse;
import app.pojo.FileAccessPoint;
import app.pojo.FileInfo;
import app.service.FileAccessPointService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/file_access_point/")
public class FileAccessPointController {

    private final FileAccessPointService fileAccessPointService;

    public FileAccessPointController(FileAccessPointService fileAccessPointService) {
        this.fileAccessPointService = fileAccessPointService;
    }

    /**
     * Validates file path to prevent directory traversal attacks
     * @param filePathOrId The file path or ID to validate
     * @throws IllegalArgumentException if path contains dangerous patterns
     */
    private void validateFilePath(String filePathOrId) {
        if (filePathOrId == null) {
            throw new IllegalArgumentException("File path cannot be null");
        }
        
        // Split path and check each segment
        String[] segments = filePathOrId.split("/");
        for (String segment : segments) {
            if ("..".equals(segment)) {
                throw new IllegalArgumentException("Path traversal is not allowed: " + filePathOrId);
            }
        }
        
        // Also check for encoded versions
        if (filePathOrId.contains("%2e%2e") || filePathOrId.contains("%2E%2E")) {
            throw new IllegalArgumentException("Path traversal is not allowed: " + filePathOrId);
        }
    }

    @GetMapping("list/")
    public ApiResponse<List<FileAccessPoint>> listAccessPoints() {
        try {
            List<FileAccessPoint> accessPoints = fileAccessPointService.getAllFileAccessPoints();
            return new ApiResponse<>(0, accessPoints, "File access points retrieved successfully");
        } catch (Exception e) {
            System.err.println("Failed to list file access points: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to list access points: " + e.getMessage());
        }
    }

    @GetMapping("mongo_docs/")
    public ApiResponse<Map<String, Object>> getMongoDocs() {
        try {
            List<FileAccessPoint> accessPoints = fileAccessPointService.getAllFileAccessPoints();
            
            List<String> ids = accessPoints.stream()
                    .map(FileAccessPoint::getId)
                    .collect(java.util.stream.Collectors.toList());
            
            Map<String, Object> metadata = new java.util.HashMap<>();
            metadata.put("database", "main");
            metadata.put("collection", "note");
            metadata.put("ids", ids);
            
            return new ApiResponse<>(0, metadata, "File access point mongo docs info retrieved successfully");
        } catch (Exception e) {
            System.err.println("Failed to get file access point mongo docs info: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to get mongo docs info: " + e.getMessage());
        }
    }

    @GetMapping("get/{id}/")
    public ApiResponse<FileAccessPoint> getAccessPoint(@PathVariable String id) {
        try {
            FileAccessPoint accessPoint = fileAccessPointService.getFileAccessPoint(id);
            if (accessPoint == null) {
                return new ApiResponse<>(-1, null, "File access point not found: " + id);
            }
            return new ApiResponse<>(0, accessPoint, "File access point retrieved successfully");
        } catch (Exception e) {
            System.err.println("Failed to get file access point: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to get access point: " + e.getMessage());
        }
    }

    @GetMapping("{id}/base_dir/")
    public ApiResponse<String> getComputedBaseDir(@PathVariable String id) {
        try {
            // Refresh cache to get latest config from database
            FileAccessPoint accessPoint = fileAccessPointService.refreshFileAccessPointCache(id);
            if (accessPoint == null) {
                return new ApiResponse<>(-1, null, "File access point not found: " + id);
            }
            
            // Compute the base directory using the latest config
            String baseDir = accessPoint.resolveBaseDirPath();
            
            return new ApiResponse<>(0, baseDir, "Base directory computed successfully");
        } catch (Exception e) {
            System.err.println("Failed to compute base directory: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to compute base directory: " + e.getMessage());
        }
    }

    @PostMapping("reload/")
    public ApiResponse<String> reloadAccessPoints() {
        try {
            fileAccessPointService.reloadFileAccessPoints();
            int count = fileAccessPointService.getAllFileAccessPoints().size();
            return new ApiResponse<>(0, "Reloaded " + count + " access points", "Access points reloaded successfully");
        } catch (Exception e) {
            System.err.println("Failed to reload file access points: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to reload access points: " + e.getMessage());
        }
    }

    @GetMapping("{id}/files/")
    public ApiResponse<List<FileInfo>> listFiles(
            @PathVariable String id,
            @RequestParam(defaultValue = "") String path,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int pageSize) {
        try {
            List<FileInfo> files = fileAccessPointService.listFiles(id, path, page, pageSize);
            return new ApiResponse<>(0, files, "Files listed successfully");
        } catch (UnsupportedOperationException e) {
            System.err.println("Unsupported file access point type: " + e.getMessage());
            return new ApiResponse<>(-2, null, e.getMessage());
        } catch (Exception e) {
            System.err.println("Failed to list files: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to list files: " + e.getMessage());
        }
    }

    @GetMapping("{accessPointId}/{*filePathOrId}")
    public ResponseEntity<byte[]> getFile(
            @PathVariable String accessPointId,
            @PathVariable String filePathOrId,
            @RequestParam(required = false) String action) {
        
        try {
            // Validate file path for security
            validateFilePath(filePathOrId);
            
            FileInfo fileInfo = fileAccessPointService.getFileContent(accessPointId, filePathOrId);
            
            HttpHeaders headers = new HttpHeaders();
            
            // Set content type
            if (fileInfo.getContentType() != null) {
                headers.setContentType(MediaType.parseMediaType(fileInfo.getContentType()));
            } else {
                headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
            }
            
            // Set content disposition: "attachment" for download, "inline" for display in browser
            ContentDisposition contentDisposition;
            if ("download".equals(action)) {
                contentDisposition = ContentDisposition.attachment()
                        .filename(fileInfo.getName())
                        .build();
            } else {
                contentDisposition = ContentDisposition.inline()
                        .filename(fileInfo.getName())
                        .build();
            }
            headers.setContentDisposition(contentDisposition);
            
            // Set content length
            headers.setContentLength(fileInfo.getFileBytes().length);
            
            return new ResponseEntity<>(fileInfo.getFileBytes(), headers, HttpStatus.OK);
        } catch (Exception e) {
            System.err.println("Failed to get file: " + e.getMessage());
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }
    }

    @PostMapping("{accessPointId}/{*filePathOrId}")
    public ApiResponse<Map<String, Object>> getFileWithMetadata(
            @PathVariable String accessPointId,
            @PathVariable String filePathOrId) {
        
        try {
            // Validate file path for security
            validateFilePath(filePathOrId);
            
            FileInfo fileInfo = fileAccessPointService.getFileContent(accessPointId, filePathOrId);
            
            Map<String, Object> response = new java.util.HashMap<>();
            
            // Add metadata
            Map<String, Object> metadata = new java.util.HashMap<>();
            metadata.put("id", fileInfo.getId());
            metadata.put("name", fileInfo.getName());
            metadata.put("size", fileInfo.getSize());
            metadata.put("contentType", fileInfo.getContentType());
            metadata.put("lastModified", fileInfo.getLastModified());
            metadata.put("isDirectory", fileInfo.isDirectory());
            metadata.put("path", fileInfo.getPath());
            
            response.put("metadata", metadata);
            
            // Add file bytes as base64 if available
            if (fileInfo.getFileBytes() != null) {
                response.put("fileBytes", java.util.Base64.getEncoder().encodeToString(fileInfo.getFileBytes()));
            } else {
                response.put("fileBytes", null);
            }
            
            return new ApiResponse<>(0, response, "File retrieved successfully");
        } catch (Exception e) {
            // Even if file fetch fails, return metadata if available
            System.err.println("Failed to get file content, returning metadata only: " + e.getMessage());
            
            try {
                // Try to get metadata from MongoDB document for local/internal type
                FileInfo fileInfo = fileAccessPointService.getFileMetadata(accessPointId, filePathOrId);
                
                Map<String, Object> response = new java.util.HashMap<>();
                
                Map<String, Object> metadata = new java.util.HashMap<>();
                metadata.put("id", fileInfo.getId());
                metadata.put("name", fileInfo.getName());
                metadata.put("size", fileInfo.getSize());
                metadata.put("contentType", fileInfo.getContentType());
                metadata.put("lastModified", fileInfo.getLastModified());
                metadata.put("isDirectory", fileInfo.isDirectory());
                metadata.put("path", fileInfo.getPath());
                metadata.put("error", e.getMessage());
                
                response.put("metadata", metadata);
                response.put("fileBytes", null);
                
                return new ApiResponse<>(0, response, "File not found, but metadata retrieved from database");
            } catch (Exception metadataError) {
                System.err.println("Failed to get metadata: " + metadataError.getMessage());
                return new ApiResponse<>(-1, null, "Failed to get file: " + e.getMessage() + "; Failed to get metadata: " + metadataError.getMessage());
            }
        }
    }

    @PutMapping("{accessPointId}/{*pathWithRename}")
    public ApiResponse<FileInfo> renameFile(
            @PathVariable String accessPointId,
            @PathVariable String pathWithRename,
            @RequestBody Map<String, String> request) {
        // Extract filePathOrId from the path (remove "/rename" suffix)
        String filePathOrId = pathWithRename.endsWith("/rename") 
            ? pathWithRename.substring(0, pathWithRename.length() - "/rename".length())
            : pathWithRename;
        
        try {
            // Validate file path for security
            validateFilePath(filePathOrId);
            
            String newName = request.get("name");
            if (newName == null || newName.trim().isEmpty()) {
                return new ApiResponse<>(-1, null, "New name is required");
            }
            
            FileInfo updatedFile = fileAccessPointService.renameFile(accessPointId, filePathOrId, newName);
            return new ApiResponse<>(0, updatedFile, "File renamed successfully");
        } catch (UnsupportedOperationException e) {
            System.err.println("Unsupported operation: " + e.getMessage());
            return new ApiResponse<>(-2, null, e.getMessage());
        } catch (Exception e) {
            System.err.println("Failed to rename file: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to rename file: " + e.getMessage());
        }
    }
}

