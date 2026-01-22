package app.controller;

import app.pojo.ApiResponse;
import app.service.MongoIndexService;
import app.service.ElasticSearchService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Controller for managing MongoDB-Elasticsearch index metadata
 * Handles CRUD operations for indices that track MongoDB collections
 */
@RestController
@RequestMapping("/mongo-index")
public class MongoIndexController {

    @Autowired
    private MongoIndexService mongoIndexService;

    @Autowired
    private ElasticSearchService elasticSearchService;

    /**
     * List all MongoDB-ES indices
     */
    @GetMapping({"/list", "/list/"})
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
    @PostMapping({"/create", "/create/"})
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
    @PutMapping({"/{indexName}/update", "/{indexName}/update/"})
    public ApiResponse<Map<String, Object>> updateIndexCollections(
            @PathVariable String indexName,
            @RequestBody Map<String, Object> requestBody) {
        try {
            String esIndex = (String) requestBody.get("esIndex");
            @SuppressWarnings("unchecked")
            List<Map<String, String>> collections = (List<Map<String, String>>) requestBody.get("collections");

            Map<String, Object> index = mongoIndexService.updateIndexCollections(indexName, esIndex, collections);
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
    @DeleteMapping({"/{indexName}/delete", "/{indexName}/delete/"})
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

    /**
     * Get all indices that monitor a specific collection
     * Query params: database, collection
     */
    @GetMapping("/indices-of-collection")
    public ApiResponse<Set<String>> getIndicesOfCollection(
            @RequestParam String database,
            @RequestParam String collection) {
        try {
            Set<String> indices = mongoIndexService.getIndicesOfColl(database, collection);
            return new ApiResponse<>(0, indices, 
                "Found " + indices.size() + " index(es) monitoring " + database + "." + collection);
        } catch (Exception e) {
            System.err.println("Failed to get indices for collection: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to get indices for collection: " + e.getMessage());
        }
    }

    /**
     * Get all indices that monitor a specific collection (alternative URL pattern)
     * Path params: dbName, collName
     */
    @GetMapping({"db/{dbName}/coll/{collName}/index/list", "db/{dbName}/coll/{collName}/index/list/"})
    public ApiResponse<Set<String>> getIndicesOfCollectionByPath(
            @PathVariable String dbName,
            @PathVariable String collName) {
        try {
            Set<String> indices = mongoIndexService.getIndicesOfColl(dbName, collName);
            return new ApiResponse<>(0, indices, 
                "Found " + indices.size() + " index(es) monitoring " + dbName + "." + collName);
        } catch (Exception e) {
            System.err.println("Failed to get indices for collection: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to get indices for collection: " + e.getMessage());
        }
    }

    /**
     * Delete a collection and remove it from all indices that monitor it
     * Path params: dbName, collName
     */
    @DeleteMapping({"db/{dbName}/coll/{collName}/delete", "db/{dbName}/coll/{collName}/delete/"})
    public ApiResponse<java.util.Map<String, Object>> deleteCollectionFromIndices(
            @PathVariable String dbName,
            @PathVariable String collName) {
        try {
            java.util.Map<String, Object> result = mongoIndexService.deleteCollectionFromIndices(dbName, collName);
            
            if ((Integer) result.get("code") != 0) {
                return new ApiResponse<>(-1, null, (String) result.get("message"));
            }

            @SuppressWarnings("unchecked")
            java.util.Map<String, Object> data = (java.util.Map<String, Object>) result.get("data");
            return new ApiResponse<>(0, data, (String) result.get("message"));
        } catch (Exception e) {
            System.err.println("Failed to delete collection from indices: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to delete collection from indices: " + e.getMessage());
        }
    }

    /**
     * Manually trigger rebuild of the collection->indices mapping
     */
    @PostMapping("/rebuild-collection-mapping")
    public ApiResponse<String> rebuildCollectionMapping() {
        try {
            mongoIndexService.buildIndicesOfColl();
            return new ApiResponse<>(0, "success", "Collection->indices mapping rebuilt successfully");
        } catch (Exception e) {
            System.err.println("Failed to rebuild collection mapping: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to rebuild collection mapping: " + e.getMessage());
        }
    }

    // ============================================================================
    // Document Operations
    // ============================================================================

    /**
     * Update a document in the indexed collections
     * Request body: {
     *   "updateDict": {"field.path": value, ...},
     *   "updateIndex": true/false (optional, default true)
     * }
     */
    @PutMapping({"/{indexName}/doc/{dbName}/{collName}/{docId}/update", "/{indexName}/doc/{dbName}/{collName}/{docId}/update/"})
    public ApiResponse<Map<String, Object>> updateDoc(
            @PathVariable String indexName,
            @PathVariable String dbName,
            @PathVariable String collName,
            @PathVariable String docId,
            @RequestBody Map<String, Object> requestBody) {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> updateDict = (Map<String, Object>) requestBody.get("updateDict");
            Boolean updateIndex = (Boolean) requestBody.get("updateIndex");
            if (updateIndex == null) {
                updateIndex = true;
            }

            if (updateDict == null || updateDict.isEmpty()) {
                return new ApiResponse<>(-1, null, "updateDict is required");
            }

            Map<String, Object> result = mongoIndexService.updateDoc(indexName, dbName, collName, docId, updateDict, updateIndex);
            
            if ((Integer) result.get("code") != 0) {
                return new ApiResponse<>(-1, null, (String) result.get("message"));
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) result.get("data");
            return new ApiResponse<>(0, data, (String) result.get("message"));
        } catch (Exception e) {
            System.err.println("Failed to update document: " + e.getMessage());
            e.printStackTrace();
            return new ApiResponse<>(-1, null, "Failed to update document: " + e.getMessage());
        }
    }

    /**
     * Get a document (calls raw CRUD API)
     */
    @GetMapping({"/{indexName}/doc/{dbName}/{collName}/{docId}/get", "/{indexName}/doc/{dbName}/{collName}/{docId}/get/"})
    public ApiResponse<Object> getDoc(
            @PathVariable String indexName,
            @PathVariable String dbName,
            @PathVariable String collName,
            @PathVariable String docId) {
        try {
            Map<String, Object> result = mongoIndexService.getDocRaw(dbName, collName, docId);
            
            if ((Integer) result.get("code") != 0) {
                return new ApiResponse<>(-1, null, (String) result.get("message"));
            }

            return new ApiResponse<>(0, result.get("data"), "Document retrieved successfully");
        } catch (Exception e) {
            System.err.println("Failed to get document: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to get document: " + e.getMessage());
        }
    }

    /**
     * Delete a document (soft delete)
     */
    @DeleteMapping({"/{indexName}/doc/{dbName}/{collName}/{docId}/delete", "/{indexName}/doc/{dbName}/{collName}/{docId}/delete/"})
    public ApiResponse<Void> deleteDoc(
            @PathVariable String indexName,
            @PathVariable String dbName,
            @PathVariable String collName,
            @PathVariable String docId) {
        try {
            Map<String, Object> result = mongoIndexService.deleteDoc(indexName, dbName, collName, docId);
            
            if ((Integer) result.get("code") != 0) {
                return new ApiResponse<>(-1, null, (String) result.get("message"));
            }

            return new ApiResponse<>(0, null, (String) result.get("message"));
        } catch (Exception e) {
            System.err.println("Failed to delete document: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to delete document: " + e.getMessage());
        }
    }

    // ============================================================================
    // Index Management Operations
    // ============================================================================

    /**
     * Rebuild an index (clear and reindex all documents)
     * Optional query param: maxDocs (e.g., ?maxDocs=10 to rebuild only 10 docs)
     */
    @PostMapping("/{indexName}/rebuild")
    public ApiResponse<Map<String, Object>> rebuildIndex(
            @PathVariable String indexName,
            @RequestParam(required = false) Integer maxDocs) {
        try {
            Map<String, Object> result = mongoIndexService.rebuildIndex(indexName, maxDocs);
            
            if ((Integer) result.get("code") != 0) {
                return new ApiResponse<>(-1, null, (String) result.get("message"));
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) result.get("data");
            return new ApiResponse<>(0, data, (String) result.get("message"));
        } catch (Exception e) {
            System.err.println("Failed to rebuild index: " + e.getMessage());
            e.printStackTrace();
            return new ApiResponse<>(-1, null, "Failed to rebuild index: " + e.getMessage());
        }
    }

    /**
     * Incremental rebuild: only reindex documents with status=-1 in IndexQueue
     * Much faster than full rebuild as it uses IndexQueue
     * Optional query param: maxDocs (e.g., ?maxDocs=10 to rebuild only 10 docs)
     */
    @PostMapping("/{indexName}/rebuild-incremental")
    public ApiResponse<Map<String, Object>> rebuildIndexIncremental(
            @PathVariable String indexName,
            @RequestParam(required = false) Integer maxDocs) {
        try {
            Map<String, Object> result = mongoIndexService.rebuildIndexForDocsWithOldIndex(indexName, maxDocs);
            
            if ((Integer) result.get("code") != 0) {
                return new ApiResponse<>(-1, null, (String) result.get("message"));
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) result.get("data");
            return new ApiResponse<>(0, data, (String) result.get("message"));
        } catch (Exception e) {
            System.err.println("Failed to rebuild index incrementally: " + e.getMessage());
            e.printStackTrace();
            return new ApiResponse<>(-1, null, "Failed to rebuild index incrementally: " + e.getMessage());
        }
    }

    /**
     * Get statistics for an index
     */
    @GetMapping("/{indexName}/stats")
    public ApiResponse<Map<String, Object>> getIndexStats(@PathVariable String indexName) {
        try {
            Map<String, Object> result = mongoIndexService.getIndexStats(indexName);
            
            if ((Integer) result.get("code") != 0) {
                return new ApiResponse<>(-1, null, (String) result.get("message"));
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) result.get("data");
            return new ApiResponse<>(0, data, "Stats retrieved successfully");
        } catch (Exception e) {
            System.err.println("Failed to get stats: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to get stats: " + e.getMessage());
        }
    }

    /**
     * Search documents in the Elasticsearch index
     * Request body: {
     *   "query": "search text",
     *   "search_in_paths": true/false,
     *   "search_in_values": true/false
     * }
     */
    @PostMapping("/{indexName}/search")
    public ApiResponse<List<Map<String, Object>>> searchIndex(
            @PathVariable String indexName,
            @RequestBody Map<String, Object> searchParams) {
        try {
            // Get the index configuration to find the ES index name
            Map<String, Object> index = mongoIndexService.getIndex(indexName);
            if (index == null) {
                return new ApiResponse<>(-1, null, "Index not found: " + indexName);
            }

            String esIndexName = (String) index.get("esIndex");
            if (esIndexName == null || esIndexName.trim().isEmpty()) {
                return new ApiResponse<>(-1, null, "ES index name not configured for: " + indexName);
            }

            // Delegate to ElasticSearchService for the search
            String query = (String) searchParams.get("query");
            Boolean searchInPaths = (Boolean) searchParams.get("search_in_paths");
            Boolean searchInValues = (Boolean) searchParams.get("search_in_values");

            if (query == null || query.trim().isEmpty()) {
                return new ApiResponse<>(-1, null, "Query parameter is required");
            }

            if (searchInPaths == null) searchInPaths = false;
            if (searchInValues == null) searchInValues = true;

            List<Map<String, Object>> results = elasticSearchService.searchCharIndex(
                esIndexName, query, searchInPaths, searchInValues
            );

            return new ApiResponse<>(0, results, "Search completed successfully");
        } catch (Exception e) {
            System.err.println("Failed to search index: " + e.getMessage());
            e.printStackTrace();
            return new ApiResponse<>(-1, null, "Failed to search index: " + e.getMessage());
        }
    }
}

