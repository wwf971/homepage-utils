package app.service;

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
import com.mongodb.client.model.IndexOptions;
import com.mongodb.client.model.Indexes;

import app.pojo.ApiResponse;
import app.util.TimeUtils;

/**
 * Service for managing MongoDB collections for different apps
 * Each app gets:
 * - A unique app ID
 * - Collections named {appId}_{collectionName} in mongo-app database
 * - A shared Elasticsearch index named {appId}_index_default
 */
@Service
public class MongoAppService {

    @Autowired
    private MongoService mongoService;
    
    @Autowired
    private MongoIndexService mongoIndexService;
    
    @Autowired
    private ElasticSearchService esService;
    
    @Autowired
    private IdService idService;
    
    @Autowired
    @org.springframework.context.annotation.Lazy
    private GroovyApiService groovyApiService;
    
    private static final String APP_DB_NAME = "mongo-app";
    private static final String APP_METADATA_COLL_NAME = "__app__";
    
    /**
     * Get the app metadata collection, creating it if necessary
     */
    private MongoCollection<Document> getAppMetadataCollection() {
        MongoClient client = mongoService.getMongoClient();
        if (client == null) {
            throw new RuntimeException("MongoDB client not initialized");
        }
        
        MongoDatabase database = client.getDatabase(APP_DB_NAME);
        
        // Try to create collection, ignore error if it already exists
        try {
            database.createCollection(APP_METADATA_COLL_NAME);
            System.out.println("Created apps metadata collection");
        } catch (com.mongodb.MongoCommandException e) {
            if (e.getErrorCode() != 48) {
                throw e;
            }
        }
        
        MongoCollection<Document> collection = database.getCollection(APP_METADATA_COLL_NAME);
        
        // Create unique index on appId
        try {
            collection.createIndex(
                Indexes.ascending("appId"),
                new IndexOptions().unique(true)
            );
        } catch (Exception e) {
            // Index might already exist
        }
        
        return collection;
    }
    
    /**
     * Initialize an app - register app name and create ES index
     * 
     * @param appName The application name
     * @return Result with appId and ES index name
     */
    public ApiResponse<Map<String, Object>> initApp(String appName) {
        if (appName == null || appName.trim().isEmpty()) {
            return createErrorResult("App name cannot be empty");
        }
        
        MongoCollection<Document> metadataCollection = getAppMetadataCollection();
        
        // Check if app with this name already exists
        Document existing = metadataCollection.find(Filters.eq("appName", appName)).first();
        if (existing != null) {
            // Return existing app info
            // Migrate old apps to support multiple indices
            @SuppressWarnings("unchecked")
            List<String> esIndices = (List<String>) existing.get("esIndices");
            if (esIndices == null) {
                esIndices = new ArrayList<>();
                String esIndex = existing.getString("esIndex");
                if (esIndex != null) {
                    esIndices.add(esIndex);
                }
            }
            
            return ApiResponse.success(
                Map.of(
                    "appId", existing.getString("appId"),
                    "appName", existing.getString("appName"),
                    "esIndex", existing.getString("esIndex"),
                    "esIndices", esIndices,
                    "collections", existing.get("collections", new ArrayList<>())
                ),
                "App already exists"
            );
        }
        
        // Generate app ID using ID service
        String appId;
        try {
            app.pojo.IdIssueRequest idRequest = new app.pojo.IdIssueRequest();
            idRequest.setType("mongo-app");
            idRequest.setMetadata("appName: " + appName);
            
            ApiResponse<app.pojo.IdEntity> idResponse = idService.issueRandomId(idRequest);
            if (idResponse.getCode() != 0) {
                return createErrorResult("Failed to generate app ID: " + idResponse.getMessage());
            }
            // Convert ID to base36 for use as appId
            appId = app.util.IdFormatConverter.longToBase36(idResponse.getData().getValue());
        } catch (Exception e) {
            return createErrorResult("Failed to generate app ID: " + e.getMessage());
        }
        
        // Elasticsearch index names are case-insensitive and always stored in lowercase
        // Use lowercase to avoid matching issues
        String esIndexName = (appId + "_index_default").toLowerCase();
        
        // Use System.currentTimeMillis() for Unix timestamp in milliseconds (long/int64)
        long createdAt = System.currentTimeMillis();
        // Get timezone offset in hours (-12 to +12)
        int createdAtTimezone = TimeUtils.getCurrentTimezoneOffset() / 60;
        
        // Create app metadata document with multiple ES indices support
        List<String> esIndices = new ArrayList<>();
        esIndices.add(esIndexName);
        
        Document appDoc = new Document("appId", appId)
            .append("appName", appName)
            .append("esIndex", esIndexName)  // Keep for backward compatibility
            .append("esIndices", esIndices)   // New field for multiple indices
            .append("collections", new ArrayList<String>())
            .append("createdAt", createdAt)
            .append("createdAtTimezone", createdAtTimezone);
        
        try {
            metadataCollection.insertOne(appDoc);
        } catch (Exception e) {
            return createErrorResult("Failed to create app metadata: " + e.getMessage());
        }
        
        // Create mongo-index metadata for this app
        try {
            List<Map<String, String>> emptyCollections = new ArrayList<>();
            mongoIndexService.createIndex(appId, esIndexName, emptyCollections);
        } catch (Exception e) {
            // Rollback: delete app metadata
            metadataCollection.deleteOne(Filters.eq("appId", appId));
            return createErrorResult("Failed to create ES index metadata: " + e.getMessage());
        }
        
        // Create the actual Elasticsearch index with metadata
        try {
            Map<String, String> metadata = new HashMap<>();

            // add information about owner app in settings.index.meta
            metadata.put("owner", "mongoapp_" + appId);
            esService.createCharLevelIndex(esIndexName, false, metadata);
        } catch (Exception e) {
            // Rollback: delete app metadata and index metadata
            metadataCollection.deleteOne(Filters.eq("appId", appId));
            mongoIndexService.deleteIndex(appId);
            return createErrorResult("Failed to create Elasticsearch index: " + e.getMessage());
        }
        
        return ApiResponse.success(
            Map.of(
                "appId", appId,
                "appName", appName,
                "esIndex", esIndexName,
                "esIndices", esIndices,
                "collections", new ArrayList<>()
            ),
            "App with id: " + appId + " initialized successfully"
        );
    }
    
    // Note: ID generation now uses IdService instead of local random generation
    // This ensures all IDs are centrally managed and tracked in the ID table
    
    /**
     * Create a new collection for an app
     * 
     * @param appId The app ID
     * @param collectionName The collection name (will be prefixed with appId)
     * @return Result with full collection name
     */
    public ApiResponse<Map<String, Object>> createCollection(String appId, String collectionName) {
        if (collectionName == null || collectionName.trim().isEmpty()) {
            return createErrorResult("Collection name cannot be empty");
        }
        
        MongoCollection<Document> metadataCollection = getAppMetadataCollection();
        
        // Get app metadata
        Document appDoc = metadataCollection.find(Filters.eq("appId", appId)).first();
        if (appDoc == null) {
            return createErrorResult("App not found: " + appId);
        }
        
        String appCollNameFull = appId + "_" + collectionName;
        String esIndexName = appDoc.getString("esIndex");
        
        @SuppressWarnings("unchecked")
        List<String> collections = (List<String>) appDoc.get("collections");
        if (collections == null) {
            collections = new ArrayList<>();
        }
        
        // Check if collection already exists
        if (collections.contains(collectionName)) {
            return createErrorResult("Collection already exists: " + collectionName);
        }
        
        // Create the MongoDB collection
        MongoClient client = mongoService.getMongoClient();
        MongoDatabase database = client.getDatabase(APP_DB_NAME);
        try {
            database.createCollection(appCollNameFull);
        } catch (com.mongodb.MongoCommandException e) {
            if (e.getErrorCode() != 48) {
                return createErrorResult("Failed to create collection: " + e.getMessage());
            }
        }
        
        // Update app metadata
        collections.add(collectionName);
        metadataCollection.updateOne(
            Filters.eq("appId", appId),
            new Document("$set", new Document("collections", collections))
        );
        
        // Update mongo-index to include this collection
        List<Map<String, String>> indexCollections = new ArrayList<>();
        for (String collName : collections) {
            Map<String, String> collInfo = new HashMap<>();
            collInfo.put("database", APP_DB_NAME);
            collInfo.put("collection", appId + "_" + collName);
            indexCollections.add(collInfo);
        }
        
        try {
            mongoIndexService.updateIndexCollections(appId, esIndexName, indexCollections);
        } catch (Exception e) {
            return createErrorResult("Failed to update index metadata: " + e.getMessage());
        }
        
        return ApiResponse.success(
            Map.of(
                "collectionName", collectionName,
                "appCollNameFull", appCollNameFull
            ),
            "Collection created successfully"
        );
    }
    
    /**
     * List all collections for an app
     * 
     * @param appId The app ID
     * @return Result with list of collection names
     */
    public ApiResponse<Map<String, Object>> listCollections(String appId) {
        MongoCollection<Document> metadataCollection = getAppMetadataCollection();
        
        Document appDoc = metadataCollection.find(Filters.eq("appId", appId)).first();
        if (appDoc == null) {
            return createErrorResult("App not found: " + appId);
        }
        
        @SuppressWarnings("unchecked")
        List<String> collections = (List<String>) appDoc.get("collections");
        if (collections == null) {
            collections = new ArrayList<>();
        }
        
        return ApiResponse.success(
            Map.of(
                "appId", appId,
                "appName", appDoc.getString("appName"),
                "collections", collections
            )
        );
    }
    
    /**
     * Check if a collection exists for an app
     * 
     * @param appId The app ID
     * @param collectionName The collection name
     * @return Result with exists boolean
     */
    public ApiResponse<Map<String, Object>> collectionExists(String appId, String collectionName) {
        MongoCollection<Document> metadataCollection = getAppMetadataCollection();
        
        Document appDoc = metadataCollection.find(Filters.eq("appId", appId)).first();
        if (appDoc == null) {
            return createErrorResult("App not found: " + appId);
        }
        
        @SuppressWarnings("unchecked")
        List<String> collections = (List<String>) appDoc.get("collections");
        if (collections == null) {
            collections = new ArrayList<>();
        }
        
        boolean exists = collections.contains(collectionName);
        
        return ApiResponse.success(
            Map.of(
                "appId", appId,
                "collectionName", collectionName,
                "exists", exists
            )
        );
    }
    
    /**
     * Delete an app and all its data
     * 
     * @param appId The app ID
     * @return Result
     */
    public ApiResponse<Map<String, Object>> deleteApp(String appId) {
        MongoCollection<Document> metadataCollection = getAppMetadataCollection();
        
        Document appDoc = metadataCollection.find(Filters.eq("appId", appId)).first();
        if (appDoc == null) {
            return createErrorResult("App not found: " + appId);
        }
        
        @SuppressWarnings("unchecked")
        List<String> collections = (List<String>) appDoc.get("collections");
        if (collections == null) {
            collections = new ArrayList<>();
        }
        
        // Delete all collections
        MongoClient client = mongoService.getMongoClient();
        MongoDatabase database = client.getDatabase(APP_DB_NAME);
        
        for (String collName : collections) {
            String appCollNameFull = appId + "_" + collName;
            try {
                database.getCollection(appCollNameFull).drop();
            } catch (Exception e) {
                System.err.println("Failed to drop collection " + appCollNameFull + ": " + e.getMessage());
            }
        }
        
        // Delete mongo-index metadata
        try {
            mongoIndexService.deleteIndex(appId);
        } catch (Exception e) {
            System.err.println("Failed to delete index metadata: " + e.getMessage());
        }
        
        // Delete all Groovy API scripts for this app
        int deletedScripts = 0;
        try {
            app.pojo.ApiResponse<Map<String, Object>> scriptsResponse = listMongoAppGroovyApis(appId);
            if (scriptsResponse.getCode() == 0) {
                Map<String, Object> scripts = scriptsResponse.getData();
                for (String scriptId : scripts.keySet()) {
                    try {
                        groovyApiService.deleteScript(scriptId);
                        deletedScripts++;
                    } catch (Exception e) {
                        System.err.println("Failed to delete script " + scriptId + ": " + e.getMessage());
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("Failed to delete Groovy API scripts: " + e.getMessage());
        }
        
        // Delete app metadata
        metadataCollection.deleteOne(Filters.eq("appId", appId));
        
        return ApiResponse.success(
            Map.of(
                "appId", appId,
                "deletedCollections", collections.size(),
                "deletedScripts", deletedScripts
            ),
            "App deleted successfully"
        );
    }
    
    /**
     * Create a document in a collection
     * 
     * @param appId The app ID
     * @param collectionName The collection name (without appId prefix)
     * @param docId Document ID
     * @param content Document content
     * @return Result
     */
    public ApiResponse<Map<String, Object>> createDoc(String appId, String collectionName, String docId, Map<String, Object> content) {
        // Verify app and collection exist
        MongoCollection<Document> metadataCollection = getAppMetadataCollection();
        Document appDoc = metadataCollection.find(Filters.eq("appId", appId)).first();
        if (appDoc == null) {
            return createErrorResult("App not found: " + appId);
        }
        
        @SuppressWarnings("unchecked")
        List<String> collections = (List<String>) appDoc.get("collections");
        if (collections == null || !collections.contains(collectionName)) {
            return createErrorResult("Collection not found: " + collectionName);
        }
        
        String appCollNameFull = appId + "_" + collectionName;
        
        // Create document using MongoService
        MongoClient client = mongoService.getMongoClient();
        MongoDatabase database = client.getDatabase(APP_DB_NAME);
        MongoCollection<Document> collection = database.getCollection(appCollNameFull);
        
        // Generate docId if not provided
        if (docId == null || docId.trim().isEmpty()) {
            try {
                app.pojo.IdIssueRequest idRequest = new app.pojo.IdIssueRequest();
                idRequest.setType("mongo-doc");
                idRequest.setMetadata("app: " + appId + ", collection: " + collectionName);
                
                ApiResponse<app.pojo.IdEntity> idResponse = idService.issueRandomId(idRequest);
                if (idResponse.getCode() != 0) {
                    return createErrorResult("Failed to generate document ID: " + idResponse.getMessage());
                }
                // Convert ID to base36 for use as docId
                docId = app.util.IdFormatConverter.longToBase36(idResponse.getData().getValue());
                
                // Check for collision (very unlikely with 64-bit random IDs, but be safe)
                int attempts = 0;
                while (attempts < 10 && collection.find(Filters.eq("id", docId)).first() != null) {
                    idResponse = idService.issueRandomId(idRequest);
                    if (idResponse.getCode() != 0) {
                        return createErrorResult("Failed to generate unique document ID after " + attempts + " attempts");
                    }
                    docId = app.util.IdFormatConverter.longToBase36(idResponse.getData().getValue());
                    attempts++;
                }
                if (attempts >= 10) {
                    return createErrorResult("Failed to generate unique document ID after 10 attempts");
                }
            } catch (Exception e) {
                return createErrorResult("Failed to generate document ID: " + e.getMessage());
            }
        } else {
            // Check if document with this ID already exists
            Document existing = collection.find(Filters.eq("id", docId)).first();
            if (existing != null) {
                return createErrorResult("Document with id '" + docId + "' already exists");
            }
        }
        
        // Prepare document with custom id
        Document doc = new Document("id", docId);
        doc.putAll(content);
        
        // Note: createdAt metadata is now stored only in __IndexQueue__, not in the document itself
        
        try {
            collection.insertOne(doc);
            
            // Trigger indexing using MongoIndexService
            // The IndexQueue will track createAt/createAtTimeZone metadata
            Object mongoId = doc.get("_id");
            Map<String, Object> updateDict = new HashMap<>(content);
            updateDict.put("id", docId);
            
            mongoIndexService.updateDoc(appId, APP_DB_NAME, appCollNameFull, docId, updateDict, true);
            
            return ApiResponse.success(
                Map.of(
                    "docId", docId,
                    "mongoId", mongoId.toString()
                ),
                "Document created successfully"
            );
        } catch (Exception e) {
            return createErrorResult("Failed to create document: " + e.getMessage());
        }
    }
    
    /**
     * Update a document
     * 
     * @param appId The app ID
     * @param collectionName The collection name (without appId prefix)
     * @param docId Document ID
     * @param updates Field updates
     * @return Result
     */
    public ApiResponse<Map<String, Object>> updateDoc(String appId, String collectionName, String docId, Map<String, Object> updates) {
        MongoCollection<Document> metadataCollection = getAppMetadataCollection();
        Document appDoc = metadataCollection.find(Filters.eq("appId", appId)).first();
        if (appDoc == null) {
            return createErrorResult("App not found: " + appId);
        }
        
        @SuppressWarnings("unchecked")
        List<String> collections = (List<String>) appDoc.get("collections");
        if (collections == null || !collections.contains(collectionName)) {
            return createErrorResult("Collection not found: " + collectionName);
        }
        
        String appCollNameFull = appId + "_" + collectionName;
        
        // Use MongoIndexService for update (handles ES indexing)
        Map<String, Object> result = mongoIndexService.updateDoc(appId, APP_DB_NAME, appCollNameFull, docId, updates, true);
        // Convert old format to ApiResponse
        Integer code = (Integer) result.get("code");
        if (code != null && code == 0) {
            return ApiResponse.success((Map<String, Object>) result.get("data"), (String) result.get("message"));
        } else {
            return ApiResponse.error((String) result.get("message"));
        }
    }
    
    /**
     * Get a document
     * 
     * @param appId The app ID
     * @param collectionName The collection name (without appId prefix)
     * @param docId Document ID
     * @return Result with document data
     */
    public ApiResponse<Map<String, Object>> getDoc(String appId, String collectionName, String docId) {
        MongoCollection<Document> metadataCollection = getAppMetadataCollection();
        Document appDoc = metadataCollection.find(Filters.eq("appId", appId)).first();
        if (appDoc == null) {
            return createErrorResult("App not found: " + appId);
        }
        
        @SuppressWarnings("unchecked")
        List<String> collections = (List<String>) appDoc.get("collections");
        if (collections == null || !collections.contains(collectionName)) {
            return createErrorResult("Collection not found: " + collectionName);
        }
        
        String appCollNameFull = appId + "_" + collectionName;
        
        // Use MongoIndexService for get
        Map<String, Object> result = mongoIndexService.getDocRaw(APP_DB_NAME, appCollNameFull, docId);
        // Convert old format to ApiResponse
        Integer code = (Integer) result.get("code");
        if (code != null && code == 0) {
            return ApiResponse.success((Map<String, Object>) result.get("data"), (String) result.get("message"));
        } else {
            return ApiResponse.error((String) result.get("message"));
        }
    }
    
    /**
     * Delete a document
     * 
     * @param appId The app ID
     * @param collectionName The collection name (without appId prefix)
     * @param docId Document ID
     * @return Result
     */
    public ApiResponse<Map<String, Object>> deleteDoc(String appId, String collectionName, String docId) {
        MongoCollection<Document> metadataCollection = getAppMetadataCollection();
        Document appDoc = metadataCollection.find(Filters.eq("appId", appId)).first();
        if (appDoc == null) {
            return createErrorResult("App not found: " + appId);
        }
        
        @SuppressWarnings("unchecked")
        List<String> collections = (List<String>) appDoc.get("collections");
        if (collections == null || !collections.contains(collectionName)) {
            return createErrorResult("Collection not found: " + collectionName);
        }
        
        String appCollNameFull = appId + "_" + collectionName;
        
        // Use MongoIndexService for delete (handles ES deletion)
        Map<String, Object> result = mongoIndexService.deleteDoc(appId, APP_DB_NAME, appCollNameFull, docId);
        // Convert old format to ApiResponse
        Integer code = (Integer) result.get("code");
        if (code != null && code == 0) {
            return ApiResponse.success((Map<String, Object>) result.get("data"), (String) result.get("message"));
        } else {
            return ApiResponse.error((String) result.get("message"));
        }
    }
    
    /**
     * Get app info by appId
     * 
     * @param appId The app ID
     * @return Result with app info
     */
    public ApiResponse<Map<String, Object>> getAppInfo(String appId) {
        MongoCollection<Document> metadataCollection = getAppMetadataCollection();
        
        Document appDoc = metadataCollection.find(Filters.eq("appId", appId)).first();
        if (appDoc == null) {
            return createErrorResult("App not found: " + appId);
        }
        
        // Migrate old apps to support multiple indices
        @SuppressWarnings("unchecked")
        List<String> esIndices = (List<String>) appDoc.get("esIndices");
        if (esIndices == null) {
            esIndices = new ArrayList<>();
            String esIndex = appDoc.getString("esIndex");
            if (esIndex != null) {
                esIndices.add(esIndex);
            }
        }
        
        return ApiResponse.success(
            Map.of(
                "appId", appDoc.getString("appId"),
                "appName", appDoc.getString("appName"),
                "esIndex", appDoc.getString("esIndex"),
                "esIndices", esIndices,
                "collections", appDoc.get("collections", new ArrayList<>()),
                "createdAt", appDoc.get("createdAt")
            )
        );
    }
    
    /**
     * Check if Elasticsearch index exists for an app
     * 
     * @param appId The app ID
     * @return Result with exists boolean and index name
     */
    public ApiResponse<Map<String, Object>> checkIndexExists(String appId) {
        MongoCollection<Document> metadataCollection = getAppMetadataCollection();
        
        Document appDoc = metadataCollection.find(Filters.eq("appId", appId)).first();
        if (appDoc == null) {
            return createErrorResult("App not found: " + appId);
        }
        
        String esIndexName = appDoc.getString("esIndex");
        
        try {
            boolean exists = esService.indexExists(esIndexName);
            
            return ApiResponse.success(
                Map.of(
                    "exists", exists,
                    "indexName", esIndexName
                )
            );
        } catch (Exception e) {
            return createErrorResult("Failed to check index existence: " + e.getMessage());
        }
    }
    
    /**
     * Create Elasticsearch index for an app and reindex all collections
     * 
     * @param appId The app ID
     * @return Result
     */
    public ApiResponse<Map<String, Object>> createIndexForApp(String appId) {
        MongoCollection<Document> metadataCollection = getAppMetadataCollection();
        
        Document appDoc = metadataCollection.find(Filters.eq("appId", appId)).first();
        if (appDoc == null) {
            return createErrorResult("App not found: " + appId);
        }
        
        String esIndexName = appDoc.getString("esIndex");
        
        @SuppressWarnings("unchecked")
        List<String> collections = (List<String>) appDoc.get("collections");
        if (collections == null) {
            collections = new ArrayList<>();
        }
        
        try {
            // Create the Elasticsearch index with metadata
            Map<String, String> metadata = new HashMap<>();
            metadata.put("owner", "mongoapp_" + appId);
            esService.createCharLevelIndex(esIndexName, false, metadata);
            
            // Reindex all existing collections
            MongoClient client = mongoService.getMongoClient();
            MongoDatabase database = client.getDatabase(APP_DB_NAME);
            
            int totalDocs = 0;
            for (String collectionName : collections) {
                String appCollNameFull = appId + "_" + collectionName;
                MongoCollection<Document> collection = database.getCollection(appCollNameFull);
                
                // Get all documents in this collection
                for (Document doc : collection.find()) {
                    String docId = doc.getString("id");
                    if (docId != null) {
                        // Force reindex each document
                        Map<String, Object> content = new HashMap<>();
                        doc.forEach((key, value) -> {
                            if (!key.equals("_id") && !key.equals("id")) {
                                content.put(key, value);
                            }
                        });
                        
                        try {
                            mongoIndexService.updateDoc(appId, APP_DB_NAME, appCollNameFull, docId, content, true);
                            totalDocs++;
                        } catch (Exception e) {
                            System.err.println("Failed to reindex doc " + docId + ": " + e.getMessage());
                        }
                    }
                }
            }
            
            return ApiResponse.success(
                Map.of(
                    "indexName", esIndexName,
                    "documentsIndexed", totalDocs
                ),
                "Index created and " + totalDocs + " documents reindexed"
            );
        } catch (Exception e) {
            return createErrorResult("Failed to create index: " + e.getMessage());
        }
    }
    
    /**
     * Get app IDs by app name (exact match)
     * Returns list since multiple apps can have same name
     * 
     * @param appName The app name
     * @return Result with list of matching apps
     */
    public ApiResponse<Map<String, Object>> getAppIdByName(String appName) {
        MongoCollection<Document> metadataCollection = getAppMetadataCollection();
        
        List<Map<String, Object>> apps = new ArrayList<>();
        for (Document appDoc : metadataCollection.find(Filters.eq("appName", appName))) {
            Map<String, Object> appInfo = new HashMap<>();
            appInfo.put("appId", appDoc.getString("appId"));
            appInfo.put("appName", appDoc.getString("appName"));
            appInfo.put("createdAt", appDoc.get("createdAt"));
            apps.add(appInfo);
        }
        
        // Wrap the list in a Map to match the return type
        Map<String, Object> data = new HashMap<>();
        data.put("apps", apps);
        return ApiResponse.success(data);
    }
    
    /**
     * List all documents in a collection
     * 
     * @param appId The app ID
     * @param collectionName The collection name (without appId prefix)
     * @param limit Maximum number of documents to return (default: 100)
     * @param skip Number of documents to skip (default: 0)
     * @return Result with documents and total count
     */
    public ApiResponse<Map<String, Object>> listDocs(String appId, String collectionName, Integer limit, Integer skip) {
        MongoCollection<Document> metadataCollection = getAppMetadataCollection();
        Document appDoc = metadataCollection.find(Filters.eq("appId", appId)).first();
        if (appDoc == null) {
            return createErrorResult("App not found: " + appId);
        }
        
        @SuppressWarnings("unchecked")
        List<String> collections = (List<String>) appDoc.get("collections");
        if (collections == null || !collections.contains(collectionName)) {
            return createErrorResult("Collection not found: " + collectionName);
        }
        
        String appCollNameFull = appId + "_" + collectionName;
        
        // Get collection
        MongoClient client = mongoService.getMongoClient();
        MongoDatabase database = client.getDatabase(APP_DB_NAME);
        MongoCollection<Document> collection = database.getCollection(appCollNameFull);
        
        // Set defaults
        if (limit == null || limit <= 0) {
            limit = 100;
        }
        if (skip == null || skip < 0) {
            skip = 0;
        }
        
        // Cap limit at 1000
        if (limit > 1000) {
            limit = 1000;
        }
        
        // Count total documents
        long total = collection.countDocuments();
        
        // Get documents
        List<Map<String, Object>> documents = new ArrayList<>();
        for (Document doc : collection.find().skip(skip).limit(limit)) {
            Map<String, Object> docMap = new HashMap<>(doc);
            // Convert ObjectId to string for JSON serialization
            if (docMap.get("_id") != null) {
                docMap.put("_id", docMap.get("_id").toString());
            }
            documents.add(docMap);
        }
        
        return ApiResponse.success(
            Map.of(
                "documents", documents,
                "total", total,
                "limit", limit,
                "skip", skip
            )
        );
    }
    
    /**
     * List all mongo apps
     * 
     * @return List of all apps with basic info
     */
    public ApiResponse<List<Map<String, Object>>> listAllApps() {
        MongoCollection<Document> metadataCollection = getAppMetadataCollection();
        
        try {
            List<Map<String, Object>> apps = new ArrayList<>();
            
            for (Document doc : metadataCollection.find()) {
                Map<String, Object> app = new HashMap<>();
                app.put("appId", doc.getString("appId"));
                app.put("appName", doc.getString("appName"));
                app.put("esIndex", doc.getString("esIndex"));
                
                // Migrate old apps to support multiple indices
                @SuppressWarnings("unchecked")
                List<String> esIndices = (List<String>) doc.get("esIndices");
                if (esIndices == null) {
                    esIndices = new ArrayList<>();
                    String esIndex = doc.getString("esIndex");
                    if (esIndex != null) {
                        esIndices.add(esIndex);
                    }
                }
                app.put("esIndices", esIndices);
                
                app.put("createdAt", doc.getLong("createdAt"));
                app.put("collections", doc.get("collections", new ArrayList<>()));
                apps.add(app);
            }
            
            return ApiResponse.success(apps);
        } catch (Exception e) {
            return ApiResponse.error("Failed to list apps: " + e.getMessage());
        }
    }
    
    /**
     * Create a custom API script for a MongoApp
     */
    public ApiResponse<Map<String, Object>> createApiScript(String appId, String endpoint, String scriptSource, String description, Integer timezoneOffset) {
        // Verify app exists
        MongoCollection<Document> metadataCollection = getAppMetadataCollection();
        Document appDoc = metadataCollection.find(Filters.eq("appId", appId)).first();
        if (appDoc == null) {
            return createErrorResult("App not found: " + appId);
        }
        
        // Transform endpoint name to {appId}_{endpoint}
        String actualEndpoint = appId + "_" + endpoint;
        
        // Create script with owner=appId and source=mongoApp
        app.pojo.ApiResponse<app.pojo.GroovyApiScript> result = groovyApiService.uploadScript(
            null, actualEndpoint, scriptSource, description, timezoneOffset, appId, "mongoApp"
        );
        
        if (result.getCode() != 0) {
            return createErrorResult(result.getMessage());
        }
        
        app.pojo.GroovyApiScript script = result.getData();
        Map<String, Object> data = new HashMap<>();
        data.put("scriptId", script.getId());
        data.put("endpoint", script.getEndpoint());
        data.put("apiPath", endpoint); // Store the original api name without prefix
        data.put("description", script.getDescription());
        
        return ApiResponse.success(data, "API script created");
    }
    
    /**
     * List all API scripts for a MongoApp
     */
    public ApiResponse<Map<String, Object>> listMongoAppGroovyApis(String appId) {
        // Verify app exists
        MongoCollection<Document> metadataCollection = getAppMetadataCollection();
        Document appDoc = metadataCollection.find(Filters.eq("appId", appId)).first();
        if (appDoc == null) {
            return createErrorResult("App not found: " + appId);
        }
        
        // Get all scripts with owner=appId and source=mongoApp
        app.pojo.ApiResponse<Map<String, Object>> allScripts = groovyApiService.listScripts();
        if (allScripts.getCode() != 0) {
            return createErrorResult(allScripts.getMessage());
        }
        
        Map<String, Object> scripts = allScripts.getData();
        Map<String, Object> appScripts = new HashMap<>();
        String prefix = appId + "_";
        
        for (Map.Entry<String, Object> entry : scripts.entrySet()) {
            @SuppressWarnings("unchecked")
            Map<String, Object> script = (Map<String, Object>) entry.getValue();
            String owner = (String) script.get("owner");
            String source = (String) script.get("source");
            
            if (appId.equals(owner) && "mongoApp".equals(source)) {
                // Strip appId prefix from endpoint to get apiPath
                String endpoint = (String) script.get("endpoint");
                String apiPath = endpoint;
                if (endpoint != null && endpoint.startsWith(prefix)) {
                    apiPath = endpoint.substring(prefix.length());
                }
                
                // Add apiPath to the script map
                script.put("apiPath", apiPath);
                
                appScripts.put(entry.getKey(), script);
            }
        }
        
        return ApiResponse.success(appScripts);
    }
    
    /**
     * Get an API script by ID
     */
    public ApiResponse<Map<String, Object>> getGroovyApi(String appId, String scriptId) {
        // Verify app exists
        MongoCollection<Document> metadataCollection = getAppMetadataCollection();
        Document appDoc = metadataCollection.find(Filters.eq("appId", appId)).first();
        if (appDoc == null) {
            return createErrorResult("App not found: " + appId);
        }
        
        // Get script
        app.pojo.ApiResponse<app.pojo.GroovyApiScript> result = groovyApiService.getScriptById(scriptId);
        if (result.getCode() != 0) {
            return createErrorResult(result.getMessage());
        }
        
        app.pojo.GroovyApiScript script = result.getData();
        
        // Verify ownership
        if (!appId.equals(script.getOwner()) || !"mongoApp".equals(script.getSource())) {
            return createErrorResult("Script not found or does not belong to this app");
        }
        
        // Strip appId prefix from endpoint to get apiPath
        String endpoint = script.getEndpoint();
        String apiPath = endpoint;
        String prefix = appId + "_";
        if (endpoint != null && endpoint.startsWith(prefix)) {
            apiPath = endpoint.substring(prefix.length());
        }
        
        Map<String, Object> data = new HashMap<>();
        data.put("id", script.getId());
        data.put("endpoint", script.getEndpoint());
        data.put("apiPath", apiPath);
        data.put("scriptSource", script.getScriptSource());
        data.put("description", script.getDescription());
        data.put("createdAt", script.getCreatedAt());
        data.put("updatedAt", script.getUpdatedAt());
        
        return ApiResponse.success(data);
    }
    
    /**
     * Update an API script
     */
    public ApiResponse<Map<String, Object>> updateGroovyApi(String appId, String scriptId, String endpoint, String scriptSource, String description, Integer timezoneOffset) {
        // Verify app exists
        MongoCollection<Document> metadataCollection = getAppMetadataCollection();
        Document appDoc = metadataCollection.find(Filters.eq("appId", appId)).first();
        if (appDoc == null) {
            return createErrorResult("App not found: " + appId);
        }
        
        // Verify script exists and belongs to this app
        app.pojo.ApiResponse<app.pojo.GroovyApiScript> existingResult = groovyApiService.getScriptById(scriptId);
        if (existingResult.getCode() != 0) {
            return createErrorResult(existingResult.getMessage());
        }
        
        app.pojo.GroovyApiScript existing = existingResult.getData();
        if (!appId.equals(existing.getOwner()) || !"mongoApp".equals(existing.getSource())) {
            return createErrorResult("Script not found or does not belong to this app");
        }
        
        // Transform endpoint name to {appId}_{endpoint}
        String actualEndpoint = appId + "_" + endpoint;
        
        // Update script
        app.pojo.ApiResponse<app.pojo.GroovyApiScript> result = groovyApiService.uploadScript(
            scriptId, actualEndpoint, scriptSource, description, timezoneOffset, appId, "mongoApp"
        );
        
        if (result.getCode() != 0) {
            return createErrorResult(result.getMessage());
        }
        
        app.pojo.GroovyApiScript script = result.getData();
        Map<String, Object> data = new HashMap<>();
        data.put("scriptId", script.getId());
        data.put("endpoint", script.getEndpoint());
        data.put("apiPath", endpoint); // Store the original api name without prefix
        data.put("description", script.getDescription());
        
        return ApiResponse.success(data, "API script updated");
    }
    
    /**
     * Delete an API script
     */
    public ApiResponse<Map<String, Object>> deleteApiScript(String appId, String scriptId) {
        // Verify app exists
        MongoCollection<Document> metadataCollection = getAppMetadataCollection();
        Document appDoc = metadataCollection.find(Filters.eq("appId", appId)).first();
        if (appDoc == null) {
            return createErrorResult("App not found: " + appId);
        }
        
        // Verify script exists and belongs to this app
        app.pojo.ApiResponse<app.pojo.GroovyApiScript> existingResult = groovyApiService.getScriptById(scriptId);
        if (existingResult.getCode() != 0) {
            return createErrorResult(existingResult.getMessage());
        }
        
        app.pojo.GroovyApiScript existing = existingResult.getData();
        if (!appId.equals(existing.getOwner()) || !"mongoApp".equals(existing.getSource())) {
            return createErrorResult("Script not found or does not belong to this app");
        }
        
        // Delete script
        app.pojo.ApiResponse<String> result = groovyApiService.deleteScript(scriptId);
        if (result.getCode() != 0) {
            return createErrorResult(result.getMessage());
        }
        
        return ApiResponse.success(Map.of("scriptId", scriptId), "API script deleted");
    }
    
    /**
     * Execute a custom API script for a MongoApp
     */
    public Map<String, Object> executeApiScript(String appId, String endpoint, Map<String, Object> params, Map<String, String> headers) {
        // Verify app exists
        MongoCollection<Document> metadataCollection = getAppMetadataCollection();
        Document appDoc = metadataCollection.find(Filters.eq("appId", appId)).first();
        if (appDoc == null) {
            Map<String, Object> error = new HashMap<>();
            error.put("code", -1);
            error.put("message", "App not found: " + appId);
            error.put("data", null);
            return error;
        }
        
        // Transform endpoint name to {appId}_{endpoint}
        String actualEndpoint = appId + "_" + endpoint;
        
        // Get all scripts for this app
        app.pojo.ApiResponse<Map<String, Object>> allScripts = groovyApiService.listScripts();
        if (allScripts.getCode() != 0) {
            Map<String, Object> error = new HashMap<>();
            error.put("code", -2);
            error.put("message", "Failed to list scripts: " + allScripts.getMessage());
            error.put("data", null);
            return error;
        }
        
        // Find script with matching endpoint, owner, and source
        Map<String, Object> scripts = allScripts.getData();
        String matchingEndpoint = null;
        
        for (Map.Entry<String, Object> entry : scripts.entrySet()) {
            @SuppressWarnings("unchecked")
            Map<String, Object> script = (Map<String, Object>) entry.getValue();
            String scriptEndpoint = (String) script.get("endpoint");
            String owner = (String) script.get("owner");
            String source = (String) script.get("source");
            
            if (actualEndpoint.equals(scriptEndpoint) && appId.equals(owner) && "mongoApp".equals(source)) {
                matchingEndpoint = scriptEndpoint;
                break;
            }
        }
        
        if (matchingEndpoint == null) {
            Map<String, Object> error = new HashMap<>();
            error.put("code", -3);
            error.put("message", "No API script found for endpoint: " + endpoint);
            error.put("data", null);
            return error;
        }
        
        // Execute the script
        return groovyApiService.executeScript(matchingEndpoint, params, headers);
    }
    
    /**
     * Helper to create error result
     */
    private ApiResponse<Map<String, Object>> createErrorResult(String message) {
        return ApiResponse.error(message);
    }
}
