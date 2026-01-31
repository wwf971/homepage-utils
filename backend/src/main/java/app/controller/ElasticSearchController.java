package app.controller;

import app.pojo.ApiResponse;
import app.pojo.ElasticSearchConfig;
import app.pojo.ElasticSearchConfigUpdateRequest;
import app.service.ElasticSearchConfigService;
import app.service.ElasticSearchService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/elasticsearch/")
public class ElasticSearchController {

    private final ElasticSearchConfigService configService;
    private final ElasticSearchService esService;

    public ElasticSearchController(ElasticSearchConfigService configService, ElasticSearchService esService) {
        this.configService = configService;
        this.esService = esService;
        System.out.println("ElasticSearchController initialized successfully");
    }

    @PostMapping("test/")
    public ApiResponse<String> testConnection() {
        try {
            String response = esService.testConnection();
            return ApiResponse.success(response, "Elasticsearch connection test successful");
        } catch (java.net.UnknownHostException e) {
            return ApiResponse.error(-1, "Unknown host: " + e.getMessage());
        } catch (java.net.ConnectException e) {
            return ApiResponse.error(-1, "Connection refused: " + e.getMessage());
        } catch (java.net.SocketTimeoutException e) {
            return ApiResponse.error(-1, "Connection timeout: " + e.getMessage());
        } catch (Exception e) {
            System.err.println("Elasticsearch connection test failed: " + e.getMessage());
            e.printStackTrace();
            return ApiResponse.error(-1, "Connection test failed: " + e.getMessage());
        }
    }

    @GetMapping("config/app/")
    public ApiResponse<ElasticSearchConfig> getAppConfig() {
        try {
            ElasticSearchConfig config = configService.getAppConfig();
            return ApiResponse.success(config, "Elasticsearch application.properties configuration retrieved");
        } catch (Exception e) {
            System.err.println("ElasticSearchController.getAppConfig() error: " + e.getMessage());
            e.printStackTrace();
            return ApiResponse.error(500, "Failed to get app config: " + e.getMessage());
        }
    }

    @GetMapping("config/")
    public ApiResponse<ElasticSearchConfig> getConfig() {
        try {
            ElasticSearchConfig config = configService.getConfigCurrent();
            System.out.println("ElasticSearchController.getConfig() returning: " + config);
            return ApiResponse.success(config, "Current Elasticsearch configuration retrieved");
        } catch (Exception e) {
            System.err.println("ElasticSearchController.getConfig() error: " + e.getMessage());
            e.printStackTrace();
            return ApiResponse.error(500, "Failed to get config: " + e.getMessage());
        }
    }

    @PostMapping("config/set/")
    public ApiResponse<ElasticSearchConfig> setConfig(@RequestBody ElasticSearchConfigUpdateRequest request) {
        try {
            configService.updateConfig(request.getPath(), request.getValue());
            return ApiResponse.success(configService.getConfigCurrent(), "Elasticsearch configuration updated successfully");
        } catch (Exception e) {
            System.err.println("Failed to update config: " + e.getMessage());
            return ApiResponse.error(400, "Failed to update config: " + e.getMessage());
        }
    }

    /**
     * Create a new index
     */
    @PostMapping("indices/create")
    public ApiResponse<String> createIndex(@RequestBody java.util.Map<String, Object> request) {
        try {
            String indexName = (String) request.get("indexName");
            if (indexName == null || indexName.isEmpty()) {
                return ApiResponse.error(-1, "Index name is required");
            }
            
            @SuppressWarnings("unchecked")
            java.util.Map<String, Object> body = (java.util.Map<String, Object>) request.get("body");
            
            esService.createIndex(indexName, body);
            return ApiResponse.success("Index created", "Successfully created index: " + indexName);
        } catch (Exception e) {
            System.err.println("Failed to create index: " + e.getMessage());
            e.printStackTrace();
            return ApiResponse.error(-1, "Failed to create index: " + e.getMessage());
        }
    }

    /**
     * List all indices in the Elasticsearch cluster
     */
    @GetMapping("indices/list")
    public ApiResponse<java.util.List<String>> listIndices() {
        try {
            java.util.List<String> indexNames = esService.listIndices();
            return ApiResponse.success(indexNames, "Retrieved " + indexNames.size() + " indices");
        } catch (Exception e) {
            System.err.println("Failed to list indices: " + e.getMessage());
            e.printStackTrace();
            return ApiResponse.error(-1, "Failed to list indices: " + e.getMessage());
        }
    }

    /**
     * Get information about a specific index
     */
    @GetMapping("indices/{indexName}")
    public ApiResponse<java.util.Map<String, Object>> getIndexInfo(@PathVariable String indexName) {
        try {
            java.util.Map<String, Object> indexInfo = esService.getIndexInfo(indexName);
            return ApiResponse.success(indexInfo, "Retrieved info for index: " + indexName);
        } catch (Exception e) {
            System.err.println("Failed to get index info: " + e.getMessage());
            e.printStackTrace();
            return ApiResponse.error(-1, "Failed to get index info: " + e.getMessage());
        }
    }

    /**
     * Get index settings including metadata
     */
    @GetMapping("indices/{indexName}/settings/")
    public ApiResponse<java.util.Map<String, Object>> getIndexSettings(@PathVariable String indexName) {
        try {
            java.util.Map<String, Object> settings = esService.getIndexSettings(indexName);
            return ApiResponse.success(settings, "Retrieved settings for index: " + indexName);
        } catch (Exception e) {
            System.err.println("Failed to get index settings: " + e.getMessage());
            e.printStackTrace();
            return ApiResponse.error(-1, "Failed to get index settings: " + e.getMessage());
        }
    }

    /**
     * Update index metadata (add/update key-value pair under index.meta)
     */
    @PostMapping("indices/{indexName}/meta/")
    public ApiResponse<String> updateIndexMeta(
        @PathVariable String indexName,
        @RequestBody java.util.Map<String, String> request
    ) {
        try {
            String key = request.get("key");
            String value = request.get("value");
            
            if (key == null || key.isEmpty()) {
                return ApiResponse.error(-1, "Key is required");
            }
            if (value == null) {
                return ApiResponse.error(-1, "Value is required");
            }
            
            esService.updateIndexMeta(indexName, key, value);
            return ApiResponse.success("Metadata updated", 
                "Updated index.meta." + key + " = " + value + " for index: " + indexName);
        } catch (Exception e) {
            System.err.println("Failed to update index metadata: " + e.getMessage());
            e.printStackTrace();
            return ApiResponse.error(-1, "Failed to update index metadata: " + e.getMessage());
        }
    }

    /**
     * Delete an index
     */
    @DeleteMapping("indices/{indexName}/delete")
    public ApiResponse<String> deleteIndex(@PathVariable String indexName) {
        try {
            esService.deleteIndex(indexName);
            return ApiResponse.success("Index deleted", "Successfully deleted index: " + indexName);
        } catch (Exception e) {
            System.err.println("Failed to delete index: " + e.getMessage());
            e.printStackTrace();
            return ApiResponse.error(-1, "Failed to delete index: " + e.getMessage());
        }
    }

    /**
     * Rename an index (using reindex + delete)
     */
    @PostMapping("indices/{indexName}/rename/")
    public ApiResponse<String> renameIndex(
        @PathVariable String indexName,
        @RequestBody java.util.Map<String, String> request
    ) {
        try {
            String newName = request.get("newName");
            if (newName == null || newName.isEmpty()) {
                return ApiResponse.error(-1, "New name is required");
            }
            
            if (indexName.equals(newName)) {
                return ApiResponse.error(-1, "New name must be different from current name");
            }
            
            esService.renameIndex(indexName, newName);
            return ApiResponse.success("Index renamed", "Successfully renamed index from " + indexName + " to " + newName);
        } catch (Exception e) {
            System.err.println("Failed to rename index: " + e.getMessage());
            e.printStackTrace();
            return ApiResponse.error(-1, "Failed to rename index: " + e.getMessage());
        }
    }

    /**
     * Get documents from an index with pagination
     */
    @GetMapping("indices/{indexName}/docs/")
    public ApiResponse<java.util.Map<String, Object>> getEsDocs(
        @PathVariable String indexName,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int pageSize
    ) {
        try {
            java.util.Map<String, Object> result = esService.getEsDocs(indexName, page, pageSize);
            @SuppressWarnings("unchecked")
            java.util.List<java.util.Map<String, Object>> documents = 
                (java.util.List<java.util.Map<String, Object>>) result.get("documents");
            return ApiResponse.success(result, "Retrieved " + documents.size() + " documents");
        } catch (Exception e) {
            System.err.println("Failed to get documents: " + e.getMessage());
            e.printStackTrace();
            return ApiResponse.error(-1, "Failed to get documents: " + e.getMessage());
        }
    }

    /**
     * Create a document in an index
     */
    @PostMapping("indices/{indexName}/docs/create")
    public ApiResponse<java.util.Map<String, Object>> createEsDoc(
        @PathVariable String indexName,
        @RequestBody java.util.Map<String, Object> request
    ) {
        try {
            @SuppressWarnings("unchecked")
            java.util.Map<String, Object> body = (java.util.Map<String, Object>) request.get("body");
            if (body == null) {
                body = new java.util.HashMap<>();
            }
            
            String docId = esService.createEsDoc(indexName, body);
            java.util.Map<String, Object> doc = esService.getEsDoc(indexName, docId);
            return ApiResponse.success(doc, "Document created successfully");
        } catch (Exception e) {
            System.err.println("Failed to create document: " + e.getMessage());
            e.printStackTrace();
            return ApiResponse.error(-1, "Failed to create document: " + e.getMessage());
        }
    }

    /**
     * Update a document in an index (full rewrite)
     */
    @PutMapping("indices/{indexName}/docs/{docId}/update")
    public ApiResponse<java.util.Map<String, Object>> updateEsDoc(
        @PathVariable String indexName,
        @PathVariable String docId,
        @RequestBody java.util.Map<String, Object> request
    ) {
        try {
            @SuppressWarnings("unchecked")
            java.util.Map<String, Object> body = (java.util.Map<String, Object>) request.get("body");
            if (body == null) {
                return ApiResponse.error(-1, "Document body is required");
            }
            
            esService.updateEsDoc(indexName, docId, body);
            java.util.Map<String, Object> doc = esService.getEsDoc(indexName, docId);
            return ApiResponse.success(doc, "Document updated successfully");
        } catch (Exception e) {
            System.err.println("Failed to update document: " + e.getMessage());
            e.printStackTrace();
            return ApiResponse.error(-1, "Failed to update document: " + e.getMessage());
        }
    }

    /**
     * Delete a document from an index
     */
    @DeleteMapping("indices/{indexName}/docs/{docId}/delete")
    public ApiResponse<String> deleteDocumentFromController(
        @PathVariable String indexName,
        @PathVariable String docId
    ) {
        try {
            esService.deleteDocument(indexName, docId);
            return ApiResponse.success("Document deleted", "Successfully deleted document: " + docId);
        } catch (Exception e) {
            System.err.println("Failed to delete document: " + e.getMessage());
            e.printStackTrace();
            return ApiResponse.error(-1, "Failed to delete document: " + e.getMessage());
        }
    }

    /**
     * Search documents in a character-level index
     */
    @PostMapping("indices/{indexName}/search/")
    public ApiResponse<java.util.Map<String, Object>> searchDocuments(
        @PathVariable String indexName,
        @RequestBody java.util.Map<String, Object> searchParams
    ) {
        try {
            String query = (String) searchParams.get("query");
            Boolean searchInPaths = (Boolean) searchParams.get("search_in_paths");
            Boolean searchInValues = (Boolean) searchParams.get("search_in_values");
            Integer page = (Integer) searchParams.get("page");
            Integer pageSize = (Integer) searchParams.get("page_size");
            
            if (query == null || query.trim().isEmpty()) {
                return ApiResponse.error(-1, "Query parameter is required");
            }
            
            if (searchInPaths == null) searchInPaths = false;
            if (searchInValues == null) searchInValues = true;
            if (page == null || page < 1) page = 1;
            if (pageSize == null || pageSize < 1) pageSize = 20;
            if (pageSize > 100) pageSize = 100;

            java.util.Map<String, Object> responseData = esService.searchDocsWithPagination(
                indexName, query, searchInPaths, searchInValues, page, pageSize);
            return ApiResponse.success(responseData, "Search completed successfully");
        } catch (Exception e) {
            e.printStackTrace();
            return ApiResponse.error(-1, "Failed to search documents: " + e.getMessage());
        }
    }

    /**
     * Extract match positions from ES highlighted text.
     * Translated from Python implementation in _3b_es_highlight.py
     * 
     * @param highlightedText Text with [[HIGHLIGHT_START]] and [[HIGHLIGHT_END]] tags
     * @return List of [start_index, end_index] arrays
     */
    private java.util.List<int[]> extractPositionsFromHighlight(String highlightedText) {
        java.util.List<int[]> positions = new java.util.ArrayList<>();
        
        String startTag = "[[HIGHLIGHT_START]]";
        String endTag = "[[HIGHLIGHT_END]]";
        int currentPos = 0;
        
        while (true) {
            // Find next highlight start
            int startIdx = highlightedText.indexOf(startTag, currentPos);
            if (startIdx == -1) {
                break;
            }
            
            // Calculate position in original text (accounting for previous tags)
            String beforeStart = highlightedText.substring(0, startIdx);
            int startTagCount = countOccurrences(beforeStart, startTag);
            int endTagCount = countOccurrences(beforeStart, endTag);
            int originalPos = startIdx - (startTagCount * startTag.length()) - (endTagCount * endTag.length());
            
            // Find corresponding end tag
            int endIdx = highlightedText.indexOf(endTag, startIdx);
            if (endIdx == -1) {
                break;
            }
            
            // Extract the highlighted portion
            int matchStart = originalPos;
            String matchText = highlightedText.substring(startIdx + startTag.length(), endIdx);
            int matchLength = matchText.length();
            int matchEnd = matchStart + matchLength;
            
            positions.add(new int[]{matchStart, matchEnd});
            
            currentPos = endIdx + endTag.length();
        }
        
        return positions;
    }

    /**
     * Count occurrences of a substring in a string
     */
    private int countOccurrences(String str, String substr) {
        int count = 0;
        int idx = 0;
        while ((idx = str.indexOf(substr, idx)) != -1) {
            count++;
            idx += substr.length();
        }
        return count;
    }
}
