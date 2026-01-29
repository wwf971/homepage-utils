package app.controller;

import app.pojo.ApiResponse;
import app.service.MongoAppService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * REST API controller for MongoDB app subsystem
 * Allows apps to register, create collections, and perform CRUD operations
 */
@RestController
@RequestMapping("/mongo-app")
@CrossOrigin(origins = "*")
public class MongoAppController {

    @Autowired
    private MongoAppService mongoAppService;

    /**
     * Initialize an app
     * POST /mongo-app/create
     * Body: { "appName": "myapp" }
     * 
     * @return { "code": 0, "message": "...", "data": { "appId": "...", "esIndex": "...", ... } }
     */
    @PostMapping("/create")
    public ApiResponse<Map<String, Object>> initApp(@RequestBody Map<String, Object> request) {
        String appName = (String) request.get("appName");
        return mongoAppService.initApp(appName);
    }

    /**
     * Get app ID by name (exact match)
     * GET /mongo-app/get-id/{appName}
     * 
     * @return { "code": 0, "data": [{ "appId": "...", "appName": "...", "createdAt": ... }, ...] }
     */
    @GetMapping("/get-id/{appName}")
    public ApiResponse<Map<String, Object>> getAppIdByName(@PathVariable String appName) {
        return mongoAppService.getAppIdByName(appName);
    }

    /**
     * Get app info
     * GET /mongo-app/{appId}/config
     * 
     * @return { "code": 0, "data": { "appId": "...", "appName": "...", "collections": [...] } }
     */
    @GetMapping("/{appId}/config")
    public ApiResponse<Map<String, Object>> getAppInfo(@PathVariable String appId) {
        return mongoAppService.getAppInfo(appId);
    }

    /**
     * Check if ES index exists
     * GET /mongo-app/{appId}/index/exists
     * 
     * @return { "code": 0, "data": { "exists": true/false, "indexName": "..." } }
     */
    @GetMapping("/{appId}/index/exists")
    public ApiResponse<Map<String, Object>> indexExists(@PathVariable String appId) {
        return mongoAppService.checkIndexExists(appId);
    }

    /**
     * Create ES index for app
     * POST /mongo-app/{appId}/index/create
     * 
     * @return { "code": 0, "message": "...", "data": { "indexName": "..." } }
     */
    @PostMapping("/{appId}/index/create")
    public ApiResponse<Map<String, Object>> createIndex(@PathVariable String appId) {
        return mongoAppService.createIndexForApp(appId);
    }

    /**
     * Create a collection for an app
     * POST /mongo-app/{appId}/coll/create
     * Body: { "collectionName": "users" }
     * 
     * @return { "code": 0, "message": "...", "data": { "collectionName": "...", "fullCollectionName": "..." } }
     */
    @PostMapping("/{appId}/coll/create")
    public ApiResponse<Map<String, Object>> createCollection(@PathVariable String appId, 
                                                 @RequestBody Map<String, Object> request) {
        String collectionName = (String) request.get("collectionName");
        return mongoAppService.createCollection(appId, collectionName);
    }

    /**
     * List all collections for an app
     * GET /mongo-app/{appId}/coll/list
     * 
     * @return { "code": 0, "data": { "appId": "...", "collections": [...] } }
     */
    @GetMapping("/{appId}/coll/list")
    public ApiResponse<Map<String, Object>> listCollections(@PathVariable String appId) {
        return mongoAppService.listCollections(appId);
    }

    /**
     * Check if a collection exists
     * GET /mongo-app/{appId}/coll/exists/{collectionName}
     * 
     * @return { "code": 0, "data": { "exists": true/false } }
     */
    @GetMapping("/{appId}/coll/exists/{collectionName}")
    public ApiResponse<Map<String, Object>> collectionExists(@PathVariable String appId,
                                                @PathVariable String collectionName) {
        return mongoAppService.collectionExists(appId, collectionName);
    }

    /**
     * Delete an app and all its data
     * DELETE /mongo-app/{appId}/delete
     * 
     * @return { "code": 0, "message": "...", "data": { "deletedCollections": N } }
     */
    @DeleteMapping("/{appId}/delete")
    public ApiResponse<Map<String, Object>> deleteApp(@PathVariable String appId) {
        return mongoAppService.deleteApp(appId);
    }

    /**
     * Create a document
     * POST /mongo-app/{appId}/coll/{collectionName}/doc/create
     * Body: { "docId": "doc1", "content": { "field1": "value1", ... } }
     * 
     * @return { "code": 0, "message": "...", "data": { "docId": "...", "mongoId": "..." } }
     */
    @PostMapping("/{appId}/coll/{collectionName}/doc/create")
    public ApiResponse<Map<String, Object>> createDoc(@PathVariable String appId,
                                         @PathVariable String collectionName,
                                         @RequestBody Map<String, Object> request) {
        String docId = (String) request.get("docId");
        @SuppressWarnings("unchecked")
        Map<String, Object> content = (Map<String, Object>) request.get("content");
        
        if (content == null) {
            content = new java.util.HashMap<>();
        }
        
        return mongoAppService.createDoc(appId, collectionName, docId, content);
    }

    /**
     * Update a document
     * PUT /mongo-app/{appId}/coll/{collectionName}/doc/{docId}/update
     * Body: { "updates": { "field1": "newValue", ... } }
     * 
     * @return { "code": 0, "message": "...", "data": { "docId": "...", "updateVersion": N } }
     */
    @PutMapping("/{appId}/coll/{collectionName}/doc/{docId}/update")
    public ApiResponse<Map<String, Object>> updateDoc(@PathVariable String appId,
                                         @PathVariable String collectionName,
                                         @PathVariable String docId,
                                         @RequestBody Map<String, Object> request) {
        @SuppressWarnings("unchecked")
        Map<String, Object> updates = (Map<String, Object>) request.get("updates");
        
        if (updates == null) {
            updates = new java.util.HashMap<>();
        }
        
        return mongoAppService.updateDoc(appId, collectionName, docId, updates);
    }

    /**
     * Get a document
     * GET /mongo-app/{appId}/coll/{collectionName}/doc/{docId}/get
     * 
     * @return { "code": 0, "data": { document fields } }
     */
    @GetMapping("/{appId}/coll/{collectionName}/doc/{docId}/get")
    public ApiResponse<Map<String, Object>> getDoc(@PathVariable String appId,
                                      @PathVariable String collectionName,
                                      @PathVariable String docId) {
        return mongoAppService.getDoc(appId, collectionName, docId);
    }

    /**
     * Delete a document
     * DELETE /mongo-app/{appId}/coll/{collectionName}/doc/{docId}/delete
     * 
     * @return { "code": 0, "message": "...", "data": { "docId": "..." } }
     */
    @DeleteMapping("/{appId}/coll/{collectionName}/doc/{docId}/delete")
    public ApiResponse<Map<String, Object>> deleteDoc(@PathVariable String appId,
                                         @PathVariable String collectionName,
                                         @PathVariable String docId) {
        return mongoAppService.deleteDoc(appId, collectionName, docId);
    }

    /**
     * List all documents in a collection
     * GET /mongo-app/{appId}/coll/{collectionName}/doc/list
     * Optional query params: ?limit=100&skip=0
     * 
     * @return { "code": 0, "data": { "documents": [...], "total": N } }
     */
    @GetMapping("/{appId}/coll/{collectionName}/doc/list")
    public ApiResponse<Map<String, Object>> listDocs(@PathVariable String appId,
                                        @PathVariable String collectionName,
                                        @RequestParam(required = false) Integer limit,
                                        @RequestParam(required = false) Integer skip) {
        return mongoAppService.listDocs(appId, collectionName, limit, skip);
    }
}
