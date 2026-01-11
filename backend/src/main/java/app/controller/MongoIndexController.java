package app.controller;

import app.pojo.ApiResponse;
import app.service.MongoIndexService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Controller for managing MongoDB-Elasticsearch index metadata
 * Handles CRUD operations for indices that track MongoDB collections
 */
@RestController
@RequestMapping("/mongo/index")
public class MongoIndexController {

    @Autowired
    private MongoIndexService mongoIndexService;

    /**
     * List all MongoDB-ES indices
     */
    @GetMapping({"", "/"})
    public ApiResponse<List<Map<String, Object>>> listIndices() {
        try {
            List<Map<String, Object>> indices = mongoIndexService.listIndices();
            return new ApiResponse<>(0, indices, "Indices retrieved successfully");
        } catch (Exception e) {
            System.err.println("Failed to list indices: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to list indices: " + e.getMessage());
        }
    }

    /**
     * Get a specific index by name
     */
    @GetMapping("/{indexName}")
    public ApiResponse<Map<String, Object>> getIndex(@PathVariable String indexName) {
        try {
            Map<String, Object> index = mongoIndexService.getIndex(indexName);
            if (index == null) {
                return new ApiResponse<>(-1, null, "Index not found: " + indexName);
            }
            return new ApiResponse<>(0, index, "Index retrieved successfully");
        } catch (Exception e) {
            System.err.println("Failed to get index: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to get index: " + e.getMessage());
        }
    }

    /**
     * Create a new MongoDB-ES index
     * Request body: {
     *   "name": "my-index",
     *   "esIndex": "es_index_name",
     *   "collections": [
     *     {"database": "db1", "collection": "coll1"},
     *     {"database": "db2", "collection": "coll2"}
     *   ]
     * }
     */
    @PostMapping({"", "/"})
    public ApiResponse<Map<String, Object>> createIndex(@RequestBody Map<String, Object> requestBody) {
        try {
            String name = (String) requestBody.get("name");
            String esIndex = (String) requestBody.get("esIndex");
            @SuppressWarnings("unchecked")
            List<Map<String, String>> collections = (List<Map<String, String>>) requestBody.get("collections");

            if (name == null || name.trim().isEmpty()) {
                return new ApiResponse<>(-1, null, "Name is required");
            }
            if (esIndex == null || esIndex.trim().isEmpty()) {
                return new ApiResponse<>(-1, null, "ES index name is required");
            }
            if (collections == null) {
                collections = new java.util.ArrayList<>();
            }

            Map<String, Object> index = mongoIndexService.createIndex(name, esIndex, collections);
            return new ApiResponse<>(0, index, "Index created successfully");
        } catch (Exception e) {
            System.err.println("Failed to create index: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to create index: " + e.getMessage());
        }
    }

    /**
     * Update an existing index
     */
    @PutMapping("/{indexName}")
    public ApiResponse<Map<String, Object>> updateIndex(
            @PathVariable String indexName,
            @RequestBody Map<String, Object> requestBody) {
        try {
            String esIndex = (String) requestBody.get("esIndex");
            @SuppressWarnings("unchecked")
            List<Map<String, String>> collections = (List<Map<String, String>>) requestBody.get("collections");

            Map<String, Object> index = mongoIndexService.updateIndex(indexName, esIndex, collections);
            if (index == null) {
                return new ApiResponse<>(-1, null, "Index not found: " + indexName);
            }
            return new ApiResponse<>(0, index, "Index updated successfully");
        } catch (Exception e) {
            System.err.println("Failed to update index: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to update index: " + e.getMessage());
        }
    }

    /**
     * Delete an index
     */
    @DeleteMapping("/{indexName}")
    public ApiResponse<Void> deleteIndex(@PathVariable String indexName) {
        try {
            boolean deleted = mongoIndexService.deleteIndex(indexName);
            if (!deleted) {
                return new ApiResponse<>(-1, null, "Index not found: " + indexName);
            }
            return new ApiResponse<>(0, null, "Index deleted successfully");
        } catch (Exception e) {
            System.err.println("Failed to delete index: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to delete index: " + e.getMessage());
        }
    }

    /**
     * Search databases
     */
    @GetMapping("/search/databases")
    public ApiResponse<List<String>> searchDatabases(@RequestParam(required = false) String query) {
        try {
            List<String> databases = mongoIndexService.searchDatabases(query);
            return new ApiResponse<>(0, databases, "Databases retrieved successfully");
        } catch (Exception e) {
            System.err.println("Failed to search databases: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to search databases: " + e.getMessage());
        }
    }

    /**
     * Search collections in a database
     */
    @GetMapping("/search/collections")
    public ApiResponse<List<String>> searchCollections(
            @RequestParam String database,
            @RequestParam(required = false) String query) {
        try {
            List<String> collections = mongoIndexService.searchCollections(database, query);
            return new ApiResponse<>(0, collections, "Collections retrieved successfully");
        } catch (Exception e) {
            System.err.println("Failed to search collections: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to search collections: " + e.getMessage());
        }
    }
}

