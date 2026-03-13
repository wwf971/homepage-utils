package app.service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.bson.Document;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Updates;

import app.pojo.ApiResponse;
import app.pojo.FileAccessPoint;

@Service
public class MongoAppFileAccess {

    private static final String APP_DB_NAME = "mongo-app";
    private static final String APP_METADATA_COLL_NAME = "__app__";

    @Autowired
    private MongoService mongoService;

    @Autowired
    private FileAccessPointService fileAccessPointService;

    @Autowired
    private LocalConfigService localConfigService;

    // ==================== Helpers ====================

    private MongoCollection<Document> getAppMetadataCollection() {
        MongoClient client = mongoService.getMongoClient();
        MongoDatabase database = client.getDatabase(APP_DB_NAME);
        return database.getCollection(APP_METADATA_COLL_NAME);
    }

    private String expandHomePath(String path) {
        return (path != null && path.startsWith("~/"))
                ? System.getProperty("user.home") + path.substring(1)
                : path;
    }

    private String getServerName() {
        try {
            return localConfigService.getConfig("serverName");
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Find a registration entry by alias id in the app metadata.
     */
    private Document findFileAccess(String appId, String fileAccessId) {
        Document appDoc = getAppMetadataCollection().find(Filters.eq("appId", appId)).first();
        if (appDoc == null) return null;
        @SuppressWarnings("unchecked")
        List<Document> fileAccesses = (List<Document>) appDoc.get("fileAccesses");
        if (fileAccesses == null) return null;
        for (Document d : fileAccesses) {
            if (fileAccessId.equals(d.getString("id"))) return d;
        }
        return null;
    }

    /**
     * Resolve the absolute path of the registration root directory.
     */
    private Path resolveRegistrationRoot(FileAccessPoint fap, String registrationPath) {
        String baseDir = expandHomePath(fap.resolveBaseDirPath(getServerName()));
        if (baseDir == null) {
            throw new IllegalArgumentException("Cannot resolve base dir for FAP: " + fap.getId());
        }
        if (registrationPath == null || registrationPath.isEmpty()) {
            return Paths.get(baseDir).normalize();
        }
        return Paths.get(baseDir, registrationPath).normalize();
    }

    /**
     * Resolve a user-supplied relative filePath against the registration root,
     * rejecting any attempt to escape outside the root.
     */
    private Path resolveTargetPath(Path registrationRoot, String filePath) {
        if (filePath == null || filePath.isEmpty() || filePath.equals("/")) {
            return registrationRoot;
        }
        Path target = registrationRoot.resolve(filePath).normalize();
        if (!target.startsWith(registrationRoot)) {
            throw new SecurityException("Path traversal detected: " + filePath);
        }
        return target;
    }

    /**
     * Validate that a FAP exists and is of type local/external.
     */
    private FileAccessPoint getAndValidateFap(String fileAccessPointId) {
        FileAccessPoint fap = fileAccessPointService.getFileAccessPoint(fileAccessPointId);
        if (fap == null) {
            throw new IllegalArgumentException("File access point not found: " + fileAccessPointId);
        }
        if (!"local/external".equals(fap.getSettingType())) {
            throw new IllegalArgumentException("Only local/external file access points are supported, got: " + fap.getSettingType());
        }
        return fap;
    }

    // ==================== CRUD for registrations ====================

    public ApiResponse<List<Map<String, Object>>> listFileAccesses(String appId) {
        Document appDoc = getAppMetadataCollection().find(Filters.eq("appId", appId)).first();
        if (appDoc == null) {
            return ApiResponse.error("App not found: " + appId);
        }
        @SuppressWarnings("unchecked")
        List<Document> fileAccesses = (List<Document>) appDoc.get("fileAccesses");
        List<Map<String, Object>> result = new ArrayList<>();
        if (fileAccesses != null) {
            for (Document d : fileAccesses) {
                Map<String, Object> item = new HashMap<>();
                item.put("id", d.getString("id"));
                item.put("fileAccessPointId", d.getString("fileAccessPointId"));
                item.put("path", d.getString("path"));
                item.put("addedAt", d.getLong("addedAt"));
                result.add(item);
            }
        }
        return ApiResponse.success(result);
    }

    public ApiResponse<Map<String, Object>> addFileAccess(String appId, String id, String fileAccessPointId, String path) {
        if (id == null || id.trim().isEmpty()) {
            return ApiResponse.error("id is required");
        }
        if (fileAccessPointId == null || fileAccessPointId.trim().isEmpty()) {
            return ApiResponse.error("fileAccessPointId is required");
        }
        if (path == null) path = "";

        try {
            getAndValidateFap(fileAccessPointId);
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(e.getMessage());
        }

        MongoCollection<Document> col = getAppMetadataCollection();
        Document appDoc = col.find(Filters.eq("appId", appId)).first();
        if (appDoc == null) {
            return ApiResponse.error("App not found: " + appId);
        }

        @SuppressWarnings("unchecked")
        List<Document> fileAccesses = (List<Document>) appDoc.get("fileAccesses");
        if (fileAccesses == null) fileAccesses = new ArrayList<>();

        String trimmedId = id.trim();
        for (Document d : fileAccesses) {
            if (trimmedId.equals(d.getString("id"))) {
                return ApiResponse.error("File access id already exists: " + trimmedId);
            }
        }

        Document entry = new Document();
        entry.put("id", trimmedId);
        entry.put("fileAccessPointId", fileAccessPointId.trim());
        entry.put("path", path.trim());
        entry.put("addedAt", System.currentTimeMillis());
        fileAccesses.add(entry);

        col.updateOne(Filters.eq("appId", appId), Updates.set("fileAccesses", fileAccesses));

        Map<String, Object> result = new HashMap<>();
        result.put("id", trimmedId);
        result.put("fileAccessPointId", fileAccessPointId.trim());
        result.put("path", path.trim());
        return ApiResponse.success(result, "File access added successfully");
    }

    public ApiResponse<Map<String, Object>> removeFileAccess(String appId, String id) {
        if (id == null || id.trim().isEmpty()) {
            return ApiResponse.error("id is required");
        }
        MongoCollection<Document> col = getAppMetadataCollection();
        Document appDoc = col.find(Filters.eq("appId", appId)).first();
        if (appDoc == null) {
            return ApiResponse.error("App not found: " + appId);
        }
        @SuppressWarnings("unchecked")
        List<Document> fileAccesses = (List<Document>) appDoc.get("fileAccesses");
        if (fileAccesses == null || !fileAccesses.removeIf(d -> id.trim().equals(d.getString("id")))) {
            return ApiResponse.error("File access not found: " + id);
        }
        col.updateOne(Filters.eq("appId", appId), Updates.set("fileAccesses", fileAccesses));
        Map<String, Object> result = new HashMap<>();
        result.put("id", id.trim());
        return ApiResponse.success(result, "Removed successfully");
    }

    public ApiResponse<Map<String, Object>> updateFileAccess(String appId, String id,
                                                             String newFileAccessPointId, String newPath) {
        if (id == null || id.trim().isEmpty()) {
            return ApiResponse.error("id is required");
        }
        if (newFileAccessPointId == null || newFileAccessPointId.trim().isEmpty()) {
            return ApiResponse.error("fileAccessPointId is required");
        }
        if (newPath == null) newPath = "";

        try {
            getAndValidateFap(newFileAccessPointId);
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(e.getMessage());
        }

        MongoCollection<Document> col = getAppMetadataCollection();
        Document appDoc = col.find(Filters.eq("appId", appId)).first();
        if (appDoc == null) {
            return ApiResponse.error("App not found: " + appId);
        }
        @SuppressWarnings("unchecked")
        List<Document> fileAccesses = (List<Document>) appDoc.get("fileAccesses");
        if (fileAccesses == null) {
            return ApiResponse.error("File access not found: " + id);
        }
        boolean found = false;
        for (Document d : fileAccesses) {
            if (id.trim().equals(d.getString("id"))) {
                d.put("fileAccessPointId", newFileAccessPointId.trim());
                d.put("path", newPath.trim());
                found = true;
                break;
            }
        }
        if (!found) {
            return ApiResponse.error("File access not found: " + id);
        }
        col.updateOne(Filters.eq("appId", appId), Updates.set("fileAccesses", fileAccesses));
        Map<String, Object> result = new HashMap<>();
        result.put("id", id.trim());
        result.put("fileAccessPointId", newFileAccessPointId.trim());
        result.put("path", newPath.trim());
        return ApiResponse.success(result, "Updated successfully");
    }

    // ==================== File operations (for Groovy scripts) ====================

    public ApiResponse<Map<String, Object>> listFiles(String appId, String fileAccessId, String subPath) {
        Document reg = findFileAccess(appId, fileAccessId);
        if (reg == null) return ApiResponse.error("File access not found: " + fileAccessId);
        try {
            FileAccessPoint fap = getAndValidateFap(reg.getString("fileAccessPointId"));
            Path regRoot = resolveRegistrationRoot(fap, reg.getString("path"));
            Path targetDir = resolveTargetPath(regRoot, subPath);

            if (!Files.exists(targetDir)) return ApiResponse.error("Directory not found: " + subPath);
            if (!Files.isDirectory(targetDir)) return ApiResponse.error("Not a directory: " + subPath);

            List<Map<String, Object>> files = new ArrayList<>();
            try (java.nio.file.DirectoryStream<Path> stream = Files.newDirectoryStream(targetDir)) {
                for (Path entry : stream) {
                    Map<String, Object> info = new HashMap<>();
                    info.put("name", entry.getFileName().toString());
                    info.put("path", regRoot.relativize(entry).toString());
                    info.put("isDirectory", Files.isDirectory(entry));
                    try {
                        info.put("size", Files.isDirectory(entry) ? 0 : Files.size(entry));
                        info.put("lastModified", Files.getLastModifiedTime(entry).toMillis());
                    } catch (IOException ignored) {
                        info.put("size", 0);
                    }
                    files.add(info);
                }
            }
            files.sort((a, b) -> {
                boolean aDir = Boolean.TRUE.equals(a.get("isDirectory"));
                boolean bDir = Boolean.TRUE.equals(b.get("isDirectory"));
                if (aDir != bDir) return aDir ? -1 : 1;
                return ((String) a.get("name")).compareTo((String) b.get("name"));
            });
            Map<String, Object> result = new HashMap<>();
            result.put("files", files);
            result.put("path", subPath == null ? "" : subPath);
            return ApiResponse.success(result);
        } catch (SecurityException | IllegalArgumentException e) {
            return ApiResponse.error(e.getMessage());
        } catch (Exception e) {
            return ApiResponse.error("Failed to list files: " + e.getMessage());
        }
    }

    public ApiResponse<Map<String, Object>> fileExists(String appId, String fileAccessId, String filePath) {
        Document reg = findFileAccess(appId, fileAccessId);
        if (reg == null) return ApiResponse.error("File access not found: " + fileAccessId);
        try {
            FileAccessPoint fap = getAndValidateFap(reg.getString("fileAccessPointId"));
            Path regRoot = resolveRegistrationRoot(fap, reg.getString("path"));
            Path target = resolveTargetPath(regRoot, filePath);
            Map<String, Object> result = new HashMap<>();
            result.put("exists", Files.exists(target));
            result.put("isDirectory", Files.isDirectory(target));
            return ApiResponse.success(result);
        } catch (SecurityException | IllegalArgumentException e) {
            return ApiResponse.error(e.getMessage());
        } catch (Exception e) {
            return ApiResponse.error("Failed to check existence: " + e.getMessage());
        }
    }

    public ApiResponse<Map<String, Object>> readFile(String appId, String fileAccessId, String filePath) {
        Document reg = findFileAccess(appId, fileAccessId);
        if (reg == null) return ApiResponse.error("File access not found: " + fileAccessId);
        try {
            FileAccessPoint fap = getAndValidateFap(reg.getString("fileAccessPointId"));
            Path regRoot = resolveRegistrationRoot(fap, reg.getString("path"));
            Path target = resolveTargetPath(regRoot, filePath);
            if (!Files.exists(target)) return ApiResponse.error("File not found: " + filePath);
            if (Files.isDirectory(target)) return ApiResponse.error("Path is a directory: " + filePath);
            String content = new String(Files.readAllBytes(target), StandardCharsets.UTF_8);
            Map<String, Object> result = new HashMap<>();
            result.put("content", content);
            result.put("path", filePath);
            return ApiResponse.success(result);
        } catch (SecurityException | IllegalArgumentException e) {
            return ApiResponse.error(e.getMessage());
        } catch (Exception e) {
            return ApiResponse.error("Failed to read file: " + e.getMessage());
        }
    }

    public ApiResponse<Map<String, Object>> writeFile(String appId, String fileAccessId, String filePath, String content) {
        if (filePath == null || filePath.isEmpty() || filePath.equals("/")) {
            return ApiResponse.error("filePath is required");
        }
        Document reg = findFileAccess(appId, fileAccessId);
        if (reg == null) return ApiResponse.error("File access not found: " + fileAccessId);
        try {
            FileAccessPoint fap = getAndValidateFap(reg.getString("fileAccessPointId"));
            Path regRoot = resolveRegistrationRoot(fap, reg.getString("path"));
            Path target = resolveTargetPath(regRoot, filePath);
            Files.createDirectories(target.getParent());
            Files.write(target, (content == null ? "" : content).getBytes(StandardCharsets.UTF_8));
            Map<String, Object> result = new HashMap<>();
            result.put("path", filePath);
            return ApiResponse.success(result, "File written successfully");
        } catch (SecurityException | IllegalArgumentException e) {
            return ApiResponse.error(e.getMessage());
        } catch (Exception e) {
            return ApiResponse.error("Failed to write file: " + e.getMessage());
        }
    }

    public ApiResponse<Map<String, Object>> deleteFile(String appId, String fileAccessId, String filePath) {
        if (filePath == null || filePath.isEmpty() || filePath.equals("/")) {
            return ApiResponse.error("filePath is required");
        }
        Document reg = findFileAccess(appId, fileAccessId);
        if (reg == null) return ApiResponse.error("File access not found: " + fileAccessId);
        try {
            FileAccessPoint fap = getAndValidateFap(reg.getString("fileAccessPointId"));
            Path regRoot = resolveRegistrationRoot(fap, reg.getString("path"));
            Path target = resolveTargetPath(regRoot, filePath);
            if (!Files.exists(target)) return ApiResponse.error("File not found: " + filePath);
            Files.delete(target);
            Map<String, Object> result = new HashMap<>();
            result.put("path", filePath);
            return ApiResponse.success(result, "File deleted successfully");
        } catch (SecurityException | IllegalArgumentException e) {
            return ApiResponse.error(e.getMessage());
        } catch (Exception e) {
            return ApiResponse.error("Failed to delete file: " + e.getMessage());
        }
    }
}
