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

    @GetMapping("config/app/")
    public ApiResponse<MongoConfig> getAppConfig() {
        return ApiResponse.success(configService.getAppConfig(), "MongoDB application.properties configuration retrieved");
    }

    @GetMapping("config/")
    public ApiResponse<MongoConfig> getConfig() {
        return ApiResponse.success(configService.getConfigCurrent(), "Current MongoDB configuration retrieved");
    }

    @PostMapping("config/set/")
    public ApiResponse<MongoConfig> setConfig(@RequestBody MongoConfigUpdateRequest request) {
        try {
            configService.updateConfig(request.getPath(), request.getValue());
            return ApiResponse.success(configService.getConfigCurrent(), "MongoDB configuration updated successfully");
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
            mongoService.startConnection(configService.getConfigCurrent());
            return new ApiResponse<>(0, configService.getConfigCurrent(), "Connection started successfully");
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

    @GetMapping({"db/list", "db/list/"})
    public ApiResponse<java.util.List<String>> listDatabases() {
        try {
            java.util.List<String> databases = mongoService.listAllDatabases();
            return new ApiResponse<>(0, databases, "Databases retrieved successfully");
        } catch (Exception e) {
            System.err.println("Failed to list databases: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to list databases: " + e.getMessage());
        }
    }

    @GetMapping({"db/{dbName}/coll/list", "db/{dbName}/coll/list/"})
    public ApiResponse<java.util.List<String>> listCollections(@PathVariable String dbName) {
        try {
            java.util.List<String> collections = mongoService.listCollectionsInDatabase(dbName);
            return new ApiResponse<>(0, collections, "Collections retrieved successfully");
        } catch (Exception e) {
            System.err.println("Failed to list collections in database '" + dbName + "': " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to list collections: " + e.getMessage());
        }
    }

    @PostMapping({"db/{dbName}/coll/{collName}/create", "db/{dbName}/coll/{collName}/create/"})
    public ApiResponse<Void> createCollection(
            @PathVariable String dbName,
            @PathVariable String collName) {
        try {
            if (collName == null || collName.trim().isEmpty()) {
                return new ApiResponse<>(-1, null, "Collection name is required");
            }
            
            mongoService.createCollection(dbName, collName.trim());
            return new ApiResponse<>(0, null, "Collection '" + collName + "' created successfully");
        } catch (Exception e) {
            System.err.println("Failed to create collection: " + e.getMessage());
            return new ApiResponse<>(-1, null, e.getMessage());
        }
    }

    @DeleteMapping({"db/{dbName}/coll/{collName}/delete", "db/{dbName}/coll/{collName}/delete/"})
    public ApiResponse<Void> deleteCollection(
            @PathVariable String dbName,
            @PathVariable String collName) {
        try {
            mongoService.deleteCollection(dbName, collName);
            return new ApiResponse<>(0, null, "Collection '" + collName + "' deleted successfully");
        } catch (Exception e) {
            System.err.println("Failed to delete collection: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to delete collection: " + e.getMessage());
        }
    }

    // Query single document (first match) with optional path extraction
    @GetMapping({"db/{dbName}/coll/{collName}/doc/query", "db/{dbName}/coll/{collName}/doc/query/"})
    public ApiResponse<Object> querySingleDocument(
            @PathVariable String dbName,
            @PathVariable String collName,
            @RequestParam java.util.Map<String, String> allParams) {
        try {
            java.util.Map<String, String> params = new java.util.HashMap<>(allParams);
            String extractPath = params.remove("path");
            String sortBy = params.remove("sort");
            String sortOrder = params.remove("sortOrder");
            
            if (params.isEmpty()) {
                return new ApiResponse<>(-1, null, "At least one filter parameter is required for document query");
            }
            
            // Query for first matching document
            // Example url: /mongo/db/test/coll/test/doc?key1=value1&path=.&sort=field1&sortOrder=asc
            Object result = mongoService.queryDocument(
                dbName, collName, params, extractPath, sortBy, sortOrder);
            
            return new ApiResponse<>(0, result, "Document query executed successfully");
        } catch (Exception e) {
            System.err.println("Failed to query document: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to query document: " + e.getMessage());
        }
    }

    // Query all matching documents or list with pagination
    @GetMapping({"db/{dbName}/coll/{collName}/docs/list", "db/{dbName}/coll/{collName}/docs/list/"})
    public ApiResponse<Object> listOrQueryAllDocuments(
            @PathVariable String dbName,
            @PathVariable String collName,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam java.util.Map<String, String> allParams) {
        try {
            java.util.Map<String, String> params = new java.util.HashMap<>(allParams);
            params.remove("page");
            params.remove("pageSize");
            params.remove("path");  // path is for single doc query with extraction, not for filtering
            String sortBy = params.remove("sort");
            String sortOrder = params.remove("sortOrder");
            
            if (params.isEmpty()) {
                // No filter params: list all documents with pagination
                java.util.Map<String, Object> result = mongoService.listDocumentsInCollection(
                    dbName, collName, page, pageSize);
                return new ApiResponse<>(0, result, "Documents retrieved successfully");
            } else {
                // Has filter params: query all matching documents with pagination
                // Example url: /mongo/db/test/coll/test/docs?key1=value1&sort=field1,field2&sortOrder=asc&page=1&pageSize=20
                java.util.Map<String, Object> result = mongoService.queryAllDocuments(
                    dbName, collName, params, sortBy, sortOrder, page, pageSize);
                
                return new ApiResponse<>(0, result, "Query executed successfully");
            }
        } catch (Exception e) {
            System.err.println("Failed to process request: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to process request: " + e.getMessage());
        }
    }

    @PostMapping({"db/{dbName}/coll/{collName}/docs/create", "db/{dbName}/coll/{collName}/docs/create/"})
    public ApiResponse<org.bson.Document> createEmptyDocument(
            @PathVariable String dbName,
            @PathVariable String collName) {
        try {
            org.bson.Document newDoc = mongoService.createEmptyDocument(dbName, collName);
            return new ApiResponse<>(0, newDoc, "Empty document created successfully");
        } catch (Exception e) {
            System.err.println("Failed to create empty document: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to create document: " + e.getMessage());
        }
    }

    @PatchMapping({"db/{dbName}/coll/{collName}/docs/{docId}/update", "db/{dbName}/coll/{collName}/docs/{docId}/update/"})
    public ApiResponse<org.bson.Document> updateDocument(
            @PathVariable String dbName,
            @PathVariable String collName,
            @PathVariable String docId,
            @RequestBody java.util.Map<String, Object> updateRequest) {
        try {
            String action = (String) updateRequest.get("action");
            String path = (String) updateRequest.get("path");
            Object value = updateRequest.get("value");
            Integer position = updateRequest.containsKey("position") ? (Integer) updateRequest.get("position") : null;

            org.bson.Document updatedDoc = mongoService.updateDocument(
                dbName, collName, docId, action, path, value, position);
            
            return new ApiResponse<>(0, updatedDoc, "Document updated successfully");
        } catch (Exception e) {
            System.err.println("Failed to update document '" + docId + "': " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to update document: " + e.getMessage());
        }
    }

    @DeleteMapping({"db/{dbName}/coll/{collName}/docs/{docId}/delete", "db/{dbName}/coll/{collName}/docs/{docId}/delete/"})
    public ApiResponse<Void> deleteDocument(
            @PathVariable String dbName,
            @PathVariable String collName,
            @PathVariable String docId) {
        try {
            mongoService.deleteDocument(dbName, collName, docId);
            return new ApiResponse<>(0, null, "Document deleted successfully");
        } catch (Exception e) {
            System.err.println("Failed to delete document '" + docId + "': " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to delete document: " + e.getMessage());
        }
    }
}

