package app.service;

import app.pojo.ApiResponse;
import app.util.TimeUtils;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.IndexOptions;
import com.mongodb.client.model.Indexes;
import org.bson.Document;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

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
            return ApiResponse.success(
                Map.of(
                    "appId", existing.getString("appId"),
                    "appName", existing.getString("appName"),
                    "esIndex", existing.getString("esIndex"),
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
        
        // Create app metadata document
        Document appDoc = new Document("appId", appId)
            .append("appName", appName)
            .append("esIndex", esIndexName)
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
        
        // Create the actual Elasticsearch index
        try {
            esService.createOrClearIndex(esIndexName, false);
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
        
        // Delete app metadata
        metadataCollection.deleteOne(Filters.eq("appId", appId));
        
        return ApiResponse.success(
            Map.of(
                "appId", appId,
                "deletedCollections", collections.size()
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
        
        return ApiResponse.success(
            Map.of(
                "appId", appDoc.getString("appId"),
                "appName", appDoc.getString("appName"),
                "esIndex", appDoc.getString("esIndex"),
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
            // Create the Elasticsearch index
            esService.createOrClearIndex(esIndexName, false);
            
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
     * Helper to create error result
     */
    private ApiResponse<Map<String, Object>> createErrorResult(String message) {
        return ApiResponse.error(message);
    }
}
