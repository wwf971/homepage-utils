package app.service;

import app.pojo.FileAccessPoint;
import app.pojo.FileInfo;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.DirectoryStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class FileAccessPointService {

    private final Map<String, FileAccessPoint> cachedFileAccessPoints = new ConcurrentHashMap<>();
    private final MongoService mongoService;

    public FileAccessPointService(MongoService mongoService) {
        this.mongoService = mongoService;
        System.out.println("FileAccessPointService initialized (lazy loading - will connect on first use)");
    }

    private void loadFileAccessPoints() {
        try {
            MongoTemplate mongoTemplate = mongoService.getMongoTemplate();
            if (mongoTemplate == null) {
                System.err.println("Cannot load file access points - MongoDB not connected");
                return;
            }
            
            Query query = new Query(Criteria.where("type").is("file_access_point"));
            List<FileAccessPoint> accessPoints = mongoTemplate.find(query, FileAccessPoint.class, "note");
            
            for (FileAccessPoint doc : accessPoints) {
                cachedFileAccessPoints.put(doc.getId(), doc);
            }
            System.out.println("FileAccessPointService loaded " + cachedFileAccessPoints.size() + " access points from MongoDB");
        } catch (Exception e) {
            System.err.println("Error loading file access points: " + e.getMessage());
            e.printStackTrace();
        }
    }

    public FileAccessPoint getFileAccessPoint(String id) {
        // Ensure MongoDB connection is initialized
        MongoTemplate mongoTemplate = mongoService.getMongoTemplate();
        if (mongoTemplate == null) {
            System.err.println("MongoDB connection not available for file access point: " + id);
            return null;
        }
        
        if (cachedFileAccessPoints.isEmpty()) {
            loadFileAccessPoints();
        }
        
        FileAccessPoint cached = cachedFileAccessPoints.get(id);
        if (cached != null) {
            return cached;
        }
        
        Query query = new Query(Criteria.where("type").is("file_access_point").and("id").is(id));
        return mongoTemplate.findOne(query, FileAccessPoint.class, "note");
    }

    /**
     * Refresh cache for a specific file access point by fetching latest data from MongoDB
     * This should be called after config changes to ensure the cache is up-to-date
     * 
     * @param id The file access point ID
     * @return The refreshed FileAccessPoint, or null if not found
     */
    public FileAccessPoint refreshFileAccessPointCache(String id) {
        // Ensure MongoDB connection is initialized
        MongoTemplate mongoTemplate = mongoService.getMongoTemplate();
        if (mongoTemplate == null) {
            System.err.println("MongoDB connection not available for refreshing file access point: " + id);
            return null;
        }
        
        // Query MongoDB directly to get fresh data
        Query query = new Query(Criteria.where("type").is("file_access_point").and("id").is(id));
        FileAccessPoint accessPoint = mongoTemplate.findOne(query, FileAccessPoint.class, "note");
        
        // Update cache with fresh data
        if (accessPoint != null) {
            cachedFileAccessPoints.put(id, accessPoint);
            System.out.println("Refreshed cache for file access point: " + id);
        } else {
            // Remove from cache if no longer exists in database
            cachedFileAccessPoints.remove(id);
            System.out.println("Removed file access point from cache (not found in database): " + id);
        }
        
        return accessPoint;
    }

    public FileInfo getFile(String fileAccessPointId, String path, boolean getFileBytes) throws Exception {
        FileAccessPoint accessPoint = getFileAccessPoint(fileAccessPointId);
        if (accessPoint == null) {
            throw new IllegalArgumentException("File access point not found: " + fileAccessPointId);
        }

        String settingType = accessPoint.getSettingType();
        if (settingType != null && (settingType.equals("local/internal") || settingType.equals("local/external"))) {
            return getFileFromFilesystem(accessPoint, path, getFileBytes);
        } else {
            throw new IllegalArgumentException("Unsupported file access point type: " + settingType);
        }
    }

    private FileInfo getFileFromFilesystem(FileAccessPoint accessPoint, String filePath, boolean getFileBytes) throws IOException {
        String basePath = accessPoint.resolveBaseDirPath();
        if (basePath == null) {
            throw new IllegalArgumentException("dir_path_base not configured for: " + accessPoint.getId());
        }
        
        basePath = expandHomePath(basePath);
        Path fullPath = Paths.get(basePath, filePath);
        
        if (!Files.exists(fullPath)) {
            throw new IOException("File not found: " + fullPath);
        }

        FileInfo fileInfo = new FileInfo();
        fileInfo.setPath(filePath);
        fileInfo.setName(fullPath.getFileName().toString());
        fileInfo.setSize(Files.size(fullPath));
        fileInfo.setContentType(Files.probeContentType(fullPath));

        if (getFileBytes) {
            fileInfo.setFileBytes(Files.readAllBytes(fullPath));
        }

        return fileInfo;
    }

    private String expandHomePath(String path) {
        if (path.startsWith("~/")) {
            return System.getProperty("user.home") + path.substring(1);
        }
        return path;
    }
    
    /**
     * Search for file using ID-based directory patterns
     * Tries: ./, ./oc/, ./oc/rc/, ./oc/rc/ob/, etc.
     */
    private Path searchFileInDirectoryPatterns(String basePath, String fileId, String fileName) {
        System.out.println("Searching for file: " + fileName + " (ID: " + fileId + ")");
        
        // Try root directory first
        Path candidatePath = Paths.get(basePath, fileName);
        System.out.println("  Trying: " + candidatePath);
        if (Files.exists(candidatePath)) {
            return candidatePath;
        }
        
        // Try patterns based on fileId: first 2 chars, then next 2, etc.
        String id = fileId.toLowerCase();
        int maxDepth = Math.min(id.length() / 2, 4); // Max 4 levels deep
        
        for (int depth = 1; depth <= maxDepth; depth++) {
            StringBuilder pathBuilder = new StringBuilder();
            
            for (int i = 0; i < depth; i++) {
                int startIdx = i * 2;
                int endIdx = Math.min(startIdx + 2, id.length());
                if (startIdx < id.length()) {
                    if (pathBuilder.length() > 0) {
                        pathBuilder.append("/");
                    }
                    pathBuilder.append(id.substring(startIdx, endIdx));
                }
            }
            
            pathBuilder.append("/").append(fileName);
            candidatePath = Paths.get(basePath, pathBuilder.toString());
            System.out.println("  Trying: " + candidatePath);
            
            if (Files.exists(candidatePath)) {
                return candidatePath;
            }
        }
        
        // If still not found, try a broader search in subdirectories
        System.out.println("  File not found in standard patterns, trying subdirectory search...");
        try {
            Path result = searchFileInSubdirectories(Paths.get(basePath), fileName, 3);
            if (result != null) {
                System.out.println("  Found in subdirectory: " + result);
                return result;
            }
        } catch (Exception e) {
            System.err.println("Error during subdirectory search: " + e.getMessage());
        }
        
        return null;
    }
    
    /**
     * Recursively search for file in subdirectories up to maxDepth
     */
    private Path searchFileInSubdirectories(Path directory, String fileName, int maxDepth) throws IOException {
        if (maxDepth < 0 || !Files.isDirectory(directory)) {
            return null;
        }
        
        try (var stream = Files.list(directory)) {
            for (Path entry : stream.toList()) {
                if (Files.isDirectory(entry)) {
                    // Recursively search subdirectories
                    Path result = searchFileInSubdirectories(entry, fileName, maxDepth - 1);
                    if (result != null) {
                        return result;
                    }
                } else if (entry.getFileName().toString().equals(fileName)) {
                    return entry;
                }
            }
        }
        
        return null;
    }
    
    /**
     * Update the file path in MongoDB document
     */
    private void updateFilePathInMongoDB(MongoTemplate mongoTemplate, String fileId, String newRelativePath) {
        try {
            Query query = new Query(Criteria.where("type").is("file").and("id").is(fileId));
            Update update = new Update().set("path", newRelativePath);
            mongoTemplate.updateFirst(query, update, "note");
            System.out.println("Updated MongoDB path for file " + fileId + " to: " + newRelativePath);
        } catch (Exception e) {
            System.err.println("Failed to update MongoDB path: " + e.getMessage());
        }
    }

    public List<FileAccessPoint> getAllFileAccessPoints() {
        try {
            // Ensure MongoDB connection is initialized
            MongoTemplate mongoTemplate = mongoService.getMongoTemplate();
            if (mongoTemplate == null) {
                System.err.println("MongoDB connection not available for file access points");
                return new ArrayList<>();
            }
            
            // Load from cache if available
            if (cachedFileAccessPoints.isEmpty()) {
                loadFileAccessPoints();
            }
            
            // Query directly from MongoDB to get latest data
            Query query = new Query(Criteria.where("type").is("file_access_point"));
            return mongoTemplate.find(query, FileAccessPoint.class, "note");
        } catch (Exception e) {
            System.err.println("Error getting all file access points: " + e.getMessage());
            e.printStackTrace();
            return new ArrayList<>();
        }
    }

    public void reloadFileAccessPoints() {
        // Ensure MongoDB connection is initialized
        MongoTemplate mongoTemplate = mongoService.getMongoTemplate();
        if (mongoTemplate == null) {
            throw new IllegalStateException("MongoDB connection not available. Please check MongoDB configuration and ensure MongoDB is running.");
        }
        
        cachedFileAccessPoints.clear();
        loadFileAccessPoints();
    }

    /**
     * Get file content by file ID
     * @param fileAccessPointId The file access point ID or name
     * @param fileId The custom id field of the file (for local/internal) or relative path (for local/external)
     * @return FileInfo with file bytes and content type
     */
    public FileInfo getFileContent(String fileAccessPointId, String filePathOrId) throws Exception {
        // Refresh cache to get latest config (e.g., updated base directory)
        FileAccessPoint accessPoint = refreshFileAccessPointCache(fileAccessPointId);
        if (accessPoint == null) {
            throw new IllegalArgumentException("File access point not found: " + fileAccessPointId);
        }

        String settingType = accessPoint.getSettingType();
        if (settingType == null) {
            throw new IllegalArgumentException("File access point type not configured: " + fileAccessPointId);
        }

        switch (settingType) {
            case "local/internal":
                return getFileContentFromMongoDB(accessPoint, filePathOrId);
            case "local/external":
                return getFileContentFromFilesystem(accessPoint, filePathOrId);
            default:
                throw new UnsupportedOperationException("Type " + settingType + " not supported yet");
        }
    }

    /**
     * Get file metadata only (without file bytes) - useful for debugging when file not found
     */
    public FileInfo getFileMetadata(String fileAccessPointId, String filePathOrId) throws Exception {
        // Refresh cache to get latest config (e.g., updated base directory)
        FileAccessPoint accessPoint = refreshFileAccessPointCache(fileAccessPointId);
        if (accessPoint == null) {
            throw new IllegalArgumentException("File access point not found: " + fileAccessPointId);
        }

        String settingType = accessPoint.getSettingType();
        if (settingType == null) {
            throw new IllegalArgumentException("File access point type not configured: " + fileAccessPointId);
        }

        switch (settingType) {
            case "local/internal":
                return getFileMetadataFromMongoDB(accessPoint, filePathOrId);
            case "local/external":
                return getFileMetadataFromFilesystem(accessPoint, filePathOrId);
            default:
                throw new UnsupportedOperationException("Type " + settingType + " not supported yet");
        }
    }

    /**
     * Get file metadata from MongoDB for local/internal type
     */
    private FileInfo getFileMetadataFromMongoDB(FileAccessPoint accessPoint, String fileId) throws Exception {
        System.out.println("=== getFileMetadataFromMongoDB ===");
        System.out.println("File ID (original): " + fileId);
        
        // Strip leading slash if present (file IDs in MongoDB don't have leading slashes)
        if (fileId.startsWith("/")) {
            fileId = fileId.substring(1);
            System.out.println("File ID (cleaned): " + fileId);
        }
        
        MongoTemplate mongoTemplate = mongoService.getMongoTemplate();
        if (mongoTemplate == null) {
            throw new IllegalStateException("MongoDB connection not available");
        }

        // Query MongoDB by custom id field
        Query query = new Query(Criteria.where("type").is("file").and("id").is(fileId));
        org.bson.Document doc = mongoTemplate.findOne(query, org.bson.Document.class, "note");
        
        if (doc == null) {
            throw new IllegalArgumentException("File not found in database: " + fileId);
        }

        // Verify it belongs to this file access point
        String docAccessPointId = doc.getString("file_access_point_id");
        if (docAccessPointId == null || !docAccessPointId.equals(accessPoint.getId())) {
            throw new IllegalArgumentException("File does not belong to this access point");
        }

        FileInfo fileInfo = new FileInfo();
        fileInfo.setId(fileId);
        fileInfo.setName(doc.getString("name"));
        String relativePath = doc.getString("path");
        fileInfo.setPath(relativePath);
        fileInfo.setContentType(doc.getString("file_type"));
        
        // Get size from MongoDB if available
        Object sizeObj = doc.get("size");
        if (sizeObj != null) {
            fileInfo.setSize(sizeObj instanceof Long ? (Long) sizeObj : 
                           sizeObj instanceof Integer ? ((Integer) sizeObj).longValue() : 0);
        }
        
        Object timeUpload = doc.get("time_upload");
        if (timeUpload != null) {
            long timeUploadUs = timeUpload instanceof Long ? (Long) timeUpload : 
                               timeUpload instanceof Integer ? ((Integer) timeUpload).longValue() : 0;
            fileInfo.setLastModified(timeUploadUs / 1000);
        }
        
        // Verify file exists on filesystem, search if not found
        String basePath = accessPoint.resolveBaseDirPath();
        if (basePath != null) {
            basePath = expandHomePath(basePath);
            Path fullPath = null;
            boolean foundFile = false;
            
            // Try the path from MongoDB first
            if (relativePath != null && !relativePath.isEmpty()) {
                fullPath = Paths.get(basePath, relativePath);
                if (Files.exists(fullPath)) {
                    foundFile = true;
                }
            }
            
            // If not found, search for the file
            if (!foundFile) {
                String fileName = doc.getString("name");
                if (fileName != null && !fileName.isEmpty()) {
                    fullPath = searchFileInDirectoryPatterns(basePath, fileId, fileName);
                    
                    if (fullPath != null && Files.exists(fullPath)) {
                        // Calculate new relative path and update MongoDB
                        String newRelativePath = Paths.get(basePath).relativize(fullPath).toString();
                        updateFilePathInMongoDB(mongoTemplate, fileId, newRelativePath);
                        fileInfo.setPath(newRelativePath);
                    }
                }
            }
        }
        
        return fileInfo;
    }

    /**
     * Get file metadata from filesystem for local/external type
     */
    private FileInfo getFileMetadataFromFilesystem(FileAccessPoint accessPoint, String relativePath) throws Exception {
        String basePath = accessPoint.resolveBaseDirPath();
        if (basePath == null) {
            throw new IllegalArgumentException("dir_path_base not configured");
        }
        
        basePath = expandHomePath(basePath);
        Path fullPath = Paths.get(basePath, relativePath);
        
        if (!Files.exists(fullPath)) {
            throw new IOException("File not found: " + fullPath);
        }

        FileInfo fileInfo = new FileInfo();
        fileInfo.setName(fullPath.getFileName().toString());
        fileInfo.setPath(relativePath);
        fileInfo.setSize(Files.size(fullPath));
        fileInfo.setLastModified(Files.getLastModifiedTime(fullPath).toMillis());
        fileInfo.setDirectory(Files.isDirectory(fullPath));
        
        String contentType = Files.probeContentType(fullPath);
        fileInfo.setContentType(contentType != null ? contentType : "application/octet-stream");
        
        return fileInfo;
    }

    /**
     * Get file content for local/internal type - query MongoDB by custom id field
     */
    private FileInfo getFileContentFromMongoDB(FileAccessPoint accessPoint, String fileId) throws Exception {
        System.out.println("=== getFileContentFromMongoDB ===");
        System.out.println("File ID (original): " + fileId);
        
        // Strip leading slash if present (file IDs in MongoDB don't have leading slashes)
        if (fileId.startsWith("/")) {
            fileId = fileId.substring(1);
            System.out.println("File ID (cleaned): " + fileId);
        }
        
        System.out.println("Access Point ID: " + accessPoint.getId());
        
        MongoTemplate mongoTemplate = mongoService.getMongoTemplate();
        if (mongoTemplate == null) {
            throw new IllegalStateException("MongoDB connection not available");
        }

        // Query MongoDB by custom id field
        Query query = new Query(Criteria.where("type").is("file").and("id").is(fileId));
        org.bson.Document doc = mongoTemplate.findOne(query, org.bson.Document.class, "note");
        
        if (doc == null) {
            throw new IllegalArgumentException("File not found in database: " + fileId);
        }

        System.out.println("MongoDB document found:");
        System.out.println("  - name: " + doc.getString("name"));
        System.out.println("  - path: " + doc.getString("path"));
        System.out.println("  - path: " + doc.getString("id"));
        System.out.println("  - file_access_point_id: " + doc.getString("file_access_point_id"));

        // Verify it belongs to this file access point
        String docAccessPointId = doc.getString("file_access_point_id");
        if (docAccessPointId == null || !docAccessPointId.equals(accessPoint.getId())) {
            throw new IllegalArgumentException("File does not belong to this access point");
        }

        FileInfo fileInfo = new FileInfo();
        fileInfo.setId(fileId);
        fileInfo.setName(doc.getString("name"));
        fileInfo.setPath(doc.getString("path"));
        fileInfo.setContentType(doc.getString("file_type"));
        
        Object timeUpload = doc.get("time_upload");
        if (timeUpload != null) {
            long timeUploadUs = timeUpload instanceof Long ? (Long) timeUpload : 
                               timeUpload instanceof Integer ? ((Integer) timeUpload).longValue() : 0;
            fileInfo.setLastModified(timeUploadUs / 1000);
        }

        // Read file from filesystem
        String basePath = accessPoint.resolveBaseDirPath();
        System.out.println("Base path (before expansion): " + basePath);
        if (basePath == null) {
            throw new IllegalArgumentException("dir_path_base not configured");
        }
        
        basePath = expandHomePath(basePath);
        System.out.println("Base path (after expansion): " + basePath);
        
        String relativePath = doc.getString("path");
        String originalRelativePath = relativePath;
        System.out.println("Relative path from MongoDB: " + relativePath);
        
        Path fullPath = null;
        boolean foundFile = false;
        
        // Try the path from MongoDB first
        if (relativePath != null && !relativePath.isEmpty()) {
            fullPath = Paths.get(basePath, relativePath);
            System.out.println("Trying path from MongoDB: " + fullPath);
            if (Files.exists(fullPath)) {
                foundFile = true;
                System.out.println("File found at MongoDB path!");
            }
        }
        
        // If not found, search for the file using ID-based directory patterns
        if (!foundFile) {
            System.out.println("File not found at MongoDB path, searching...");
            String fileName = doc.getString("name");
            if (fileName == null || fileName.isEmpty()) {
                // Try to construct filename from ID
                fileName = fileId;
                String fileType = doc.getString("file_type");
                if (fileType != null && fileType.contains("/")) {
                    String extension = fileType.substring(fileType.lastIndexOf("/") + 1);
                    if (!fileName.endsWith("." + extension)) {
                        fileName = fileName + "." + extension;
                    }
                }
            }
            
            fullPath = searchFileInDirectoryPatterns(basePath, fileId, fileName);
            
            if (fullPath != null && Files.exists(fullPath)) {
                foundFile = true;
                // Calculate new relative path
                relativePath = Paths.get(basePath).relativize(fullPath).toString();
                System.out.println("File found at: " + fullPath);
                System.out.println("New relative path: " + relativePath);
                
                // Update MongoDB document with correct path
                if (!relativePath.equals(originalRelativePath)) {
                    updateFilePathInMongoDB(mongoTemplate, fileId, relativePath);
                    fileInfo.setPath(relativePath);
                }
            }
        }
        
        if (!foundFile || fullPath == null) {
            throw new IOException("File not found: " + fileId + " (tried MongoDB path: " + originalRelativePath + ")");
        }
        
        fileInfo.setFileBytes(Files.readAllBytes(fullPath));
        fileInfo.setSize(Files.size(fullPath));
        
        return fileInfo;
    }

    /**
     * Get file content for local/external type - read directly from filesystem
     */
    private FileInfo getFileContentFromFilesystem(FileAccessPoint accessPoint, String relativePath) throws Exception {
        String basePath = accessPoint.resolveBaseDirPath();
        if (basePath == null) {
            throw new IllegalArgumentException("dir_path_base not configured");
        }
        
        basePath = expandHomePath(basePath);
        Path fullPath = Paths.get(basePath, relativePath);
        
        if (!Files.exists(fullPath)) {
            throw new IOException("File not found: " + fullPath);
        }
        
        if (Files.isDirectory(fullPath)) {
            throw new IllegalArgumentException("Cannot get content of a directory");
        }

        FileInfo fileInfo = new FileInfo();
        fileInfo.setName(fullPath.getFileName().toString());
        fileInfo.setPath(relativePath);
        fileInfo.setSize(Files.size(fullPath));
        fileInfo.setLastModified(Files.getLastModifiedTime(fullPath).toMillis());
        fileInfo.setFileBytes(Files.readAllBytes(fullPath));
        
        // Guess content type
        String contentType = Files.probeContentType(fullPath);
        fileInfo.setContentType(contentType != null ? contentType : "application/octet-stream");
        
        return fileInfo;
    }

    /**
     * Rename a file
     * @param fileAccessPointId The file access point ID or name
     * @param fileId The custom id field of the file (for local/internal) or relative path (for local/external)
     * @param newName The new file name
     * @return Updated FileInfo
     */
    public FileInfo renameFile(String fileAccessPointId, String filePathOrId, String newName) throws Exception {
        System.out.println("=== renameFile ===");
        System.out.println("Access Point ID: " + fileAccessPointId);
        System.out.println("File Path or ID: " + filePathOrId);
        System.out.println("New Name: " + newName);
        
        // Refresh cache to get latest config (e.g., updated base directory)
        FileAccessPoint accessPoint = refreshFileAccessPointCache(fileAccessPointId);
        if (accessPoint == null) {
            throw new IllegalArgumentException("File access point not found: " + fileAccessPointId);
        }

        String settingType = accessPoint.getSettingType();
        System.out.println("Setting Type: " + settingType);
        if (settingType == null) {
            throw new IllegalArgumentException("File access point type not configured: " + fileAccessPointId);
        }

        switch (settingType) {
            case "local/internal":
                return renameFileInMongoDB(accessPoint, filePathOrId, newName);
            case "local/external":
                return renameFileInFilesystem(accessPoint, filePathOrId, newName);
            default:
                throw new UnsupportedOperationException("Type " + settingType + " not supported yet");
        }
    }

    /**
     * Rename file for local/internal type - update MongoDB and rename on filesystem
     */
    private FileInfo renameFileInMongoDB(FileAccessPoint accessPoint, String fileId, String newName) throws Exception {
        System.out.println("=== renameFileInMongoDB ===");
        System.out.println("File ID (original): " + fileId);
        
        // Strip leading slash if present (file IDs in MongoDB don't have leading slashes)
        if (fileId.startsWith("/")) {
            fileId = fileId.substring(1);
            System.out.println("File ID (cleaned): " + fileId);
        }
        
        MongoTemplate mongoTemplate = mongoService.getMongoTemplate();
        if (mongoTemplate == null) {
            throw new IllegalStateException("MongoDB connection not available");
        }

        // Query MongoDB by custom id field
        Query query = new Query(Criteria.where("type").is("file").and("id").is(fileId));
        org.bson.Document doc = mongoTemplate.findOne(query, org.bson.Document.class, "note");
        
        if (doc == null) {
            throw new IllegalArgumentException("File not found: " + fileId);
        }

        // For local/internal files, only update the name in MongoDB
        // The physical file remains at its ID-based path (e.g., vy/vy5n8h.png)
        // The 'name' field is just metadata for display purposes
        
        String oldName = doc.getString("name");
        System.out.println("Renaming in MongoDB only: '" + oldName + "' -> '" + newName + "'");
        
        // Update only the name field in MongoDB
        org.springframework.data.mongodb.core.query.Update update = 
            new org.springframework.data.mongodb.core.query.Update();
        update.set("name", newName);
        
        mongoTemplate.updateFirst(query, update, "note");

        // Return updated file info (path remains unchanged)
        FileInfo fileInfo = new FileInfo();
        fileInfo.setId(fileId);
        fileInfo.setName(newName);
        fileInfo.setPath(doc.getString("path")); // Path stays the same
        fileInfo.setDirectory(false);
        fileInfo.setContentType(doc.getString("file_type"));
        
        // Get size from filesystem if available
        String basePath = accessPoint.resolveBaseDirPath();
        if (basePath != null) {
            basePath = expandHomePath(basePath);
            String filePath = doc.getString("path");
            if (filePath != null) {
                Path fullPath = Paths.get(basePath, filePath);
                if (Files.exists(fullPath)) {
                    fileInfo.setSize(Files.size(fullPath));
                    fileInfo.setLastModified(Files.getLastModifiedTime(fullPath).toMillis());
                }
            }
        }
        
        return fileInfo;
    }

    /**
     * Rename file for local/external type - rename on filesystem only
     */
    private FileInfo renameFileInFilesystem(FileAccessPoint accessPoint, String relativePath, String newName) throws Exception {
        String basePath = accessPoint.resolveBaseDirPath();
        if (basePath == null) {
            throw new IllegalArgumentException("dir_path_base not configured");
        }
        basePath = expandHomePath(basePath);

        Path oldFullPath = Paths.get(basePath, relativePath);
        if (!Files.exists(oldFullPath)) {
            throw new IOException("File not found: " + oldFullPath);
        }

        Path parentDir = oldFullPath.getParent();
        Path newFullPath = parentDir != null ? parentDir.resolve(newName) : Paths.get(basePath, newName);
        
        // Rename file
        Files.move(oldFullPath, newFullPath);
        
        String newPath = Paths.get(basePath).relativize(newFullPath).toString();

        FileInfo fileInfo = new FileInfo();
        fileInfo.setName(newName);
        fileInfo.setPath(newPath);
        fileInfo.setSize(Files.size(newFullPath));
        fileInfo.setLastModified(Files.getLastModifiedTime(newFullPath).toMillis());
        
        String contentType = Files.probeContentType(newFullPath);
        fileInfo.setContentType(contentType != null ? contentType : "application/octet-stream");
        
        return fileInfo;
    }

    /**
     * List files in a directory for a file access point
     * @param fileAccessPointId The file access point ID  
     * @param subPath Sub-path within the access point (can be empty for root)
     * @param page Page number (0-based)
     * @param pageSize Number of items per page
     * @return List of FileInfo objects
     */
    public List<FileInfo> listFiles(String fileAccessPointId, String subPath, int page, int pageSize) throws Exception {
        // Refresh cache to get latest config (e.g., updated base directory)
        FileAccessPoint accessPoint = refreshFileAccessPointCache(fileAccessPointId);
        if (accessPoint == null) {
            throw new IllegalArgumentException("File access point not found: " + fileAccessPointId);
        }

        String settingType = accessPoint.getSettingType();
        if (settingType == null) {
            throw new IllegalArgumentException("File access point type not configured: " + fileAccessPointId);
        }

        switch (settingType) {
            case "local/internal":
                return listFilesFromMongoDB(accessPoint, subPath, page, pageSize);
            case "local/external":
                return listFilesFromFilesystem(accessPoint, subPath, page, pageSize);
            case "local/external/time":
            case "local/external/id":
                throw new UnsupportedOperationException("Type " + settingType + " not supported yet");
            default:
                throw new IllegalArgumentException("Unsupported file access point type: " + settingType);
        }
    }

    /**
     * List files for local/internal type - query MongoDB for file documents
     */
    private List<FileInfo> listFilesFromMongoDB(FileAccessPoint accessPoint, String subPath, int page, int pageSize) {
        MongoTemplate mongoTemplate = mongoService.getMongoTemplate();
        if (mongoTemplate == null) {
            throw new IllegalStateException("MongoDB connection not available");
        }

        // Query for files belonging to this file access point
        Query query = new Query();
        query.addCriteria(Criteria.where("type").is("file"));
        query.addCriteria(Criteria.where("file_access_point_id").is(accessPoint.getId()));
        
        // Sort by upload time (most recent first)
        query.with(org.springframework.data.domain.Sort.by(
            org.springframework.data.domain.Sort.Direction.DESC, "time_upload"
        ));
        
        // Apply pagination
        query.skip(page * pageSize);
        query.limit(pageSize);

        // Query MongoDB
        List<org.bson.Document> docs = mongoTemplate.find(query, org.bson.Document.class, "note");
        
        // Convert to FileInfo objects
        List<FileInfo> fileInfoList = new ArrayList<>();
        for (org.bson.Document doc : docs) {
            FileInfo fileInfo = new FileInfo();
            String docId = doc.getString("id");
            String docPath = doc.getString("path");
            System.out.println("MongoDB doc - id: '" + docId + "', path: '" + docPath + "'");
            
            fileInfo.setId(docId); // Set the custom id field
            fileInfo.setName(doc.getString("name"));
            fileInfo.setPath(docPath);
            fileInfo.setDirectory(false); // Files from MongoDB are always files, not directories
            fileInfo.setContentType(doc.getString("file_type"));
            
            // time_upload is in microseconds, convert to milliseconds
            Object timeUpload = doc.get("time_upload");
            if (timeUpload != null) {
                long timeUploadUs = timeUpload instanceof Long ? (Long) timeUpload : 
                                   timeUpload instanceof Integer ? ((Integer) timeUpload).longValue() : 0;
                fileInfo.setLastModified(timeUploadUs / 1000); // Convert microseconds to milliseconds
            }
            
            // Get file size from filesystem if needed
            String basePath = accessPoint.getDirPathBase();
            if (basePath != null && fileInfo.getPath() != null) {
                try {
                    basePath = expandHomePath(basePath);
                    Path filePath = Paths.get(basePath, fileInfo.getPath());
                    if (Files.exists(filePath)) {
                        fileInfo.setSize(Files.size(filePath));
                    }
                } catch (IOException e) {
                    // If we can't read file size, just leave it as 0
                    fileInfo.setSize(0);
                }
            }
            
            fileInfoList.add(fileInfo);
        }
        
        return fileInfoList;
    }

    /**
     * List files for local/external type - scan filesystem directory
     */
    private List<FileInfo> listFilesFromFilesystem(FileAccessPoint accessPoint, String subPath, int page, int pageSize) throws IOException {
        String basePath = accessPoint.resolveBaseDirPath();
        if (basePath == null) {
            throw new IllegalArgumentException("dir_path_base not configured for: " + accessPoint.getId());
        }
        
        basePath = expandHomePath(basePath);
        Path dirPath = subPath == null || subPath.isEmpty() 
            ? Paths.get(basePath) 
            : Paths.get(basePath, subPath);
        
        if (!Files.exists(dirPath)) {
            throw new IOException("Directory not found: " + dirPath);
        }

        if (!Files.isDirectory(dirPath)) {
            throw new IOException("Path is not a directory: " + dirPath);
        }

        // Read all files/dirs
        List<FileInfo> allFiles = new ArrayList<>();
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(dirPath)) {
            for (Path entry : stream) {
                FileInfo fileInfo = new FileInfo();
                
                String relativePath = subPath == null || subPath.isEmpty()
                    ? entry.getFileName().toString()
                    : subPath + "/" + entry.getFileName().toString();
                
                fileInfo.setPath(relativePath);
                fileInfo.setName(entry.getFileName().toString());
                fileInfo.setDirectory(Files.isDirectory(entry));
                
                try {
                    fileInfo.setSize(Files.isDirectory(entry) ? 0 : Files.size(entry));
                    fileInfo.setContentType(Files.probeContentType(entry));
                    fileInfo.setLastModified(Files.getLastModifiedTime(entry).toMillis());
                } catch (IOException e) {
                    // If we can't read file info, skip this file
                    System.err.println("Error reading file info for: " + entry + " - " + e.getMessage());
                    continue;
                }
                
                allFiles.add(fileInfo);
            }
        }

        // Sort: directories first, then by name
        allFiles.sort((a, b) -> {
            if (a.isDirectory() != b.isDirectory()) {
                return a.isDirectory() ? -1 : 1;
            }
            return a.getName().compareTo(b.getName());
        });

        // Apply pagination
        int start = page * pageSize;
        int end = Math.min(start + pageSize, allFiles.size());
        
        if (start >= allFiles.size()) {
            return new ArrayList<>();
        }
        
        return allFiles.subList(start, end);
    }
}


