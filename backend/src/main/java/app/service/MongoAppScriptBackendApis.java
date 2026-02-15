package app.service;

import java.util.HashMap;
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
    
    /**
     * Constructor - appId is set from the request URL, not from the script
     */
    public MongoAppScriptBackendApis(String appId, MongoAppService mongoAppService) {
        this.appId = appId;
        this.mongoAppService = mongoAppService;
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
        // TODO: Implement searchDocs in MongoAppService
        // For now, return an error or delegate to listDocs
        Map<String, Object> error = new HashMap<>();
        error.put("error", "searchDocs not yet implemented");
        return ApiResponse.error("searchDocs not yet implemented");
    }
    
    // ==================== Index Operations ====================
    
    /**
     * List all Elasticsearch index names for this app
     */
    public ApiResponse<List<String>> listAllEsIndices() {
        // Get app info which contains esIndices
        ApiResponse<Map<String, Object>> response = mongoAppService.getAppInfo(appId);
        
        if (response.getCode() == 0) {
            @SuppressWarnings("unchecked")
            List<String> indices = (List<String>) response.getData().get("esIndices");
            return ApiResponse.success(indices != null ? indices : List.of());
        } else {
            return ApiResponse.error(response.getMessage());
        }
    }
    
    /**
     * Check if index exists
     */
    public ApiResponse<Map<String, Object>> indexExists(String indexName) {
        // TODO: Implement indexExists in MongoAppService or ElasticSearchService
        Map<String, Object> result = new HashMap<>();
        result.put("exists", false);
        result.put("message", "indexExists not yet implemented");
        return ApiResponse.success(result);
    }
    
    // ==================== App Metadata ====================
    
    /**
     * Get current app's metadata
     */
    public ApiResponse<Map<String, Object>> getAppInfo() {
        return mongoAppService.getAppInfo(appId);
    }
    
    /**
     * Get the current appId (read-only)
     * Scripts can read their own appId but cannot change it
     */
    public String getAppId() {
        return appId;
    }
}
