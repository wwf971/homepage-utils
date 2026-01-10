package app.controller;

import app.pojo.ApiResponse;
import app.pojo.MongoConfig;
import app.pojo.MongoConfigUpdateRequest;
import app.pojo.MongoConnectionStatus;
import app.service.MongoConfigService;
import app.service.MongoService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/mongo/")
public class MongoController {

    private final MongoConfigService configService;
    private final MongoService mongoService;

    public MongoController(
            MongoConfigService configService,
            MongoService mongoService) {
        this.configService = configService;
        this.mongoService = mongoService;
    }

    @GetMapping("config/")
    public ApiResponse<MongoConfig> getConfig() {
        return ApiResponse.success(configService.getCurrentConfig(), "Current MongoDB configuration retrieved");
    }

    @PostMapping("config/set/")
    public ApiResponse<MongoConfig> setConfig(@RequestBody MongoConfigUpdateRequest request) {
        try {
            configService.updateConfig(request.getPath(), request.getValue());
            return ApiResponse.success(configService.getCurrentConfig(), "MongoDB configuration updated successfully");
        } catch (Exception e) {
            System.err.println("Failed to update config: " + e.getMessage());
            return ApiResponse.error(400, "Failed to update config: " + e.getMessage());
        }
    }

    @GetMapping("status/")
    public ApiResponse<MongoConnectionStatus> getStatus() {
        try {
            MongoConnectionStatus status = mongoService.getStatus();
            if (status.isConnected()) {
                return new ApiResponse<>(0, status, "Connected");
            } else {
                return new ApiResponse<>(-1, status, "Not connected");
            }
        } catch (Exception e) {
            System.err.println("Failed to get connection status: " + e.getMessage());
            return new ApiResponse<>(-2, null, "Failed to retrieve status: " + e.getMessage());
        }
    }

    @PostMapping("connection/stop/")
    public ApiResponse<Void> stopConnection() {
        try {
            mongoService.stopConnection();
            return new ApiResponse<>(0, null, "Connection stopped successfully");
        } catch (Exception e) {
            System.err.println("Failed to stop connection: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to stop connection: " + e.getMessage());
        }
    }

    @PostMapping("connection/start/")
    public ApiResponse<MongoConfig> startConnection() {
        try {
            mongoService.startConnection(configService.getCurrentConfig());
            return new ApiResponse<>(0, configService.getCurrentConfig(), "Connection started successfully");
        } catch (Exception e) {
            System.err.println("Failed to start connection: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to start connection: " + e.getMessage());
        }
    }

    @PostMapping("test/")
    public ApiResponse<String> testConnection() {
        try {
            String result = mongoService.testConnection();
            return new ApiResponse<>(0, result, "Connection test successful");
        } catch (Exception e) {
            System.err.println("Connection test failed: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Connection test failed: " + e.getMessage());
        }
    }

    @GetMapping({"db/", "db"})
    public ApiResponse<java.util.List<String>> listDatabases() {
        try {
            java.util.List<String> databases = mongoService.listAllDatabases();
            return new ApiResponse<>(0, databases, "Databases retrieved successfully");
        } catch (Exception e) {
            System.err.println("Failed to list databases: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to list databases: " + e.getMessage());
        }
    }

    @GetMapping({"db/{databaseName}/coll/", "db/{databaseName}/coll"})
    public ApiResponse<java.util.List<String>> listCollections(@PathVariable String databaseName) {
        try {
            java.util.List<String> collections = mongoService.listCollectionsInDatabase(databaseName);
            return new ApiResponse<>(0, collections, "Collections retrieved successfully");
        } catch (Exception e) {
            System.err.println("Failed to list collections in database '" + databaseName + "': " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to list collections: " + e.getMessage());
        }
    }

    @PostMapping({"db/{databaseName}/coll/", "db/{databaseName}/coll"})
    public ApiResponse<Void> createCollection(
            @PathVariable String databaseName,
            @RequestBody java.util.Map<String, String> request) {
        try {
            String collectionName = request.get("name");
            if (collectionName == null || collectionName.trim().isEmpty()) {
                return new ApiResponse<>(-1, null, "Collection name is required");
            }
            
            mongoService.createCollection(databaseName, collectionName.trim());
            return new ApiResponse<>(0, null, "Collection '" + collectionName + "' created successfully");
        } catch (Exception e) {
            System.err.println("Failed to create collection: " + e.getMessage());
            return new ApiResponse<>(-1, null, e.getMessage());
        }
    }

    @GetMapping({"db/{databaseName}/coll/{collectionName}/docs/", "db/{databaseName}/coll/{collectionName}/docs"})
    public ApiResponse<Object> listOrQueryDocuments(
            @PathVariable String databaseName,
            @PathVariable String collectionName,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam java.util.Map<String, String> allParams) {
        try {
            java.util.Map<String, String> params = new java.util.HashMap<>(allParams);
            params.remove("page");
            params.remove("pageSize");
            String extractPath = params.remove("path");
            
            if (params.isEmpty()) {
                // No filter params: list all documents with pagination
                java.util.Map<String, Object> result = mongoService.listDocumentsInCollection(
                    databaseName, collectionName, page, pageSize);
                return new ApiResponse<>(0, result, "Documents retrieved successfully");
            } else {
                // Has filter params: query for specific document(s)
                // All remaining params are treated as filter key-value pairs
                Object result = mongoService.queryDocument(
                    databaseName, collectionName, params, extractPath);
                
                return new ApiResponse<>(0, result, "Query executed successfully");
            }
        } catch (Exception e) {
            System.err.println("Failed to process request: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to process request: " + e.getMessage());
        }
    }

    @PostMapping({"db/{databaseName}/coll/{collectionName}/docs/", "db/{databaseName}/coll/{collectionName}/docs"})
    public ApiResponse<org.bson.Document> createEmptyDocument(
            @PathVariable String databaseName,
            @PathVariable String collectionName) {
        try {
            org.bson.Document newDoc = mongoService.createEmptyDocument(databaseName, collectionName);
            return new ApiResponse<>(0, newDoc, "Empty document created successfully");
        } catch (Exception e) {
            System.err.println("Failed to create empty document: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to create document: " + e.getMessage());
        }
    }

    @PatchMapping({"db/{databaseName}/coll/{collectionName}/docs/{docId}", "db/{databaseName}/coll/{collectionName}/docs/{docId}/"})
    public ApiResponse<org.bson.Document> updateDocument(
            @PathVariable String databaseName,
            @PathVariable String collectionName,
            @PathVariable String docId,
            @RequestBody java.util.Map<String, Object> updateRequest) {
        try {
            String action = (String) updateRequest.get("action");
            String path = (String) updateRequest.get("path");
            Object value = updateRequest.get("value");
            Integer position = updateRequest.containsKey("position") ? (Integer) updateRequest.get("position") : null;

            org.bson.Document updatedDoc = mongoService.updateDocument(
                databaseName, collectionName, docId, action, path, value, position);
            
            return new ApiResponse<>(0, updatedDoc, "Document updated successfully");
        } catch (Exception e) {
            System.err.println("Failed to update document '" + docId + "': " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to update document: " + e.getMessage());
        }
    }

    @DeleteMapping({"db/{databaseName}/coll/{collectionName}/docs/{docId}", "db/{databaseName}/coll/{collectionName}/docs/{docId}/"})
    public ApiResponse<Void> deleteDocument(
            @PathVariable String databaseName,
            @PathVariable String collectionName,
            @PathVariable String docId) {
        try {
            mongoService.deleteDocument(databaseName, collectionName, docId);
            return new ApiResponse<>(0, null, "Document deleted successfully");
        } catch (Exception e) {
            System.err.println("Failed to delete document '" + docId + "': " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to delete document: " + e.getMessage());
        }
    }
}

