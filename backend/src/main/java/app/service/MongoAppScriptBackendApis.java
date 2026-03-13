package app.service;

import java.util.List;
import java.util.Map;

import app.pojo.ApiResponse;

/**
 * Backend API wrapper for Groovy scripts in MongoApp.
 * Provides scoped access to only the current app's data.
 * The appId is set by the backend (from URL path) and cannot be changed by scripts.
 */
public class MongoAppScriptBackendApis {
    
    private final String appId;
    private final MongoAppService mongoAppService;
    private final MongoAppFileAccess mongoAppFileAccess;
    
    /**
     * Constructor - appId is set from the request URL, not from the script
     */
    public MongoAppScriptBackendApis(String appId, MongoAppService mongoAppService) {
        this.appId = appId;
        this.mongoAppService = mongoAppService;
        this.mongoAppFileAccess = null;
    }

    public MongoAppScriptBackendApis(String appId, MongoAppService mongoAppService,
                                     MongoAppFileAccess mongoAppFileAccess) {
        this.appId = appId;
        this.mongoAppService = mongoAppService;
        this.mongoAppFileAccess = mongoAppFileAccess;
    }
    
    // ==================== Collection Operations ====================
    
    /**
     * List all collection names for this app
     */
    public ApiResponse<List<String>> listAllCollections() {
        ApiResponse<Map<String, Object>> response = mongoAppService.listCollections(appId);
        
        if (response.getCode() == 0) {
            @SuppressWarnings("unchecked")
            List<String> collections = (List<String>) response.getData().get("collections");
            return ApiResponse.success(collections);
        } else {
            return ApiResponse.error(response.getMessage());
        }
    }
    
    /**
     * Create a new collection
     */
    public ApiResponse<Map<String, Object>> createCollection(String collName) {
        return mongoAppService.createCollection(appId, collName);
    }
    
    /**
     * Check if collection exists
     */
    public ApiResponse<Map<String, Object>> collectionExists(String collName) {
        return mongoAppService.collectionExists(appId, collName);
    }
    
    // ==================== Doc Operations ====================
    
    /**
     * Create a new document with specified ID
     */
    public ApiResponse<Map<String, Object>> createDoc(String collName, String docId, Map<String, Object> content) {
        return mongoAppService.createDoc(appId, collName, docId, content, null);
    }
    
    /**
     * Create a new document with specified ID and control ES indexing
     * @param shouldUpdateIndex Whether to update ES index (default: true)
     */
    public ApiResponse<Map<String, Object>> createDoc(String collName, String docId, Map<String, Object> content, Boolean shouldUpdateIndex) {
        return mongoAppService.createDoc(appId, collName, docId, content, shouldUpdateIndex);
    }
    
    /**
     * Get document by ID
     */
    public ApiResponse<Map<String, Object>> getDoc(String collName, String docId) {
        return mongoAppService.getDoc(appId, collName, docId);
    }
    
    /**
     * Update document fields
     */
    public ApiResponse<Map<String, Object>> updateDoc(String collName, String docId, Map<String, Object> updates) {
        return mongoAppService.updateDoc(appId, collName, docId, updates, null);
    }
    
    /**
     * Update document fields with control over ES indexing
     * @param shouldUpdateIndex Whether to update ES index (default: true)
     */
    public ApiResponse<Map<String, Object>> updateDoc(String collName, String docId, Map<String, Object> updates, Boolean shouldUpdateIndex) {
        return mongoAppService.updateDoc(appId, collName, docId, updates, shouldUpdateIndex);
    }

    /**
     * Index with a custom source object into a specific app-owned ES index.
     * Backend will flatten and index this object instead of flattening Mongo doc directly.
     */
    public ApiResponse<Map<String, Object>> indexDocWithCustomSource(String collName, String docId,
                                                                      Map<String, Object> docForIndex,
                                                                      String indexName) {
        return mongoAppService.indexDocWithCustomSource(appId, collName, docId, docForIndex, indexName);
    }

    /**
     * Execute another MongoApp Groovy API endpoint within the same app.
     * This allows scripts to reuse shared logic in helper endpoints.
     */
    public Map<String, Object> executeApiScript(String endpoint, Map<String, Object> requestParams) {
        return mongoAppService.executeApiScript(appId, endpoint, requestParams, null);
    }

    /**
     * Execute another MongoApp Groovy API endpoint with explicit headers.
     */
    public Map<String, Object> executeApiScript(String endpoint, Map<String, Object> requestParams,
                                                Map<String, String> requestHeaders) {
        return mongoAppService.executeApiScript(appId, endpoint, requestParams, requestHeaders);
    }
    
    /**
     * Delete a document
     */
    public ApiResponse<Map<String, Object>> deleteDoc(String collName, String docId) {
        return mongoAppService.deleteDoc(appId, collName, docId);
    }
    
    /**
     * List documents with pagination
     */
    public ApiResponse<Map<String, Object>> listDocs(String collName, Integer limit, Integer skip) {
        return mongoAppService.listDocs(appId, collName, limit, skip);
    }
    
    /**
     * Search documents using MongoDB query
     */
    public ApiResponse<Map<String, Object>> searchDocs(String collName, Map<String, Object> query) {
        return ApiResponse.error("searchDocs not yet implemented");
    }
    
    // ==================== Index Operations ====================
    
    /**
     * List all Elasticsearch index names for this app
     */
    public ApiResponse<List<String>> listAllEsIndices() {
        ApiResponse<Map<String, Object>> response = getAppInfo();
        if (response.getCode() != 0 || response.getData() == null) {
            return ApiResponse.error(response.getMessage());
        }
        @SuppressWarnings("unchecked")
        List<String> indices = (List<String>) response.getData().get("esIndices");
        return ApiResponse.success(indices != null ? indices : List.of());
    }
    
    /**
     * Check if index exists
     */
    public ApiResponse<Map<String, Object>> esIndexExists(String indexName) {
        return mongoAppService.esIndexExists(appId, indexName);
    }

    /**
     * Create a new app-owned ES index.
     */
    public ApiResponse<Map<String, Object>> createEsIndex(String indexName) {
        return mongoAppService.createEsIndex(appId, indexName);
    }

    /**
     * Delete an app-owned ES index.
     */
    public ApiResponse<Map<String, Object>> deleteEsIndex(String indexName) {
        return mongoAppService.deleteEsIndex(appId, indexName);
    }

    /**
     * Rename an app-owned ES index.
     */
    public ApiResponse<Map<String, Object>> renameEsIndex(String oldIndexName, String newIndexName) {
        return mongoAppService.renameEsIndex(appId, oldIndexName, newIndexName);
    }

    /**
     * Get details about an app-owned ES index.
     */
    public ApiResponse<Map<String, Object>> getEsIndexInfo(String indexName) {
        return mongoAppService.getEsIndexInfo(appId, indexName);
    }

    /**
     * List docs from an app-owned ES index.
     */
    public ApiResponse<Map<String, Object>> listEsDocs(String indexName, Integer page, Integer pageSize) {
        return mongoAppService.listEsDocs(appId, indexName, page, pageSize);
    }

    /**
     * Get one doc from an app-owned ES index.
     */
    public ApiResponse<Map<String, Object>> getEsDoc(String indexName, String docId) {
        return mongoAppService.getEsDoc(appId, indexName, docId);
    }
    
    // ==================== App Metadata ====================
    
    /**
     * Get current app's metadata
     */
    public ApiResponse<Map<String, Object>> getAppInfo() {
        ApiResponse<Map<String, Object>> response = mongoAppService.getAppInfo(appId);
        if (response.getCode() != 0 || response.getData() == null) {
            return response;
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> raw = response.getData();
        Map<String, Object> data = new java.util.HashMap<>(raw);

        String prefix = appId + "_";
        Object esIndexObj = raw.get("esIndex");
        if (esIndexObj instanceof String) {
            String full = (String) esIndexObj;
            data.put("esIndex", full.startsWith(prefix) ? full.substring(prefix.length()) : full);
        }

        Object indicesObj = raw.get("esIndices");
        if (indicesObj instanceof List) {
            @SuppressWarnings("unchecked")
            List<String> fullList = (List<String>) indicesObj;
            List<String> shortList = new java.util.ArrayList<>();
            for (String full : fullList) {
                if (full == null) {
                    continue;
                }
                shortList.add(full.startsWith(prefix) ? full.substring(prefix.length()) : full);
            }
            data.put("esIndices", shortList);
        }

        return ApiResponse.success(data);
    }
    
    /**
     * Get the current appId (read-only)
     * Scripts can read their own appId but cannot change it
     */
    public String getAppId() {
        return appId;
    }

    // ==================== File Access Point Operations ====================

    /**
     * List all file accesses (registered FAP folders) for this app.
     */
    public ApiResponse<List<Map<String, Object>>> listFileAccesses() {
        if (mongoAppFileAccess == null) return ApiResponse.error("File access point service not available");
        return mongoAppFileAccess.listFileAccesses(appId);
    }

    /**
     * List files/directories at the file access root/subPath.
     * Pass "" or "/" for the file access root.
     */
    public ApiResponse<Map<String, Object>> listFiles(String fileAccessId, String subPath) {
        if (mongoAppFileAccess == null) return ApiResponse.error("File access point service not available");
        return mongoAppFileAccess.listFiles(appId, fileAccessId, subPath);
    }

    /**
     * Check if a file or directory exists.
     */
    public ApiResponse<Map<String, Object>> fileExists(String fileAccessId, String filePath) {
        if (mongoAppFileAccess == null) return ApiResponse.error("File access point service not available");
        return mongoAppFileAccess.fileExists(appId, fileAccessId, filePath);
    }

    /**
     * Read file content as string.
     */
    public ApiResponse<Map<String, Object>> readFile(String fileAccessId, String filePath) {
        if (mongoAppFileAccess == null) return ApiResponse.error("File access point service not available");
        return mongoAppFileAccess.readFile(appId, fileAccessId, filePath);
    }

    /**
     * Write (create or overwrite) a file.
     */
    public ApiResponse<Map<String, Object>> writeFile(String fileAccessId, String filePath, String content) {
        if (mongoAppFileAccess == null) return ApiResponse.error("File access point service not available");
        return mongoAppFileAccess.writeFile(appId, fileAccessId, filePath, content);
    }

    /**
     * Delete a file.
     */
    public ApiResponse<Map<String, Object>> deleteFile(String fileAccessId, String filePath) {
        if (mongoAppFileAccess == null) return ApiResponse.error("File access point service not available");
        return mongoAppFileAccess.deleteFile(appId, fileAccessId, filePath);
    }
}
