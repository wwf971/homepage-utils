package app.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.bson.Document;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.IndexOptions;
import com.mongodb.client.model.Indexes;
import com.mongodb.client.model.Updates;

import app.pojo.ApiResponse;
import app.pojo.FileInfo;
import app.util.TimeUtils;
import jakarta.annotation.PostConstruct;

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
    
    @Autowired
    private FileAccessPointService fileAccessPointService;
    
    private static final String APP_DB_NAME = "mongo-app";
    private static final String APP_METADATA_COLL_NAME = "__app__";
    
    /**
     * In-memory registry for folder-scanned scripts
     * Structure: Map<appId, Map<endpoint, ScriptFileInfo>>
     * where ScriptFileInfo contains: fileAccessPointId, path, folderPath
     */
    private final java.util.concurrent.ConcurrentHashMap<String, java.util.concurrent.ConcurrentHashMap<String, Map<String, String>>> folderScannedScripts = new java.util.concurrent.ConcurrentHashMap<>();
    
    /**
     * Initialize service - scan all apps' groovy script folders on startup
     */
    @PostConstruct
    public void init() {
        System.out.println("MongoAppService: Initializing and scanning groovy script folders...");
        
        try {
            // Get all apps
            ApiResponse<List<Map<String, Object>>> appsResponse = listAllApps();
            if (appsResponse.getCode() != 0 || appsResponse.getData() == null) {
                System.out.println("MongoAppService: No apps found or error listing apps");
                return;
            }
            
            List<Map<String, Object>> apps = appsResponse.getData();
            int totalScanned = 0;
            int totalLoaded = 0;
            
            // Scan each app's groovy script folders
            for (Map<String, Object> app : apps) {
                String appId = (String) app.get("appId");
                if (appId == null) continue;
                
                // Check if app has groovy script folders configured
                MongoCollection<Document> metadataCollection = getAppMetadataCollection();
                Document appDoc = metadataCollection.find(Filters.eq("appId", appId)).first();
                if (appDoc == null) continue;
                
                @SuppressWarnings("unchecked")
                List<Document> scriptFolders = (List<Document>) appDoc.get("groovyScriptFolders");
                if (scriptFolders == null || scriptFolders.isEmpty()) {
                    continue;
                }
                
                // Scan and load scripts for this app
                System.out.println("MongoAppService: Scanning groovy scripts for app: " + appId + " (" + scriptFolders.size() + " folders)");
                ApiResponse<Map<String, Object>> scanResult = scanAndLoadGroovyScripts(appId);
                
                if (scanResult.getCode() == 0 && scanResult.getData() != null) {
                    Map<String, Object> resultData = scanResult.getData();
                    Integer loadedCount = (Integer) resultData.get("loadedCount");
                    if (loadedCount != null) {
                        totalLoaded += loadedCount;
                        System.out.println("MongoAppService: Loaded " + loadedCount + " scripts for app: " + appId);
                    }
                }
                totalScanned++;
            }
            
            System.out.println("MongoAppService: Initialization complete. Scanned " + totalScanned + " apps, loaded " + totalLoaded + " groovy scripts");
        } catch (Exception e) {
            System.err.println("MongoAppService: Error during initialization: " + e.getMessage());
            e.printStackTrace();
            // Don't throw - let the service start even if scanning fails
        }
    }
    
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

            // add information about owner app in mappings._meta
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
     * List all collections with detailed info including indices
     * @param appId The app ID
     * @return Result with collection details
     */
    public ApiResponse<Map<String, Object>> listCollectionsInfo(String appId) {
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
        
        @SuppressWarnings("unchecked")
        List<String> appEsIndices = (List<String>) appDoc.get("esIndices");
        if (appEsIndices == null || appEsIndices.isEmpty()) {
            appEsIndices = new ArrayList<>();
            // Backward compatibility: check for single esIndex field
            String esIndex = appDoc.getString("esIndex");
            if (esIndex != null && !esIndex.isEmpty()) {
                appEsIndices.add(esIndex);
            }
        }
        
        // Build detailed collection info
        Map<String, Object> collectionsInfo = new HashMap<>();
        
        // Check if collections actually exist in MongoDB
        MongoClient client = mongoService.getMongoClient();
        MongoDatabase database = client.getDatabase(APP_DB_NAME);
        
        for (String collName : collections) {
            String appCollNameFull = appId + "_" + collName;
            
            Map<String, Object> collInfo = new HashMap<>();
            
            // Check if collection exists and count documents
            boolean exists = false;
            long docCount = 0;
            try {
                MongoCollection<Document> coll = database.getCollection(appCollNameFull);
                docCount = coll.countDocuments();
                exists = true;
            } catch (Exception e) {
                // Collection doesn't exist
            }
            
            collInfo.put("exists", exists);
            collInfo.put("docCount", docCount);
            
            // Query MongoIndexService to get actual indices monitoring this collection
            Set<String> monitoringIndexNames = mongoIndexService.getIndicesOfColl(APP_DB_NAME, appCollNameFull);
            
            // Build index list with external marker
            List<Map<String, Object>> indicesList = new ArrayList<>();
            for (String mongoIndexName : monitoringIndexNames) {
                // Get the index metadata to find its ES index name
                Map<String, Object> indexMeta = mongoIndexService.getIndex(mongoIndexName);
                if (indexMeta != null) {
                    String esIndexName = (String) indexMeta.get("esIndex");
                    
                    Map<String, Object> indexInfo = new HashMap<>();
                    indexInfo.put("name", esIndexName);  // Return ES index name to frontend
                    // Check if this ES index belongs to the current app
                    boolean isAppIndex = appEsIndices.contains(esIndexName);
                    indexInfo.put("external", !isAppIndex);
                    indicesList.add(indexInfo);
                }
            }
            
            collInfo.put("indices", indicesList);
            
            collectionsInfo.put(collName, collInfo);
        }
        
        return ApiResponse.success(collectionsInfo);
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
     * Delete a collection for an app
     * 
     * @param appId The app ID
     * @param collectionName The collection name
     * @return Result with deleted collection info
     */
    public ApiResponse<Map<String, Object>> deleteCollection(String appId, String collectionName) {
        if (collectionName == null || collectionName.trim().isEmpty()) {
            return createErrorResult("Collection name cannot be empty");
        }
        
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
        
        if (!collections.contains(collectionName)) {
            return createErrorResult("Collection not found: " + collectionName);
        }
        
        String appCollNameFull = appId + "_" + collectionName;
        
        // Remove collection from mongo-index metadata and drop actual collection.
        Map<String, Object> deleteResult = mongoIndexService.deleteCollectionFromIndices(APP_DB_NAME, appCollNameFull);
        Object deleteCodeObj = deleteResult.get("code");
        int deleteCode = (deleteCodeObj instanceof Number) ? ((Number) deleteCodeObj).intValue() : -1;
        if (deleteCode != 0) {
            return createErrorResult("Failed to delete collection from indices: " + deleteResult.get("message"));
        }
        
        // Update app metadata to remove this collection name.
        List<String> updatedCollections = new ArrayList<>(collections);
        updatedCollections.remove(collectionName);
        metadataCollection.updateOne(
            Filters.eq("appId", appId),
            new Document("$set", new Document("collections", updatedCollections))
        );
        
        return ApiResponse.success(
            Map.of(
                "appId", appId,
                "collectionName", collectionName,
                "appCollNameFull", appCollNameFull
            ),
            "Collection deleted successfully"
        );
    }
    
    /**
     * Delete an app and all its data
     * Fails immediately if any operation fails to ensure data consistency
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
        
        try {
            // Step 1: Delete all collections
            MongoClient client = mongoService.getMongoClient();
            if (client == null) {
                throw new RuntimeException("MongoDB client not initialized");
            }
            MongoDatabase database = client.getDatabase(APP_DB_NAME);
            
            for (String collName : collections) {
                String appCollNameFull = appId + "_" + collName;
                try {
                    database.getCollection(appCollNameFull).drop();
                    System.out.println("Dropped collection: " + appCollNameFull);
                } catch (Exception e) {
                    throw new RuntimeException("Failed to drop collection " + appCollNameFull + ": " + e.getMessage(), e);
                }
            }
            
            // Step 2: Delete mongo-index metadata
            try {
                mongoIndexService.deleteIndex(appId);
                System.out.println("Deleted index metadata for app: " + appId);
            } catch (Exception e) {
                throw new RuntimeException("Failed to delete index metadata: " + e.getMessage(), e);
            }
            
            // Step 3: Delete all Groovy API scripts for this app
            int deletedScripts = 0;
            try {
                app.pojo.ApiResponse<Map<String, Object>> scriptsResponse = listMongoAppGroovyApis(appId);
                if (scriptsResponse.getCode() != 0) {
                    throw new RuntimeException("Failed to list Groovy API scripts: " + scriptsResponse.getMessage());
                }
                
                Map<String, Object> scripts = scriptsResponse.getData();
                for (String scriptId : scripts.keySet()) {
                    try {
                        groovyApiService.deleteScript(scriptId);
                        deletedScripts++;
                        System.out.println("Deleted script: " + scriptId);
                    } catch (Exception e) {
                        throw new RuntimeException("Failed to delete script " + scriptId + ": " + e.getMessage(), e);
                    }
                }
            } catch (RuntimeException e) {
                throw e; // Re-throw RuntimeException as-is
            } catch (Exception e) {
                throw new RuntimeException("Failed to delete Groovy API scripts: " + e.getMessage(), e);
            }
            
            // Step 4: Delete app metadata (only if all above steps succeeded)
            try {
                com.mongodb.client.result.DeleteResult result = metadataCollection.deleteOne(Filters.eq("appId", appId));
                if (result.getDeletedCount() == 0) {
                    throw new RuntimeException("Failed to delete app metadata: no document was deleted");
                }
                System.out.println("Deleted app metadata for: " + appId);
            } catch (Exception e) {
                throw new RuntimeException("Failed to delete app metadata: " + e.getMessage(), e);
            }
            
            return ApiResponse.success(
                Map.of(
                    "appId", appId,
                    "deletedCollections", collections.size(),
                    "deletedScripts", deletedScripts
                ),
                "App deleted successfully"
            );
        } catch (RuntimeException e) {
            System.err.println("App deletion failed for " + appId + ": " + e.getMessage());
            e.printStackTrace();
            return createErrorResult("App deletion failed: " + e.getMessage());
        } catch (Exception e) {
            System.err.println("App deletion failed for " + appId + ": " + e.getMessage());
            e.printStackTrace();
            return createErrorResult("App deletion failed: " + e.getMessage());
        }
    }
    
    /**
     * Rename a MongoApp
     * @param appId The app ID
     * @param newName The new app name
     * @return Result with updated app info
     */
    public ApiResponse<Map<String, Object>> renameApp(String appId, String newName) {
        if (newName == null || newName.trim().isEmpty()) {
            return createErrorResult("New name cannot be empty");
        }
        
        MongoCollection<Document> metadataCollection = getAppMetadataCollection();
        
        Document appDoc = metadataCollection.find(Filters.eq("appId", appId)).first();
        if (appDoc == null) {
            return createErrorResult("App not found: " + appId);
        }
        
        // Update app name
        metadataCollection.updateOne(
            Filters.eq("appId", appId),
            new Document("$set", new Document("appName", newName.trim()))
        );
        
        return ApiResponse.success(
            Map.of(
                "appId", appId,
                "oldName", appDoc.getString("appName"),
                "newName", newName.trim()
            ),
            "App renamed successfully"
        );
    }
    
    /**
     * Create a document in a collection
     * 
     * @param appId The app ID
     * @param collectionName The collection name (without appId prefix)
     * @param docId Document ID
     * @param content Document content
     * @param shouldUpdateIndex Whether to update ES index (default: true)
     * @return Result
     */
    public ApiResponse<Map<String, Object>> createDoc(String appId, String collectionName, String docId, Map<String, Object> content, Boolean shouldUpdateIndex) {
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
        
        // Default to true if not specified
        boolean updateIndex = (shouldUpdateIndex != null) ? shouldUpdateIndex : true;
        
        try {
            collection.insertOne(doc);
            
            // Trigger indexing using MongoIndexService (based on shouldUpdateIndex)
            // The IndexQueue will track createAt/createAtTimeZone metadata
            Object mongoId = doc.get("_id");
            Map<String, Object> updateDict = new HashMap<>(content);
            updateDict.put("id", docId);
            
            mongoIndexService.updateDoc(appId, APP_DB_NAME, appCollNameFull, docId, updateDict, updateIndex);
            
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
     * @param shouldUpdateIndex Whether to update ES index (default: true)
     * @return Result
     */
    public ApiResponse<Map<String, Object>> updateDoc(String appId, String collectionName, String docId, Map<String, Object> updates, Boolean shouldUpdateIndex) {
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
        
        // Default to true if not specified
        boolean updateIndex = (shouldUpdateIndex != null) ? shouldUpdateIndex : true;
        
        // Use MongoIndexService for update (handles ES indexing based on shouldUpdateIndex)
        Map<String, Object> result = mongoIndexService.updateDoc(appId, APP_DB_NAME, appCollNameFull, docId, updates, updateIndex);
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
     * Check if an ES index exists and whether it is registered under this app.
     */
    public ApiResponse<Map<String, Object>> indexExists(String appId, String indexName) {
        if (indexName == null || indexName.trim().isEmpty()) {
            return createErrorResult("Index name cannot be empty");
        }

        MongoCollection<Document> metadataCollection = getAppMetadataCollection();
        Document appDoc = metadataCollection.find(Filters.eq("appId", appId)).first();
        if (appDoc == null) {
            return createErrorResult("App not found: " + appId);
        }

        String normalizedIndexName = normalizeIndexName(indexName);
        List<String> appEsIndices = getAppEsIndices(appDoc);
        boolean isOwnedByApp = appEsIndices.contains(normalizedIndexName);
        boolean isExistsInEs;

        try {
            isExistsInEs = esService.indexExists(normalizedIndexName);
        } catch (Exception e) {
            return createErrorResult("Failed to check index existence: " + e.getMessage());
        }

        Map<String, Object> result = new HashMap<>();
        result.put("indexName", normalizedIndexName);
        result.put("exists", isExistsInEs);
        result.put("isOwnedByApp", isOwnedByApp);
        return ApiResponse.success(result);
    }

    /**
     * Create a new ES index under this app and register it in app metadata.
     */
    public ApiResponse<Map<String, Object>> createEsIndex(String appId, String indexName) {
        if (indexName == null || indexName.trim().isEmpty()) {
            return createErrorResult("Index name cannot be empty");
        }

        MongoCollection<Document> metadataCollection = getAppMetadataCollection();
        Document appDoc = metadataCollection.find(Filters.eq("appId", appId)).first();
        if (appDoc == null) {
            return createErrorResult("App not found: " + appId);
        }

        String normalizedIndexName = normalizeIndexName(indexName);
        List<String> appEsIndices = getAppEsIndices(appDoc);
        if (appEsIndices.contains(normalizedIndexName)) {
            return createErrorResult("Index already registered in app: " + normalizedIndexName);
        }

        try {
            if (esService.indexExists(normalizedIndexName)) {
                return createErrorResult("Elasticsearch index already exists: " + normalizedIndexName);
            }
        } catch (Exception e) {
            return createErrorResult("Failed to validate index existence: " + e.getMessage());
        }

        @SuppressWarnings("unchecked")
        List<String> appCollections = (List<String>) appDoc.get("collections");
        if (appCollections == null) {
            appCollections = new ArrayList<>();
        }

        List<Map<String, String>> monitoredCollections = new ArrayList<>();
        for (String collName : appCollections) {
            Map<String, String> coll = new HashMap<>();
            coll.put("database", APP_DB_NAME);
            coll.put("collection", appId + "_" + collName);
            monitoredCollections.add(coll);
        }

        String mongoIndexName = appId + ":" + normalizedIndexName;

        try {
            Map<String, String> metadata = new HashMap<>();
            metadata.put("appId", appId);
            metadata.put("createdAt", String.valueOf(System.currentTimeMillis()));
            esService.createCharLevelIndex(normalizedIndexName, false, metadata);
            mongoIndexService.createIndex(mongoIndexName, normalizedIndexName, monitoredCollections);
        } catch (Exception e) {
            try {
                if (esService.indexExists(normalizedIndexName)) {
                    esService.deleteIndex(normalizedIndexName);
                }
            } catch (Exception rollbackException) {
                // Best effort rollback; keep original error as the API result.
            }
            return createErrorResult("Failed to create app ES index: " + e.getMessage());
        }

        appEsIndices.add(normalizedIndexName);
        Document setFields = new Document("esIndices", appEsIndices);
        if (appDoc.getString("esIndex") == null || appDoc.getString("esIndex").isEmpty()) {
            setFields.put("esIndex", normalizedIndexName);
        }
        metadataCollection.updateOne(
            Filters.eq("appId", appId),
            new Document("$set", setFields)
        );

        Map<String, Object> result = new HashMap<>();
        result.put("indexName", normalizedIndexName);
        result.put("mongoIndexName", mongoIndexName);
        result.put("monitoredCollections", monitoredCollections.size());
        return ApiResponse.success(result, "ES index created and registered");
    }

    /**
     * Delete an app-owned ES index and unregister it from app metadata.
     */
    public ApiResponse<Map<String, Object>> deleteEsIndex(String appId, String indexName) {
        if (indexName == null || indexName.trim().isEmpty()) {
            return createErrorResult("Index name cannot be empty");
        }

        MongoCollection<Document> metadataCollection = getAppMetadataCollection();
        Document appDoc = metadataCollection.find(Filters.eq("appId", appId)).first();
        if (appDoc == null) {
            return createErrorResult("App not found: " + appId);
        }

        String normalizedIndexName = normalizeIndexName(indexName);
        List<String> appEsIndices = getAppEsIndices(appDoc);
        if (!appEsIndices.contains(normalizedIndexName)) {
            return createErrorResult("Index does not belong to app: " + normalizedIndexName);
        }
        if (appEsIndices.size() <= 1) {
            return createErrorResult("Cannot delete the last app index");
        }

        try {
            if (esService.indexExists(normalizedIndexName)) {
                esService.deleteIndex(normalizedIndexName);
            }
        } catch (Exception e) {
            return createErrorResult("Failed to delete ES index: " + e.getMessage());
        }

        for (String mongoIndexName : getMongoIndexNamesForAppEsIndex(appId, normalizedIndexName)) {
            mongoIndexService.deleteIndex(mongoIndexName);
        }

        appEsIndices.remove(normalizedIndexName);
        Document setFields = new Document("esIndices", appEsIndices);
        if (normalizedIndexName.equals(appDoc.getString("esIndex"))) {
            setFields.put("esIndex", appEsIndices.isEmpty() ? null : appEsIndices.get(0));
        }
        metadataCollection.updateOne(
            Filters.eq("appId", appId),
            new Document("$set", setFields)
        );

        Map<String, Object> result = new HashMap<>();
        result.put("indexName", normalizedIndexName);
        result.put("remainingIndices", appEsIndices);
        return ApiResponse.success(result, "ES index deleted and unregistered");
    }

    /**
     * Rename an app-owned ES index and update app metadata + mongo-index metadata.
     */
    public ApiResponse<Map<String, Object>> renameEsIndex(String appId, String oldIndexName, String newIndexName) {
        if (oldIndexName == null || oldIndexName.trim().isEmpty()) {
            return createErrorResult("Old index name cannot be empty");
        }
        if (newIndexName == null || newIndexName.trim().isEmpty()) {
            return createErrorResult("New index name cannot be empty");
        }

        String normalizedOldName = normalizeIndexName(oldIndexName);
        String normalizedNewName = normalizeIndexName(newIndexName);
        if (normalizedOldName.equals(normalizedNewName)) {
            return createErrorResult("New index name must be different from old index name");
        }

        MongoCollection<Document> metadataCollection = getAppMetadataCollection();
        Document appDoc = metadataCollection.find(Filters.eq("appId", appId)).first();
        if (appDoc == null) {
            return createErrorResult("App not found: " + appId);
        }

        List<String> appEsIndices = getAppEsIndices(appDoc);
        if (!appEsIndices.contains(normalizedOldName)) {
            return createErrorResult("Index does not belong to app: " + normalizedOldName);
        }
        if (appEsIndices.contains(normalizedNewName)) {
            return createErrorResult("New index name already exists in app: " + normalizedNewName);
        }

        try {
            if (esService.indexExists(normalizedNewName)) {
                return createErrorResult("Target ES index already exists: " + normalizedNewName);
            }
        } catch (Exception e) {
            return createErrorResult("Failed to validate target index: " + e.getMessage());
        }

        List<String> mongoIndexNames = getMongoIndexNamesForAppEsIndex(appId, normalizedOldName);
        List<Map<String, Object>> mongoIndices = new ArrayList<>();
        for (String mongoIndexName : mongoIndexNames) {
            Map<String, Object> existing = mongoIndexService.getIndex(mongoIndexName);
            if (existing != null) {
                mongoIndices.add(existing);
            }
        }

        try {
            esService.renameIndex(normalizedOldName, normalizedNewName);
            for (Map<String, Object> mongoIndex : mongoIndices) {
                String mongoIndexName = (String) mongoIndex.get("name");
                @SuppressWarnings("unchecked")
                List<Map<String, String>> collections = (List<Map<String, String>>) mongoIndex.get("collections");
                if (collections == null) {
                    collections = new ArrayList<>();
                }
                mongoIndexService.updateIndexCollections(mongoIndexName, normalizedNewName, collections);
            }
        } catch (Exception e) {
            return createErrorResult("Failed to rename ES index: " + e.getMessage());
        }

        List<String> updatedIndices = new ArrayList<>();
        for (String index : appEsIndices) {
            if (normalizedOldName.equals(index)) {
                updatedIndices.add(normalizedNewName);
            } else {
                updatedIndices.add(index);
            }
        }

        Document setFields = new Document("esIndices", updatedIndices);
        if (normalizedOldName.equals(appDoc.getString("esIndex"))) {
            setFields.put("esIndex", normalizedNewName);
        }
        metadataCollection.updateOne(
            Filters.eq("appId", appId),
            new Document("$set", setFields)
        );

        Map<String, Object> result = new HashMap<>();
        result.put("oldIndexName", normalizedOldName);
        result.put("newIndexName", normalizedNewName);
        return ApiResponse.success(result, "ES index renamed");
    }

    /**
     * Get app-owned ES index details.
     */
    public ApiResponse<Map<String, Object>> getEsIndexInfo(String appId, String indexName) {
        if (indexName == null || indexName.trim().isEmpty()) {
            return createErrorResult("Index name cannot be empty");
        }

        MongoCollection<Document> metadataCollection = getAppMetadataCollection();
        Document appDoc = metadataCollection.find(Filters.eq("appId", appId)).first();
        if (appDoc == null) {
            return createErrorResult("App not found: " + appId);
        }

        String normalizedIndexName = normalizeIndexName(indexName);
        List<String> appEsIndices = getAppEsIndices(appDoc);
        if (!appEsIndices.contains(normalizedIndexName)) {
            return createErrorResult("Index does not belong to app: " + normalizedIndexName);
        }

        try {
            Map<String, Object> info = esService.getIndexInfo(normalizedIndexName);
            long docCount = esService.getEsDocCount(normalizedIndexName);
            Map<String, Object> result = new HashMap<>();
            result.put("indexName", normalizedIndexName);
            result.put("docCount", docCount);
            result.put("info", info);
            return ApiResponse.success(result);
        } catch (Exception e) {
            return createErrorResult("Failed to read index info: " + e.getMessage());
        }
    }

    /**
     * List docs in an app-owned ES index.
     */
    public ApiResponse<Map<String, Object>> listEsDocs(String appId, String indexName, Integer page, Integer pageSize) {
        if (indexName == null || indexName.trim().isEmpty()) {
            return createErrorResult("Index name cannot be empty");
        }

        MongoCollection<Document> metadataCollection = getAppMetadataCollection();
        Document appDoc = metadataCollection.find(Filters.eq("appId", appId)).first();
        if (appDoc == null) {
            return createErrorResult("App not found: " + appId);
        }

        String normalizedIndexName = normalizeIndexName(indexName);
        List<String> appEsIndices = getAppEsIndices(appDoc);
        if (!appEsIndices.contains(normalizedIndexName)) {
            return createErrorResult("Index does not belong to app: " + normalizedIndexName);
        }

        int normalizedPage = (page == null || page < 1) ? 1 : page;
        int normalizedPageSize = (pageSize == null || pageSize < 1) ? 20 : Math.min(pageSize, 200);

        try {
            Map<String, Object> data = esService.getEsDocs(normalizedIndexName, normalizedPage, normalizedPageSize);
            return ApiResponse.success(data);
        } catch (Exception e) {
            return createErrorResult("Failed to list ES docs: " + e.getMessage());
        }
    }

    /**
     * Get one doc from an app-owned ES index.
     */
    public ApiResponse<Map<String, Object>> getEsDoc(String appId, String indexName, String docId) {
        if (indexName == null || indexName.trim().isEmpty()) {
            return createErrorResult("Index name cannot be empty");
        }
        if (docId == null || docId.trim().isEmpty()) {
            return createErrorResult("Doc ID cannot be empty");
        }

        MongoCollection<Document> metadataCollection = getAppMetadataCollection();
        Document appDoc = metadataCollection.find(Filters.eq("appId", appId)).first();
        if (appDoc == null) {
            return createErrorResult("App not found: " + appId);
        }

        String normalizedIndexName = normalizeIndexName(indexName);
        List<String> appEsIndices = getAppEsIndices(appDoc);
        if (!appEsIndices.contains(normalizedIndexName)) {
            return createErrorResult("Index does not belong to app: " + normalizedIndexName);
        }

        try {
            Map<String, Object> data = esService.getEsDoc(normalizedIndexName, docId);
            return ApiResponse.success(data);
        } catch (Exception e) {
            return createErrorResult("Failed to get ES doc: " + e.getMessage());
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
     * Create a custom API script for a MongoApp (inline script)
     */
    public ApiResponse<Map<String, Object>> createApiScript(String appId, String endpoint, String scriptSource, String description, Integer timezone) {
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
            null, actualEndpoint, scriptSource, description, timezone, appId, "mongoApp"
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
     * Create a custom API script from file for a MongoApp
     * @param appId The app ID
     * @param endpoint The endpoint name (without appId prefix)
     * @param fileAccessPointId File access point ID
     * @param specification "single" or "folder"
     * @param path File path or folder path
     * @param description Description
     * @param timezone Timezone offset
     * @return Created script info
     */
    public ApiResponse<Map<String, Object>> createApiScriptFromFile(
            String appId, String endpoint, String fileAccessPointId, 
            String specification, String path, String description, Integer timezone) {
        
        // Verify app exists
        MongoCollection<Document> metadataCollection = getAppMetadataCollection();
        Document appDoc = metadataCollection.find(Filters.eq("appId", appId)).first();
        if (appDoc == null) {
            return createErrorResult("App not found: " + appId);
        }
        
        // Validate parameters
        if (!"single".equals(specification) && !"folder".equals(specification)) {
            return createErrorResult("Specification must be 'single' or 'folder'");
        }
        
        // Transform endpoint name to {appId}_{endpoint}
        String actualEndpoint = appId + "_" + endpoint;
        
        // Create scriptSource object for file-based script
        Map<String, Object> scriptSource = new HashMap<>();
        scriptSource.put("storageType", "fileAccessPoint");
        scriptSource.put("fileAccessPointId", fileAccessPointId);
        scriptSource.put("specification", specification);
        scriptSource.put("path", path);
        
        // Create script with owner=appId and source=mongoApp
        app.pojo.ApiResponse<app.pojo.GroovyApiScript> result = groovyApiService.uploadScriptWithObject(
            null, actualEndpoint, scriptSource, description, timezone, appId, "mongoApp"
        );
        
        if (result.getCode() != 0) {
            return createErrorResult(result.getMessage());
        }
        
        app.pojo.GroovyApiScript script = result.getData();
        Map<String, Object> data = new HashMap<>();
        data.put("scriptId", script.getId());
        data.put("endpoint", script.getEndpoint());
        data.put("apiPath", endpoint);
        data.put("description", script.getDescription());
        data.put("scriptSource", script.getScriptSource());
        
        return ApiResponse.success(data, "File-based API script created");
    }

    /**
     * Refresh an API script from its source file
     * @param appId The app ID
     * @param scriptId The script ID
     * @return Refreshed script info
     */
    public ApiResponse<Map<String, Object>> refreshApiScriptFromFile(String appId, String scriptId) {
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
        
        // Refresh from file
        app.pojo.ApiResponse<app.pojo.GroovyApiScript> result = groovyApiService.refreshScriptFromFile(scriptId);
        if (result.getCode() != 0) {
            return createErrorResult(result.getMessage());
        }
        
        app.pojo.GroovyApiScript script = result.getData();
        
        // Strip appId prefix from endpoint to get apiPath
        String endpoint = script.getEndpoint();
        String apiPath = endpoint;
        String prefix = appId + "_";
        if (endpoint != null && endpoint.startsWith(prefix)) {
            apiPath = endpoint.substring(prefix.length());
        }
        
        Map<String, Object> data = new HashMap<>();
        data.put("scriptId", script.getId());
        data.put("endpoint", script.getEndpoint());
        data.put("apiPath", apiPath);
        data.put("description", script.getDescription());
        data.put("scriptSource", script.getScriptSource());
        
        return ApiResponse.success(data, "Script refreshed from file");
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
    public ApiResponse<Map<String, Object>> updateGroovyApi(String appId, String scriptId, String endpoint, String scriptSource, String description, Integer timezone) {
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
            scriptId, actualEndpoint, scriptSource, description, timezone, appId, "mongoApp"
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
        
        // Check in-memory registry first (folder-scanned scripts)
        if (folderScannedScripts.containsKey(appId)) {
            Map<String, String> scriptInfo = folderScannedScripts.get(appId).get(endpoint);
            if (scriptInfo != null) {
                // Found in folder-scanned scripts - execute directly from file
                try {
                    String fileAccessPointId = scriptInfo.get("fileAccessPointId");
                    String filePath = scriptInfo.get("path");
                    
                    // Load script from file
                    FileInfo fileContent = fileAccessPointService.getFileContent(fileAccessPointId, filePath);
                    String scriptCode = new String(fileContent.getFileBytes(), java.nio.charset.StandardCharsets.UTF_8);
                    
                    // Create backend APIs wrapper
                    MongoAppScriptBackendApis backendApis = new MongoAppScriptBackendApis(appId, this);
                    
                    // Execute script directly
                    return groovyApiService.executeScriptDirect(scriptCode, params, headers, backendApis);
                } catch (Exception e) {
                    Map<String, Object> error = new HashMap<>();
                    error.put("code", -4);
                    error.put("message", "Failed to load/execute folder-scanned script: " + e.getMessage());
                    error.put("data", null);
                    return error;
                }
            }
        }
        
        // Transform endpoint name to {appId}_{endpoint}
        String actualEndpoint = appId + "_" + endpoint;
        
        // Not in folder-scanned scripts, check database (single-file scripts)
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
        
        // Create backend APIs wrapper with appId from URL (not from script)
        MongoAppScriptBackendApis backendApis = new MongoAppScriptBackendApis(appId, this);
        
        // Execute the script with the scoped backend APIs
        return groovyApiService.executeScript(matchingEndpoint, params, headers, backendApis);
    }
    
    /**
     * Add a groovy script folder to auto-load scripts from
     * @param appId The app ID
     * @param fileAccessPointId The file access point ID
     * @param folderPath The folder path (relative path for local/external type)
     * @return Result with success or error message
     */
    public ApiResponse<Map<String, Object>> addGroovyScriptFolder(String appId, String fileAccessPointId, String folderPath) {
        // Verify app exists
        MongoCollection<Document> metadataCollection = getAppMetadataCollection();
        Document appDoc = metadataCollection.find(Filters.eq("appId", appId)).first();
        if (appDoc == null) {
            return createErrorResult("App not found: " + appId);
        }
        
        // Get or create groovyScriptFolders array
        @SuppressWarnings("unchecked")
        List<Document> scriptFolders = (List<Document>) appDoc.get("groovyScriptFolders");
        if (scriptFolders == null) {
            scriptFolders = new ArrayList<>();
        }
        
        // Check if folder already exists
        for (Document folder : scriptFolders) {
            String fapId = folder.getString("fileAccessPointId");
            String path = folder.getString("path");
            if (fileAccessPointId.equals(fapId) && folderPath.equals(path)) {
                return createErrorResult("Folder already registered: " + folderPath);
            }
        }
        
        // Add new folder
        Document newFolder = new Document();
        newFolder.put("fileAccessPointId", fileAccessPointId);
        newFolder.put("path", folderPath);
        newFolder.put("addedAt", System.currentTimeMillis());
        scriptFolders.add(newFolder);
        
        // Update app document
        metadataCollection.updateOne(
            Filters.eq("appId", appId),
            Updates.set("groovyScriptFolders", scriptFolders)
        );
        
        Map<String, Object> result = new HashMap<>();
        result.put("fileAccessPointId", fileAccessPointId);
        result.put("path", folderPath);
        return ApiResponse.success(result, "Groovy script folder added successfully");
    }
    
    /**
     * Remove a groovy script folder
     * @param appId The app ID
     * @param fileAccessPointId The file access point ID
     * @param folderPath The folder path
     * @return Result with success or error message
     */
    public ApiResponse<Map<String, Object>> removeGroovyScriptFolder(String appId, String fileAccessPointId, String folderPath) {
        // Verify app exists
        MongoCollection<Document> metadataCollection = getAppMetadataCollection();
        Document appDoc = metadataCollection.find(Filters.eq("appId", appId)).first();
        if (appDoc == null) {
            return createErrorResult("App not found: " + appId);
        }
        
        // Get groovyScriptFolders array
        @SuppressWarnings("unchecked")
        List<Document> scriptFolders = (List<Document>) appDoc.get("groovyScriptFolders");
        if (scriptFolders == null || scriptFolders.isEmpty()) {
            return createErrorResult("No groovy script folders configured");
        }
        
        // Remove matching folder
        boolean removed = scriptFolders.removeIf(folder -> {
            String fapId = folder.getString("fileAccessPointId");
            String path = folder.getString("path");
            return fileAccessPointId.equals(fapId) && folderPath.equals(path);
        });
        
        if (!removed) {
            return createErrorResult("Folder not found: " + folderPath);
        }
        
        // Update app document
        metadataCollection.updateOne(
            Filters.eq("appId", appId),
            Updates.set("groovyScriptFolders", scriptFolders)
        );
        
        Map<String, Object> result = new HashMap<>();
        result.put("fileAccessPointId", fileAccessPointId);
        result.put("path", folderPath);
        return ApiResponse.success(result, "Groovy script folder removed successfully");
    }
    
    /**
     * List groovy script folders for an app
     * @param appId The app ID
     * @return List of script folders
     */
    public ApiResponse<List<Map<String, Object>>> listGroovyScriptFolders(String appId) {
        // Verify app exists
        MongoCollection<Document> metadataCollection = getAppMetadataCollection();
        Document appDoc = metadataCollection.find(Filters.eq("appId", appId)).first();
        if (appDoc == null) {
            return ApiResponse.error("App not found: " + appId);
        }
        
        // Get groovyScriptFolders array
        @SuppressWarnings("unchecked")
        List<Document> scriptFolders = (List<Document>) appDoc.get("groovyScriptFolders");
        if (scriptFolders == null) {
            scriptFolders = new ArrayList<>();
        }
        
        // Convert to list of maps
        List<Map<String, Object>> result = new ArrayList<>();
        for (Document folder : scriptFolders) {
            Map<String, Object> folderMap = new HashMap<>();
            folderMap.put("fileAccessPointId", folder.getString("fileAccessPointId"));
            folderMap.put("path", folder.getString("path"));
            folderMap.put("addedAt", folder.getLong("addedAt"));
            result.add(folderMap);
        }
        
        return ApiResponse.success(result, "Groovy script folders retrieved successfully");
    }
    
    /**
     * Scan groovy script folders and auto-load scripts
     * Scans from last folder to first, so first folder takes priority
     * @param appId The app ID
     * @return Result with loaded scripts count and details
     */
    public ApiResponse<Map<String, Object>> scanAndLoadGroovyScripts(String appId) {
        // Verify app exists
        MongoCollection<Document> metadataCollection = getAppMetadataCollection();
        Document appDoc = metadataCollection.find(Filters.eq("appId", appId)).first();
        if (appDoc == null) {
            return createErrorResult("App not found: " + appId);
        }
        
        // Get groovyScriptFolders array
        @SuppressWarnings("unchecked")
        List<Document> scriptFolders = (List<Document>) appDoc.get("groovyScriptFolders");
        if (scriptFolders == null || scriptFolders.isEmpty()) {
            return createErrorResult("No groovy script folders configured");
        }
        
        Map<String, Object> result = new HashMap<>();
        List<Map<String, Object>> loadedScripts = new ArrayList<>();
        List<Map<String, Object>> skippedScripts = new ArrayList<>();
        Map<String, String> endpointRegistry = new HashMap<>(); // endpoint -> source folder
        
        // Scan from last to first, so first folder wins in case of duplicate
        for (int i = scriptFolders.size() - 1; i >= 0; i--) {
            Document folder = scriptFolders.get(i);
            String fileAccessPointId = folder.getString("fileAccessPointId");
            String folderPath = folder.getString("path");
            
            try {
                // List files in folder
                List<FileInfo> files = fileAccessPointService.listFiles(fileAccessPointId, folderPath, 0, 1000);
                
                for (FileInfo file : files) {
                    // Only process .groovy files
                    if (!file.getName().endsWith(".groovy") || file.isDirectory()) {
                        continue;
                    }
                    
                    // Extract endpoint name (filename without .groovy)
                    String endpoint = file.getName().substring(0, file.getName().length() - ".groovy".length());
                    
                    // Check if endpoint already registered (from higher priority folder)
                    if (endpointRegistry.containsKey(endpoint)) {
                        Map<String, Object> skipped = new HashMap<>();
                        skipped.put("endpoint", endpoint);
                        skipped.put("file", file.getPath());
                        skipped.put("reason", "Endpoint already registered from: " + endpointRegistry.get(endpoint));
                        skippedScripts.add(skipped);
                        continue;
                    }
                    
                    // Construct file path
                    String filePath = folderPath.isEmpty() ? file.getName() : folderPath + "/" + file.getName();
                    
                    // Store in-memory (non-persistent)
                    endpointRegistry.put(endpoint, fileAccessPointId + ":" + folderPath);
                    
                    Map<String, String> scriptInfo = new HashMap<>();
                    scriptInfo.put("fileAccessPointId", fileAccessPointId);
                    scriptInfo.put("path", filePath);
                    scriptInfo.put("folderPath", folderPath);
                    scriptInfo.put("endpoint", endpoint);
                    
                    // Get or create app-specific registry
                    folderScannedScripts.putIfAbsent(appId, new java.util.concurrent.ConcurrentHashMap<>());
                    folderScannedScripts.get(appId).put(endpoint, scriptInfo);
                    
                    Map<String, Object> loaded = new HashMap<>();
                    loaded.put("endpoint", endpoint);
                    loaded.put("file", filePath);
                    loaded.put("fileAccessPointId", fileAccessPointId);
                    loadedScripts.add(loaded);
                }
            } catch (Exception e) {
                System.err.println("Error scanning folder " + folderPath + ": " + e.getMessage());
                e.printStackTrace();
                // Continue with next folder
            }
        }
        
        result.put("loadedCount", loadedScripts.size());
        result.put("skippedCount", skippedScripts.size());
        result.put("loadedScripts", loadedScripts);
        result.put("skippedScripts", skippedScripts);
        
        return ApiResponse.success(result, "Scanned " + scriptFolders.size() + " folders, loaded " + loadedScripts.size() + " scripts");
    }
    
    /**
     * Get folder-scanned scripts for an app (from in-memory registry)
     * @param appId The app ID
     * @return List of scripts with their folder info and file content
     */
    public ApiResponse<List<Map<String, Object>>> getScriptScannedFromFolders(String appId) {
        List<Map<String, Object>> scripts = new ArrayList<>();
        
        if (folderScannedScripts.containsKey(appId)) {
            Map<String, Map<String, String>> appScripts = folderScannedScripts.get(appId);
            
            for (Map.Entry<String, Map<String, String>> entry : appScripts.entrySet()) {
                Map<String, String> scriptInfo = entry.getValue();
                Map<String, Object> script = new HashMap<>();
                
                script.put("endpoint", scriptInfo.get("endpoint"));
                script.put("fileAccessPointId", scriptInfo.get("fileAccessPointId"));
                script.put("path", scriptInfo.get("path"));
                script.put("folderPath", scriptInfo.get("folderPath"));
                script.put("source", "folder-scanned"); // Mark as folder-scanned
                
                // Load file content for display
                try {
                    String fileAccessPointId = scriptInfo.get("fileAccessPointId");
                    String filePath = scriptInfo.get("path");
                    FileInfo fileContent = fileAccessPointService.getFileContent(fileAccessPointId, filePath);
                    String scriptCode = new String(fileContent.getFileBytes(), java.nio.charset.StandardCharsets.UTF_8);
                    script.put("fileContent", scriptCode);
                } catch (Exception e) {
                    System.err.println("Failed to load file content for " + scriptInfo.get("path") + ": " + e.getMessage());
                    script.put("fileContent", "// Failed to load file content: " + e.getMessage());
                }
                
                scripts.add(script);
            }
        }
        
        return ApiResponse.success(scripts, "Folder-scanned scripts retrieved");
    }
    
    /**
     * Scan and load groovy scripts from a specific folder
     */
    public ApiResponse<Map<String, Object>> scanAndLoadGroovyScriptsFromFolder(String appId, String fileAccessPointId, String folderPath) {
        // Verify app exists
        MongoCollection<Document> metadataCollection = getAppMetadataCollection();
        Document appDoc = metadataCollection.find(Filters.eq("appId", appId)).first();
        if (appDoc == null) {
            return createErrorResult("App not found: " + appId);
        }
        
        // Verify folder is configured
        @SuppressWarnings("unchecked")
        List<Document> scriptFolders = (List<Document>) appDoc.get("groovyScriptFolders");
        if (scriptFolders == null || scriptFolders.isEmpty()) {
            return createErrorResult("No groovy script folders configured");
        }
        
        boolean folderFound = false;
        for (Document folder : scriptFolders) {
            if (fileAccessPointId.equals(folder.getString("fileAccessPointId")) 
                && folderPath.equals(folder.getString("path"))) {
                folderFound = true;
                break;
            }
        }
        
        if (!folderFound) {
            return createErrorResult("Folder not configured: " + fileAccessPointId + ":" + folderPath);
        }
        
        Map<String, Object> result = new HashMap<>();
        List<Map<String, Object>> loadedScripts = new ArrayList<>();
        List<Map<String, Object>> skippedScripts = new ArrayList<>();
        
        try {
            // List files in folder
            List<FileInfo> files = fileAccessPointService.listFiles(fileAccessPointId, folderPath, 0, 1000);
            
            for (FileInfo file : files) {
                // Only process .groovy files
                if (!file.getName().endsWith(".groovy") || file.isDirectory()) {
                    continue;
                }
                
                // Extract endpoint name (filename without .groovy)
                String endpoint = file.getName().substring(0, file.getName().length() - ".groovy".length());
                
                // Construct file path
                String filePath = folderPath.isEmpty() ? file.getName() : folderPath + "/" + file.getName();
                
                // Store in-memory (non-persistent)
                Map<String, String> scriptInfo = new HashMap<>();
                scriptInfo.put("fileAccessPointId", fileAccessPointId);
                scriptInfo.put("path", filePath);
                scriptInfo.put("folderPath", folderPath);
                scriptInfo.put("endpoint", endpoint);
                
                // Get or create app-specific registry
                folderScannedScripts.putIfAbsent(appId, new java.util.concurrent.ConcurrentHashMap<>());
                folderScannedScripts.get(appId).put(endpoint, scriptInfo);
                
                Map<String, Object> loaded = new HashMap<>();
                loaded.put("endpoint", endpoint);
                loaded.put("file", filePath);
                loaded.put("fileAccessPointId", fileAccessPointId);
                loadedScripts.add(loaded);
            }
        } catch (Exception e) {
            System.err.println("Error scanning folder " + folderPath + ": " + e.getMessage());
            e.printStackTrace();
            return createErrorResult("Error scanning folder: " + e.getMessage());
        }
        
        result.put("loadedCount", loadedScripts.size());
        result.put("skippedCount", skippedScripts.size());
        result.put("loadedScripts", loadedScripts);
        result.put("skippedScripts", skippedScripts);
        
        return ApiResponse.success(result, "Scanned folder, loaded " + loadedScripts.size() + " scripts");
    }
    
    /**
     * Helper to create error result
     */
    private ApiResponse<Map<String, Object>> createErrorResult(String message) {
        return ApiResponse.error(message);
    }

    private String normalizeIndexName(String indexName) {
        return indexName.trim().toLowerCase(Locale.ROOT);
    }

    @SuppressWarnings("unchecked")
    private List<String> getAppEsIndices(Document appDoc) {
        List<String> esIndices = (List<String>) appDoc.get("esIndices");
        if (esIndices == null) {
            esIndices = new ArrayList<>();
            String esIndex = appDoc.getString("esIndex");
            if (esIndex != null && !esIndex.isEmpty()) {
                esIndices.add(esIndex);
            }
        }
        return new ArrayList<>(esIndices);
    }

    private List<String> getMongoIndexNamesForAppEsIndex(String appId, String esIndexName) {
        List<String> names = new ArrayList<>();
        for (Map<String, Object> index : mongoIndexService.listIndices()) {
            String name = (String) index.get("name");
            String esIndex = (String) index.get("esIndex");
            if (name == null || esIndex == null) {
                continue;
            }
            boolean isOwnedByApp = name.equals(appId) || name.startsWith(appId + ":");
            if (isOwnedByApp && esIndexName.equals(normalizeIndexName(esIndex))) {
                names.add(name);
            }
        }
        return names;
    }
}
