package app.service;

import app.util.TimeUtils;
import com.mongodb.ClientSessionOptions;
import com.mongodb.TransactionOptions;
import com.mongodb.ReadConcern;
import com.mongodb.ReadPreference;
import com.mongodb.WriteConcern;
import com.mongodb.client.ClientSession;
import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.IndexOptions;
import com.mongodb.client.model.Indexes;
import com.mongodb.client.model.UpdateOptions;
import com.mongodb.client.model.Updates;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.bson.types.ObjectId;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * Service for managing MongoDB-Elasticsearch index metadata
 * Stores metadata in mongo-index collection in the metadata database
 */
@Service
public class MongoIndexService {

    @Autowired
    private MongoService mongoService;
    
    @Autowired
    private ElasticSearchService elasticSearchService;

    @Autowired
    private MongoIndexQueueService indexQueueService;

    @Autowired(required = false)
    @org.springframework.context.annotation.Lazy
    private RedissonClient redissonClient;

    @Autowired
    private TaskService taskService;
    
    // Self-injection to enable @Async proxy to work
    @Autowired
    @org.springframework.context.annotation.Lazy
    private MongoIndexService self;

    private static final String METADATA_COLLECTION = "mongo-index";
    
    // If true, continue execution even if distributed lock cannot be acquired (e.g., Redis is down)
    private static final boolean CONTINUE_ON_LOCK_FAILURE = true;
    private static final boolean CHECK_BEFORE_SETTING_INDEX_VERSION = true;
    
    // Reverse index: maps "database.collection" -> Set of index names that monitor it
    // This allows efficient lookup of which indices need to be updated when a collection changes
    private final Map<String, Set<String>> collectionToIndicesMap = new ConcurrentHashMap<>();

    /**
     * Get the metadata collection, creating it if necessary
     */
    private MongoCollection<Document> getMetadataCollection() {
        MongoClient client = mongoService.getMongoClient();
        if (client == null) {
            throw new RuntimeException("MongoDB client not initialized");
        }

        String databaseName = mongoService.getConfigCurrent() != null 
            ? mongoService.getConfigCurrent().getDatabase()
            : "main";

        MongoDatabase database = client.getDatabase(databaseName);
        
        // Try to create collection, ignore error if it already exists
        try {
            database.createCollection(METADATA_COLLECTION);
            System.out.println("Created mongo-index metadata collection");
        } catch (com.mongodb.MongoCommandException e) {
            // Collection already exists (error code 48) - this is fine
            if (e.getErrorCode() != 48) {
                // If it's a different error, rethrow it
                throw e;
            }
        }

        return database.getCollection(METADATA_COLLECTION);
    }
    /**
     * Build the reverse index mapping from collections to indices
     * Scans all indices and populates collectionToIndicesMap
     * 
     * This should be called:
     * - On service initialization (lazy)
     * - After creating/updating/deleting an index
     * 
     * Thread-safe: uses ConcurrentHashMap
     */
    public void buildIndicesOfColl() {
        Map<String, Set<String>> newMap = new ConcurrentHashMap<>();
        
        try {
            List<Map<String, Object>> allIndices = listIndices();
            
            for (Map<String, Object> index : allIndices) {
                String indexName = (String) index.get("name");
                
                @SuppressWarnings("unchecked")
                List<Map<String, String>> collections = (List<Map<String, String>>) index.get("collections");
                
                if (collections != null && indexName != null) {
                    for (Map<String, String> collInfo : collections) {
                        String database = collInfo.get("database");
                        String collection = collInfo.get("collection");
                        
                        if (database != null && collection != null) {
                            String key = makeCollectionKey(database, collection);
                            newMap.computeIfAbsent(key, k -> ConcurrentHashMap.newKeySet())
                                  .add(indexName);
                        }
                    }
                }
            }
            
            // Replace the entire map atomically
            collectionToIndicesMap.clear();
            collectionToIndicesMap.putAll(newMap);
            
            System.out.println("Built collection->indices mapping: " + collectionToIndicesMap.size() + " collections monitored");
        } catch (Exception e) {
            System.err.println("Failed to build collection->indices mapping: " + e.getMessage());
            e.printStackTrace();
        }
    }

    /**
     * Get all indices that monitor a specific collection
     * Returns an empty set if no indices monitor this collection
     * 
     * @param database Database name
     * @param collection Collection name
     * @return Set of index names (never null, may be empty)
     */
    public Set<String> getIndicesOfColl(String database, String collection) {
        // Lazy initialization of the mapping if empty
        if (collectionToIndicesMap.isEmpty()) {
            synchronized (this) {
                if (collectionToIndicesMap.isEmpty()) {
                    buildIndicesOfColl();
                }
            }
        }
        
        String key = makeCollectionKey(database, collection);
        Set<String> indices = collectionToIndicesMap.get(key);
        
        // Return a defensive copy to prevent external modification
        return indices != null ? new HashSet<>(indices) : new HashSet<>();
    }

    /**
     * Create a consistent key for the collection map
     * Format: "database.collection"
     */
    private String makeCollectionKey(String database, String collection) {
        return database + "." + collection;
    }

    /**
     * Convert MongoDB Document to Map
     */
    private Map<String, Object> documentToMap(Document doc) {
        Map<String, Object> map = new HashMap<>();
        
        // Convert _id to string
        if (doc.get("_id") != null) {
            map.put("_id", doc.get("_id").toString());
        }
        
        map.put("name", doc.getString("name"));
        map.put("esIndex", doc.getString("esIndex"));
        
        @SuppressWarnings("unchecked")
        List<Document> collectionsDocs = (List<Document>) doc.get("collections");
        if (collectionsDocs != null) {
            List<Map<String, String>> collections = collectionsDocs.stream()
                .map(d -> {
                    Map<String, String> coll = new HashMap<>();
                    coll.put("database", d.getString("database"));
                    coll.put("collection", d.getString("collection"));
                    return coll;
                })
                .collect(Collectors.toList());
            map.put("collections", collections);
        } else {
            map.put("collections", new ArrayList<>());
        }
        
        return map;
    }

    /**
     * List all indices
     */
    public List<Map<String, Object>> listIndices() {
        MongoCollection<Document> collection = getMetadataCollection();
        
        List<Map<String, Object>> indices = new ArrayList<>();
        for (Document doc : collection.find()) {
            indices.add(documentToMap(doc));
        }
        
        return indices;
    }

    /**
     * Get a specific index by name
     */
    public Map<String, Object> getIndex(String name) {
        MongoCollection<Document> collection = getMetadataCollection();
        
        Document filter = new Document("name", name);
        Document doc = collection.find(filter).first();
        
        if (doc == null) {
            return null;
        }
        
        return documentToMap(doc);
    }

    /**
     * Create a new index
     */
    public Map<String, Object> createIndex(String name, String esIndex, List<Map<String, String>> collections) {
        MongoCollection<Document> collection = getMetadataCollection();
        
        // Check if index with this name already exists
        Document existing = collection.find(new Document("name", name)).first();
        if (existing != null) {
            throw new RuntimeException("Index with name '" + name + "' already exists");
        }
        
        // Convert collections to Documents
        List<Document> collectionDocs = collections.stream()
            .map(c -> new Document("database", c.get("database"))
                .append("collection", c.get("collection")))
            .collect(Collectors.toList());
        
        Document doc = new Document("name", name)
            .append("esIndex", esIndex)
            .append("collections", collectionDocs);
        
        collection.insertOne(doc);
        
        // Rebuild the collection->indices mapping
        buildIndicesOfColl();
        
        return documentToMap(doc);
    }

    /**
     * Update an existing index
     */
    public Map<String, Object> updateIndexCollections(String name, String esIndex, List<Map<String, String>> collections) {
        MongoCollection<Document> collection = getMetadataCollection();
        
        Document filter = new Document("name", name);
        Document existing = collection.find(filter).first();
        
        if (existing == null) {
            return null;
        }
        
        // Convert collections to Documents
        List<Document> collectionDocs = collections.stream()
            .map(c -> new Document("database", c.get("database"))
                .append("collection", c.get("collection")))
            .collect(Collectors.toList());
        
        Document update = new Document("$set", new Document()
            .append("esIndex", esIndex)
            .append("collections", collectionDocs));
        
        collection.updateOne(filter, update);
        
        // Rebuild the collection->indices mapping
        buildIndicesOfColl();
        
        // Fetch and return updated document
        Document updated = collection.find(filter).first();
        return documentToMap(updated);
    }

    /**
     * Delete an index
     */
    public boolean deleteIndex(String name) {
        MongoCollection<Document> collection = getMetadataCollection();
        
        Document filter = new Document("name", name);
        long deletedCount = collection.deleteOne(filter).getDeletedCount();
        
        // Rebuild the collection->indices mapping
        if (deletedCount > 0) {
            buildIndicesOfColl();
        }
        
        return deletedCount > 0;
    }

    /**
     * Delete a collection and remove it from all indices that monitor it
     * Also drops the actual MongoDB collection
     */
    public Map<String, Object> deleteCollectionFromIndices(String dbName, String collName) {
        try {
            // Find all indices monitoring this collection
            Set<String> affectedIndices = getIndicesOfColl(dbName, collName);
            
            // Remove the collection from each index
            MongoCollection<Document> metadataCollection = getMetadataCollection();
            int updatedIndices = 0;
            
            for (String indexName : affectedIndices) {
                Document filter = new Document("name", indexName);
                Document index = metadataCollection.find(filter).first();
                
                if (index != null) {
                    @SuppressWarnings("unchecked")
                    List<Document> collections = (List<Document>) index.get("collections");
                    
                    if (collections != null) {
                        // Remove the matching collection
                        List<Document> updatedCollections = collections.stream()
                            .filter(c -> !(c.getString("database").equals(dbName) && 
                                         c.getString("collection").equals(collName)))
                            .collect(Collectors.toList());
                        
                        // Update the index
                        Document update = new Document("$set", new Document("collections", updatedCollections));
                        metadataCollection.updateOne(filter, update);
                        updatedIndices++;
                    }
                }
            }
            
            // Drop the actual MongoDB collection
            mongoService.deleteCollection(dbName, collName);
            
            // Rebuild the collection->indices mapping
            buildIndicesOfColl();
            
            Map<String, Object> result = new HashMap<>();
            result.put("code", 0);
            result.put("message", "Collection deleted successfully and removed from " + updatedIndices + " index(es)");
            result.put("data", Map.of(
                "database", dbName,
                "collection", collName,
                "affectedIndices", affectedIndices,
                "updatedIndicesCount", updatedIndices
            ));
            return result;
        } catch (Exception e) {
            Map<String, Object> result = new HashMap<>();
            result.put("code", -1);
            result.put("message", "Failed to delete collection: " + e.getMessage());
            return result;
        }
    }

    /**
     * Search databases (filter by query if provided)
     */
    public List<String> searchDatabases(String query) {
        List<String> allDatabases = mongoService.listAllDatabases();
        
        if (query == null || query.trim().isEmpty()) {
            return allDatabases;
        }
        
        String lowerQuery = query.toLowerCase();
        return allDatabases.stream()
            .filter(db -> db.toLowerCase().contains(lowerQuery))
            .collect(Collectors.toList());
    }

    /**
     * Search collections in a database (filter by query if provided)
     */
    public List<String> searchCollections(String database, String query) {
        List<String> allCollections = mongoService.listCollectionsInDatabase(database);
        
        if (query == null || query.trim().isEmpty()) {
            return allCollections;
        }
        
        String lowerQuery = query.toLowerCase();
        return allCollections.stream()
            .filter(coll -> coll.toLowerCase().contains(lowerQuery))
            .collect(Collectors.toList());
    }

    // ============================================================================
    // Document CRUD Operations with Metadata Management
    // ============================================================================


    /**
     * Update a document with metadata management using IndexQueue and transactions
     * 
     * @param indexName The mongo-index name
     * @param database Database name
     * @param collection Collection name
     * @param docId The document custom ID
     * @param updateDict Map of field paths to update (stored at document top level)
     * @param updateIndex Whether to trigger index update (default true)
     * @return Result map with code, message, and data
     */
    public Map<String, Object> updateDoc(String indexName, String database, String collection, String docId, 
                                         Map<String, Object> updateDict, boolean updateIndex) {
        // Verify collection is part of index
        Map<String, Object> indexMeta = getIndex(indexName);
        if (indexMeta == null) {
            return createErrorResult("Index not found: " + indexName);
        }

        @SuppressWarnings("unchecked")
        List<Map<String, String>> collections = (List<Map<String, String>>) indexMeta.get("collections");
        boolean isCollectionInIndex = false;
        if (collections != null) {
            for (Map<String, String> collInfo : collections) {
                if (database.equals(collInfo.get("database")) && collection.equals(collInfo.get("collection"))) {
                    isCollectionInIndex = true;
                    break;
                }
            }
        }
        
        if (!isCollectionInIndex) {
            return createErrorResult("Collection " + database + "." + collection + " is not part of index: " + indexName);
        }

        MongoClient client = mongoService.getMongoClient();
        Object mongoIdObj = parseDocId(docId);
        
        // Get IndexQueue entry (or create if missing)
        Document queueEntry = indexQueueService.getOrCreateIndexQueueEntry(database, collection, docId, mongoIdObj);
        if (queueEntry == null) {
            return createErrorResult("Document not found in " + database + "." + collection);
        }

        String esIndexName = (String) indexMeta.get("esIndex");
        
        try {
            long currentTime = TimeUtils.getCurrentTimestamp();
            int currentTz = TimeUtils.getCurrentTimezoneOffset();
            Long currentVersion = queueEntry.getLong("updateVersion");
            if (currentVersion == null) currentVersion = 0L;
            long newVersion = currentVersion + 1;

            // Start transaction
            ClientSession session = client.startSession();
            try {
                session.startTransaction();
                
                MongoDatabase db = client.getDatabase(database);
                MongoCollection<Document> coll = db.getCollection(collection);
                MongoCollection<Document> indexQueue = indexQueueService.getIndexQueueCollection(database);

                // 1. Update main document (data at top level, no content wrapper)
                List<Bson> docUpdates = new ArrayList<>();
                for (Map.Entry<String, Object> entry : updateDict.entrySet()) {
                    docUpdates.add(Updates.set(entry.getKey(), entry.getValue()));
                }
                
                coll.updateOne(session, Filters.eq("_id", mongoIdObj), Updates.combine(docUpdates));

                // 2. Upsert IndexQueue with new version and status=-1
                Bson queueFilter = Filters.and(
                    Filters.eq("docId", docId),
                    // Filters.eq("collection", collection), // docId is unique globally
                    Filters.lt("updateVersion", newVersion)
                );
                
                Document queueUpdate = new Document("$set", new Document()
                    .append("collection", collection)
                    .append("updateVersion", newVersion)
                    .append("status", -1)
                    .append("updateAt", currentTime)
                    .append("updateAtTimeZone", currentTz)
                    .append("mongoId", mongoIdObj.toString())
                );
                
                // Initialize createAt if this is first time
                if (queueEntry.get("createAt") == null) {
                    queueUpdate.get("$set", Document.class)
                        .append("createAt", currentTime)
                        .append("createAtTimeZone", currentTz);
                }
                
                indexQueue.updateOne(session, queueFilter, queueUpdate, new UpdateOptions().upsert(true));

                // Commit transaction
                session.commitTransaction();
                
                // Trigger async indexing if requested
                if (updateIndex) {
                    createIndexAfterUpdateDoc(indexName, database, collection, mongoIdObj, docId, 
                                            newVersion, currentTime, esIndexName);
                }
                
                Map<String, Object> result = new HashMap<>();
                result.put("code", 0);
                result.put("message", "Document updated successfully");
                result.put("data", Map.of("docId", docId, "updateAt", currentTime, "updateVersion", newVersion));
                return result;
                
            } catch (Exception e) {
                session.abortTransaction();
                throw e;
            } finally {
                session.close();
            }
        } catch (Exception e) {
            return createErrorResult("Failed to update document: " + e.getMessage());
        }
    }

    /**
     * Get a document (returns document data at top level)
     * 
     * @param indexName The mongo-index name
     * @param database Database name
     * @param collection Collection name
     * @param docId The document custom ID
     * @return Result map with code, message, and data (document at top level)
     */
    /**
     * Get a document using raw CRUD (no index validation)
     */
    public Map<String, Object> getDocRaw(String database, String collection, String docId) {
        Object mongoIdObj = parseDocId(docId);

        MongoClient client = mongoService.getMongoClient();
        MongoDatabase db = client.getDatabase(database);
        MongoCollection<Document> coll = db.getCollection(collection);

        Document doc = coll.find(Filters.eq("_id", mongoIdObj)).first();
        if (doc == null) {
            return createErrorResult("Document not found in " + database + "." + collection);
        }
        
        // Return entire document
        Map<String, Object> result = new HashMap<>();
        result.put("code", 0);
        result.put("data", doc);
        return result;
    }

    /**
     * Soft delete a document using IndexQueue and transactions
     * 
     * @param indexName The mongo-index name
     * @param database Database name
     * @param collection Collection name
     * @param docId The document custom ID
     * @return Result map
     */
    public Map<String, Object> deleteDoc(String indexName, String database, String collection, String docId) {
        Map<String, Object> indexMeta = getIndex(indexName);
        if (indexMeta == null) {
            return createErrorResult("Index not found: " + indexName);
        }

        // Verify collection is part of index
        @SuppressWarnings("unchecked")
        List<Map<String, String>> collections = (List<Map<String, String>>) indexMeta.get("collections");
        boolean isCollectionInIndex = false;
        if (collections != null) {
            for (Map<String, String> collInfo : collections) {
                if (database.equals(collInfo.get("database")) && collection.equals(collInfo.get("collection"))) {
                    isCollectionInIndex = true;
                    break;
                }
            }
        }
        
        if (!isCollectionInIndex) {
            return createErrorResult("Collection " + database + "." + collection + " is not part of index: " + indexName);
        }

        MongoClient client = mongoService.getMongoClient();
        Object mongoIdObj = parseDocId(docId);
        
        // Get IndexQueue entry
        Document queueEntry = indexQueueService.getOrCreateIndexQueueEntry(database, collection, docId, mongoIdObj);
        if (queueEntry == null) {
            return createErrorResult("Document not found in " + database + "." + collection);
        }

        long currentTime = TimeUtils.getCurrentTimestamp();
        int currentTz = TimeUtils.getCurrentTimezoneOffset();
        Long currentVersion = queueEntry.getLong("updateVersion");
        if (currentVersion == null) currentVersion = 0L;
        long newVersion = currentVersion + 1;

        // Start transaction
        ClientSession session = client.startSession();
        try {
            session.startTransaction();
            
            MongoDatabase db = client.getDatabase(database);
            MongoCollection<Document> coll = db.getCollection(collection);
            MongoCollection<Document> indexQueue = indexQueueService.getIndexQueueCollection(database);

            // 1. Delete main document
            coll.deleteOne(session, Filters.eq("_id", mongoIdObj));

            // 2. Update IndexQueue: mark as deleted, increment version, status=-1
            Bson queueFilter = Filters.and(
                Filters.eq("docId", docId),
                // Filters.eq("collection", collection), // docId is unique globally
                Filters.lt("updateVersion", newVersion)
            );
            
            Document queueUpdate = new Document("$set", new Document()
                .append("collection", collection)
                .append("updateVersion", newVersion)
                .append("status", -1)
                .append("updateAt", currentTime)
                .append("updateAtTimeZone", currentTz)
                .append("isDeleted", true)
                .append("mongoId", mongoIdObj.toString())
            );
            
            indexQueue.updateOne(session, queueFilter, queueUpdate, new UpdateOptions().upsert(true));

            // Commit transaction
            session.commitTransaction();
            
            // Trigger async ES deletion
            final long deleteVersion = newVersion;
            final String esIndexName = (String) indexMeta.get("esIndex");
            CompletableFuture.runAsync(() -> {
                try {
                    deleteFromIndex(indexName, docId, deleteVersion);
                    
                    // Acquire lock before marking as deleted in queue
                    String lockKey = "doc-index-lock:" + esIndexName + ":" + docId;
                    RLock asyncLock = redissonClient.getLock(lockKey);
                    boolean asyncLockAcquired = false;
                    
                    try {
                        asyncLockAcquired = asyncLock.tryLock(10, 30, TimeUnit.SECONDS);
                        
                        if (!asyncLockAcquired) {
                            if (CONTINUE_ON_LOCK_FAILURE) {
                                System.err.println("Warning: Could not acquire lock for marking deleted: " + docId);
                            } else {
                                throw new RuntimeException("Failed to acquire lock for marking deleted: " + docId);
                            }
                        }
                        
                        // Re-check queue entry version to ensure no update happened during deletion
                        MongoCollection<Document> asyncQueue = indexQueueService.getIndexQueueCollection(database);
                        Document currentQueueEntry = asyncQueue.find(Filters.eq("docId", docId)).first();
                        
                        if (currentQueueEntry == null) {
                            System.err.println("Warning: IndexQueue entry disappeared for doc " + docId);
                            return;
                        }
                        
                        Long reCheckedVersion = currentQueueEntry.getLong("updateVersion");
                        if (reCheckedVersion == null) {
                            reCheckedVersion = 0L;
                        }
                        
                        // Only mark as indexed if version matches
                        if (reCheckedVersion.equals(deleteVersion)) {
                            asyncQueue.updateOne(
                                Filters.eq("docId", docId),
                                Updates.combine(
                                    Updates.set("status", 0),
                                    Updates.set("indexVersion", deleteVersion)
                                )
                            );
                            System.out.println("Marked doc " + docId + " as deleted in ES (version " + deleteVersion + ")");
                        } else if (reCheckedVersion > deleteVersion) {
                            System.out.println("Doc " + docId + " was updated during deletion (current: " + reCheckedVersion + 
                                ", deleted: " + deleteVersion + "). Skipping status update - newer version needs indexing.");
                        }
                        
                    } catch (Exception lockEx) {
                        if (CONTINUE_ON_LOCK_FAILURE) {
                            System.err.println("Warning: Lock operation failed during async deletion: " + lockEx.getMessage());
                        } else {
                            throw lockEx;
                        }
                    } finally {
                        if (asyncLockAcquired && asyncLock != null) {
                            try {
                                asyncLock.unlock();
                            } catch (Exception e) {
                                System.err.println("Warning: Failed to release async lock: " + e.getMessage());
                            }
                        }
                    }
                    
                } catch (Exception e) {
                    System.err.println("Failed to delete from ES index: " + e.getMessage());
                }
            });
            
            Map<String, Object> result = new HashMap<>();
            result.put("code", 0);
            result.put("message", "Document deleted successfully");
            result.put("data", Map.of("docId", docId, "updateVersion", newVersion));
            return result;
            
        } catch (Exception e) {
            session.abortTransaction();
            return createErrorResult("Failed to delete document: " + e.getMessage());
        } finally {
            session.close();
        }
    }

    /**
     * Trigger async indexing after document update
     * Indexes the document to ES and marks it as indexed in IndexQueue
     * Uses locking to prevent race conditions with concurrent updates
     */
    private void createIndexAfterUpdateDoc(String indexName, String database, String collection, 
                                           Object mongoIdObj, String docId, long newVersion, long updateTime,
                                           String esIndexName) {
        CompletableFuture.runAsync(() -> {
            try {
                createIndexForDoc(indexName, database, collection, mongoIdObj, updateTime, false);
                
                // Acquire lock before marking as indexed to prevent race condition
                // Use same lock key format as createIndexForDoc
                String lockKey = "doc-index-lock:" + esIndexName + ":" + docId;
                RLock asyncLock = redissonClient.getLock(lockKey);
                boolean asyncLockAcquired = false;
                
                try {
                    asyncLockAcquired = asyncLock.tryLock(10, 30, TimeUnit.SECONDS);
                    
                    if (!asyncLockAcquired) {
                        if (CONTINUE_ON_LOCK_FAILURE) {
                            System.err.println("Warning: Could not acquire lock for marking indexed: " + docId);
                        } else {
                            throw new RuntimeException("Failed to acquire lock for marking indexed: " + docId);
                        }
                    }
                    
                    // Re-check queue entry version to ensure no update happened during indexing
                    MongoCollection<Document> asyncQueue = indexQueueService.getIndexQueueCollection(database);
                    Document currentQueueEntry = asyncQueue.find(Filters.eq("docId", docId)).first();
                    
                    if (currentQueueEntry == null) {
                        System.err.println("Warning: IndexQueue entry disappeared for doc " + docId);
                        return;
                    }
                    
                    Long currentVersion = currentQueueEntry.getLong("updateVersion");
                    if (currentVersion == null) {
                        currentVersion = 0L;
                    }
                    
                    // Only mark as indexed if version matches what we just indexed
                    if (currentVersion.equals(newVersion)) {
                        asyncQueue.updateOne(
                            Filters.eq("docId", docId),
                            Updates.combine(
                                Updates.set("status", 0),
                                Updates.set("indexVersion", newVersion)
                            )
                        );
                        System.out.println("Marked doc " + docId + " as indexed (version " + newVersion + ")");
                    } else if (currentVersion > newVersion) {
                        System.out.println("Doc " + docId + " was updated during indexing (current: " + currentVersion + 
                            ", indexed: " + newVersion + "). Skipping status update - newer version needs indexing.");
                    } else {
                        System.err.println("Warning: Doc " + docId + " queue version (" + currentVersion + 
                            ") is older than indexed version (" + newVersion + "). This should not happen.");
                    }
                    
                } catch (Exception lockEx) {
                    if (CONTINUE_ON_LOCK_FAILURE) {
                        System.err.println("Warning: Lock operation failed during async indexing: " + lockEx.getMessage());
                    } else {
                        throw lockEx;
                    }
                } finally {
                    if (asyncLockAcquired && asyncLock != null) {
                        try {
                            asyncLock.unlock();
                        } catch (Exception e) {
                            System.err.println("Warning: Failed to release async lock: " + e.getMessage());
                        }
                    }
                }
                
            } catch (Exception e) {
                System.err.println("Failed to index document: " + e.getMessage());
            }
        });
    }

    /**
     * Convert string ID to appropriate MongoDB ID type
     * If the string is a valid ObjectId hex string (24 hex chars), convert to ObjectId
     * Otherwise, keep as String
     * 
     * @param idString The ID as string
     * @return ObjectId or String
     */
    private Object parseDocId(String idString) {
        if (idString == null) {
            return null;
        }
        // Check if it's a valid ObjectId (24 hex characters)
        if (idString.matches("^[0-9a-fA-F]{24}$")) {
            return new ObjectId(idString);
        }
        // Otherwise return as string
        return idString;
    }


    /**
     * Index a single document to Elasticsearch
     * Uses IndexQueue for metadata
     * 
     * @param indexName The mongo-index name
     * @param dbName Database name
     * @param collName Collection name
     * @param docId Document ID (can be ObjectId, String, etc.)
     * @param updateAtTimestamp The updateAt timestamp this index represents (unused, kept for compatibility)
     */
    private void createIndexForDoc(String indexName, String dbName, String collName, Object docId, long updateAtTimestamp, boolean forceReindex) {
        // Get index metadata
        Map<String, Object> indexMeta = getIndex(indexName);
        if (indexMeta == null) {
            throw new RuntimeException("Index not found: " + indexName);
        }

        String esIndexName = (String) indexMeta.get("esIndex");

        // Get the document and IndexQueue entry
        MongoClient client = mongoService.getMongoClient();
        MongoDatabase database = client.getDatabase(dbName);
        MongoCollection<Document> collection = database.getCollection(collName);

        Document doc = collection.find(Filters.eq("_id", docId)).first();
        if (doc == null) {
            throw new RuntimeException("Document not found: " + docId);
        }

        // Extract custom id from document (data is at top level now)
        // Fall back to MongoDB _id if no custom "id" field exists
        Object idObj = doc.get("id");
        String customId;
        if (idObj == null || idObj.toString().trim().isEmpty()) {
            // Use MongoDB _id as the document id
            customId = docId.toString();
            System.out.println("Document " + docId + " has no 'id' field, using MongoDB _id as document id");
        } else {
            customId = idObj.toString().trim();
        }

        // Get IndexQueue entry for metadata
        Document queueEntry = indexQueueService.getOrCreateIndexQueueEntry(dbName, collName, customId, docId);
        if (queueEntry == null) {
            throw new RuntimeException("Failed to get IndexQueue entry for document: " + customId);
        }

        // Acquire distributed lock for this document
        String lockKey = "doc-index-lock:" + esIndexName + ":" + customId;
        RLock lock = null;
        boolean lockAcquired = false;
        
        try {
            // Try to get lock and acquire it
            lock = redissonClient.getLock(lockKey);
            lockAcquired = lock.tryLock(10, 30, TimeUnit.SECONDS);
            
            if (!lockAcquired) {
                if (CONTINUE_ON_LOCK_FAILURE) {
                    System.err.println("Warning: Could not acquire lock for document " + customId + ", continuing without lock");
                } else {
                    throw new RuntimeException("Failed to acquire lock for document: " + customId);
                }
            }
        } catch (Exception e) {
            // Redis connection error or other lock-related exception
            if (CONTINUE_ON_LOCK_FAILURE) {
                System.err.println("Warning: Lock acquisition failed for document " + customId + " (Redis may be down), continuing without lock: " + e.getMessage());
                lockAcquired = false;
            } else {
                throw new RuntimeException("Failed to acquire lock: " + e.getMessage(), e);
            }
        }
        
        try {
            // Re-read document and queue entry after acquiring lock
            doc = collection.find(Filters.eq("_id", docId)).first();
            if (doc == null) {
                throw new RuntimeException("Document not found: " + docId);
            }
            
            queueEntry = indexQueueService.getOrCreateIndexQueueEntry(dbName, collName, customId, docId);
            if (queueEntry == null) {
                throw new RuntimeException("Failed to get IndexQueue entry for document: " + customId);
            }
            
            // Read version and timestamp metadata from IndexQueue
            Long docUpdateAt = queueEntry.getLong("updateAt");
            Long docUpdateVersion = queueEntry.getLong("updateVersion");
            Integer docUpdateAtTimeZone = queueEntry.getInteger("updateAtTimeZone");

            if (docUpdateAt == null) {
                docUpdateAt = TimeUtils.getCurrentTimestamp();
            }
            if (docUpdateVersion == null) {
                docUpdateVersion = 0L;
            }

            // Flatten the document for indexing (data is at top level now)
            List<Map<String, String>> flattened = flattenJson(doc, null);

            // Index to Elasticsearch with custom id, version, and metadata
            elasticSearchService.indexDoc(esIndexName, customId, dbName, collName, flattened, 
                                         docUpdateVersion, docUpdateAt, docUpdateAtTimeZone, forceReindex);

            if(CHECK_BEFORE_SETTING_INDEX_VERSION && !forceReindex) {
                // After successful ES indexing, verify queue entry hasn't been updated in the meantime
                // Skip these checks if forceReindex=true (during rebuild)
                MongoCollection<Document> indexQueue = indexQueueService.getIndexQueueCollection(dbName);
                Document currentQueueEntry = indexQueue.find(Filters.eq("docId", customId)).first();
                if (currentQueueEntry == null) {
                    System.err.println("Warning: IndexQueue entry disappeared after ES indexing: " + customId);
                    return;
                }
                
                Long currentUpdateVersion = currentQueueEntry.getLong("updateVersion");
                if (currentUpdateVersion == null) {
                    currentUpdateVersion = 0L;
                }
                
                Long currentIndexVersion = currentQueueEntry.getLong("indexVersion");
                if (currentIndexVersion == null) {
                    currentIndexVersion = 0L;
                }
                
                // Check if document was updated after we read it (race condition detected)
                if (currentUpdateVersion > docUpdateVersion) {
                    System.err.println("Warning: Document " + customId + " was updated during indexing. " +
                        "Original version: " + docUpdateVersion + ", current version: " + currentUpdateVersion + 
                        ". Aborting indexVersion update to avoid overwriting newer version.");
                    return;
                }
                
                // Check if indexVersion has already been set to this version or higher
                if (currentIndexVersion >= docUpdateVersion) {
                    System.err.println("Warning: Document " + customId + " indexVersion already at " + currentIndexVersion + 
                        ", which is >= target version " + docUpdateVersion + 
                        ". Aborting to avoid overwriting or redundant update.");
                    return;
                }
            }

            // Update IndexQueue: set status=0 (indexed) and indexVersion
            MongoCollection<Document> indexQueue = indexQueueService.getIndexQueueCollection(dbName);
            indexQueue.updateOne(
                Filters.eq("docId", customId),
                Updates.combine(
                    Updates.set("status", 0),
                    Updates.set("indexVersion", docUpdateVersion)
                )
            );
        } catch (Exception e) {
            throw new RuntimeException("Failed to index document to Elasticsearch: " + e.getMessage(), e);
        } finally {
            // Release lock if it was acquired
            if (lockAcquired && lock != null) {
                try {
                    lock.unlock();
                } catch (Exception e) {
                    System.err.println("Warning: Failed to release lock: " + e.getMessage());
                }
            }
        }
    }

    /**
     * Flatten JSON content for indexing (similar to Python flatten_json)
     * 
     * @param obj The object to flatten
     * @param prefix Current path prefix
     * @return List of {path, value} maps
     */
    private List<Map<String, String>> flattenJson(Object obj, String prefix) {
        List<Map<String, String>> result = new ArrayList<>();

        if (obj == null) {
            if (prefix != null) {
                Map<String, String> entry = new HashMap<>();
                entry.put("path", prefix);
                entry.put("value", "null");
                result.add(entry);
            }
            return result;
        }

        if (obj instanceof Document) {
            Document doc = (Document) obj;
            for (Map.Entry<String, Object> entry : doc.entrySet()) {
                String newPrefix = prefix == null ? entry.getKey() : prefix + "." + entry.getKey();
                result.addAll(flattenJson(entry.getValue(), newPrefix));
            }
        } else if (obj instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> map = (Map<String, Object>) obj;
            for (Map.Entry<String, Object> entry : map.entrySet()) {
                String newPrefix = prefix == null ? entry.getKey() : prefix + "." + entry.getKey();
                result.addAll(flattenJson(entry.getValue(), newPrefix));
            }
        } else if (obj instanceof List) {
            List<?> list = (List<?>) obj;
            for (int i = 0; i < list.size(); i++) {
                String newPrefix = prefix + "@" + i;
                result.addAll(flattenJson(list.get(i), newPrefix));
            }
        } else {
            // Primitive value
            Map<String, String> entry = new HashMap<>();
            entry.put("path", prefix);
            entry.put("value", obj.toString());
            result.add(entry);
        }

        return result;
    }

    /**
     * Delete a document from Elasticsearch index with version control
     * 
     * @param indexName The mongo-index name
     * @param docId Document ID
     * @param deleteVersion The MongoDB updateVersion at time of deletion (for optimistic concurrency)
     */
    private void deleteFromIndex(String indexName, String docId, long deleteVersion) {
        Map<String, Object> indexMeta = getIndex(indexName);
        if (indexMeta == null) {
            throw new RuntimeException("Index not found: " + indexName);
        }

        String esIndexName = (String) indexMeta.get("esIndex");

        // Delete from Elasticsearch with version control
        try {
            elasticSearchService.deleteDocumentWithVersion(esIndexName, docId, deleteVersion);
        } catch (Exception e) {
            throw new RuntimeException("Failed to delete document from Elasticsearch: " + e.getMessage(), e);
        }
    }

    /**
     * Rebuild index: clear ES index and scan all documents
     * 
     * @param indexName The mongo-index name
     * @param maxDocs Maximum number of documents to index (null for all)
     * @return Result map with statistics
     */
    public Map<String, Object> rebuildIndex(String indexName, Integer maxDocs) {
        // Acquire distributed lock for rebuild to prevent concurrent rebuilds on same index
        String lockKey = "mongo-index-rebuild:" + indexName;
        RLock lock = null;
        boolean lockAcquired = false;
        
        try {
            if (redissonClient != null) {
                lock = redissonClient.getLock(lockKey);
                // Try to acquire lock immediately (0 wait), 600 seconds lease time (10 minutes max)
                lockAcquired = lock.tryLock(0, 600, TimeUnit.SECONDS);
                
                if (!lockAcquired) {
                    return createErrorResult("Another rebuild task is already running for index: " + indexName + ". Please try again later.");
                }
            } else {
                System.err.println("Warning: RedissonClient not available, proceeding without lock");
            }
        } catch (Exception e) {
            System.err.println("Warning: Failed to acquire rebuild lock: " + e.getMessage());
            return createErrorResult("Failed to acquire rebuild lock: " + e.getMessage());
        }
        
        try {
            Map<String, Object> indexMeta = getIndex(indexName);
            if (indexMeta == null) {
                return createErrorResult("Index not found: " + indexName);
            }

            String esIndexName = (String) indexMeta.get("esIndex");
        
        @SuppressWarnings("unchecked")
        List<Map<String, String>> collections = (List<Map<String, String>>) indexMeta.get("collections");

        // Create or clear ES index
        try {
            elasticSearchService.createOrClearIndex(esIndexName, true);
        } catch (Exception e) {
            return createErrorResult("Failed to clear ES index: " + e.getMessage());
        }

        int totalDocs = 0;
        int indexedDocs = 0;
        List<String> errors = new ArrayList<>();

        // Scan all collections
        for (Map<String, String> collInfo : collections) {
            if (maxDocs != null && indexedDocs >= maxDocs) {
                break; // Already indexed enough documents
            }

            String dbName = collInfo.get("database");
            String collName = collInfo.get("collection");

            MongoClient client = mongoService.getMongoClient();
            MongoDatabase database = client.getDatabase(dbName);
            MongoCollection<Document> collection = database.getCollection(collName);

            // Count total docs
            long count = collection.countDocuments();
            totalDocs += count;

            // Determine how many documents to fetch from this collection
            int remaining = maxDocs != null ? (maxDocs - indexedDocs) : Integer.MAX_VALUE;
            
            // Index each document (with limit if specified)
            FindIterable<Document> cursor = maxDocs != null 
                ? collection.find().limit(remaining)
                : collection.find();
                
            for (Document doc : cursor) {
                try {
                    Object mongoIdObj = doc.get("_id");
                    if (mongoIdObj != null) {
                        String docId = mongoIdObj.toString();
                        
                        // Get or create IndexQueue entry for this document
                        Document queueEntry = indexQueueService.getOrCreateIndexQueueEntry(dbName, collName, docId, mongoIdObj);
                        if (queueEntry == null) {
                            System.err.println("Failed to get/create IndexQueue entry for doc: " + docId);
                            continue;
                        }
                        
                        Long updateAt = queueEntry.getLong("updateAt");
                        if (updateAt == null) {
                            updateAt = TimeUtils.getCurrentTimestamp();
                        }
                        
                        createIndexForDoc(
                            indexName, dbName, collName, mongoIdObj, updateAt,
                            true // forceReindex
                        );
                        indexedDocs++;
                    }
                } catch (Exception e) {
                    String errorMsg = "Failed to index doc " + doc.get("_id") + ": " + e.getMessage();
                    errors.add(errorMsg);
                    System.err.println(errorMsg);
                    e.printStackTrace();
                }
                
                // Double-check we haven't exceeded the limit
                if (maxDocs != null && indexedDocs >= maxDocs) {
                    break;
                }
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("code", 0);
        result.put("message", maxDocs != null 
            ? "Index rebuild completed (limited to " + maxDocs + " docs)" 
            : "Index rebuild completed");
        Map<String, Object> data = new HashMap<>();
        data.put("totalDocs", totalDocs);
        data.put("indexedDocs", indexedDocs);
        data.put("errors", errors);
        result.put("data", data);
        return result;
        
        } finally {
            // Release lock
            if (lockAcquired && lock != null) {
                try {
                    lock.unlock();
                    System.out.println("Released rebuild lock for index: " + indexName);
                } catch (Exception e) {
                    System.err.println("Warning: Failed to release rebuild lock: " + e.getMessage());
                }
            }
        }
    }

    /**
     * Rebuild index for a specific collection only (does not clear other collections from ES)
     * 
     * @param indexName The mongo-index name
     * @param dbName Database name
     * @param collName Collection name
     * @param maxDocs Maximum number of documents to index (null for all)
     * @return Result map with statistics
     */
    public Map<String, Object> rebuildIndexForMongoCollection(String indexName, String dbName, String collName, Integer maxDocs) {
        Map<String, Object> indexMeta = getIndex(indexName);
        if (indexMeta == null) {
            return createErrorResult("Index not found: " + indexName);
        }

        String esIndexName = (String) indexMeta.get("esIndex");
        
        @SuppressWarnings("unchecked")
        List<Map<String, String>> collections = (List<Map<String, String>>) indexMeta.get("collections");

        // Verify collection is part of this index
        boolean found = false;
        for (Map<String, String> collInfo : collections) {
            if (dbName.equals(collInfo.get("database")) && collName.equals(collInfo.get("collection"))) {
                found = true;
                break;
            }
        }
        
        if (!found) {
            return createErrorResult("Collection " + dbName + "." + collName + " is not part of index: " + indexName);
        }

        int indexedDocs = 0;
        List<String> errors = new ArrayList<>();

        try {
            MongoClient client = mongoService.getMongoClient();
            MongoDatabase database = client.getDatabase(dbName);
            MongoCollection<Document> collection = database.getCollection(collName);

            // Count total docs
            long totalDocs = collection.countDocuments();
            
            // Index each document (with limit if specified)
            FindIterable<Document> cursor = maxDocs != null 
                ? collection.find().limit(maxDocs)
                : collection.find();
                
            for (Document doc : cursor) {
                try {
                    Object mongoIdObj = doc.get("_id");
                    if (mongoIdObj != null) {
                        String docId = mongoIdObj.toString();
                        
                        // Get or create IndexQueue entry for this document
                        Document queueEntry = indexQueueService.getOrCreateIndexQueueEntry(dbName, collName, docId, mongoIdObj);
                        if (queueEntry == null) {
                            System.err.println("Failed to get/create IndexQueue entry for doc: " + docId);
                            continue;
                        }
                        
                        Long updateAt = queueEntry.getLong("updateAt");
                        if (updateAt == null) {
                            updateAt = TimeUtils.getCurrentTimestamp();
                        }
                        
                        createIndexForDoc(indexName, dbName, collName, mongoIdObj, updateAt, true);
                        indexedDocs++;
                    }
                } catch (Exception e) {
                    String errorMsg = "Failed to index doc " + doc.get("_id") + ": " + e.getMessage();
                    errors.add(errorMsg);
                    System.err.println(errorMsg);
                    e.printStackTrace();
                }
                
                if (maxDocs != null && indexedDocs >= maxDocs) {
                    break;
                }
            }

            Map<String, Object> result = new HashMap<>();
            result.put("code", 0);
            result.put("message", maxDocs != null 
                ? "Collection rebuild completed (limited to " + maxDocs + " docs)" 
                : "Collection rebuild completed");
            Map<String, Object> data = new HashMap<>();
            data.put("totalDocs", totalDocs);
            data.put("indexedDocs", indexedDocs);
            data.put("errors", errors);
            result.put("data", data);
            return result;
        } catch (Exception e) {
            return createErrorResult("Failed to rebuild collection: " + e.getMessage());
        }
    }

    /**
     * Start async rebuild for a specific collection
     * Returns task ID immediately, actual rebuild happens in background
     */
    public String rebuildIndexForMongoCollectionAsync(String indexName, String dbName, String collName, Integer maxDocs) {
        Map<String, Object> params = new HashMap<>();
        params.put("indexName", indexName);
        params.put("dbName", dbName);
        params.put("collName", collName);
        params.put("maxDocs", maxDocs);
        
        app.pojo.Task task = taskService.createTask("rebuild-collection", params);
        
        // Start async execution using self-injection to ensure @Async proxy works
        self.executeRebuildAsync(task.getTaskId(), indexName, dbName, collName, maxDocs);
        
        return task.getTaskId();
    }
    
    /**
     * Async method that performs the actual rebuild and publishes progress
     */
    @Async("taskExecutor")
    public void executeRebuildAsync(String taskId, String indexName, String dbName, String collName, Integer maxDocs) {
        // Acquire distributed lock for rebuild to prevent concurrent rebuilds on same index
        String lockKey = "mongo-index-rebuild:" + indexName;
        RLock lock = null;
        boolean lockAcquired = false;
        
        try {
            if (redissonClient != null) {
                lock = redissonClient.getLock(lockKey);
                // Try to acquire lock immediately (0 wait), 600 seconds lease time (10 minutes max)
                lockAcquired = lock.tryLock(0, 600, TimeUnit.SECONDS);
                
                if (!lockAcquired) {
                    taskService.failTask(taskId, "Another rebuild task is already running for index: " + indexName + ". Please try again later.");
                    return;
                }
            } else {
                System.err.println("Warning: RedissonClient not available, proceeding without lock");
            }
        } catch (Exception e) {
            System.err.println("Warning: Failed to acquire rebuild lock: " + e.getMessage());
            taskService.failTask(taskId, "Failed to acquire rebuild lock: " + e.getMessage());
            return;
        }
        
        try {
            Map<String, Object> indexMeta = getIndex(indexName);
            if (indexMeta == null) {
                taskService.failTask(taskId, "Index not found: " + indexName);
                return;
            }

            String esIndexName = (String) indexMeta.get("esIndex");
            
            @SuppressWarnings("unchecked")
            List<Map<String, String>> collections = (List<Map<String, String>>) indexMeta.get("collections");

            // Verify collection is part of this index
            boolean found = false;
            for (Map<String, String> collInfo : collections) {
                if (dbName.equals(collInfo.get("database")) && collName.equals(collInfo.get("collection"))) {
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                taskService.failTask(taskId, "Collection " + dbName + "." + collName + " is not part of index: " + indexName);
                return;
            }

            int indexedDocs = 0;

            MongoClient client = mongoService.getMongoClient();
            MongoDatabase database = client.getDatabase(dbName);
            MongoCollection<Document> collection = database.getCollection(collName);

            // Count total docs
            long totalDocs = collection.countDocuments();
            if (maxDocs != null && maxDocs < totalDocs) {
                totalDocs = maxDocs;
            }
            
            // Initialize task progress
            taskService.updateProgress(taskId, (int) totalDocs, 0);
            
            // Index each document (with limit if specified)
            FindIterable<Document> cursor = maxDocs != null 
                ? collection.find().limit(maxDocs)
                : collection.find();
                
            for (Document doc : cursor) {
                try {
                    Object mongoIdObj = doc.get("_id");
                    if (mongoIdObj != null) {
                        String docId = mongoIdObj.toString();
                        
                        // Get or create IndexQueue entry for this document
                        Document queueEntry = indexQueueService.getOrCreateIndexQueueEntry(dbName, collName, docId, mongoIdObj);
                        if (queueEntry == null) {
                            String errorMsg = "Failed to get/create IndexQueue entry for doc: " + docId;
                            taskService.addError(taskId, errorMsg);
                            System.err.println(errorMsg);
                            continue;
                        }
                        
                        Long updateAt = queueEntry.getLong("updateAt");
                        if (updateAt == null) {
                            updateAt = TimeUtils.getCurrentTimestamp();
                        }
                        
                        createIndexForDoc(indexName, dbName, collName, mongoIdObj, updateAt, true);
                        indexedDocs++;
                        
                        // Update progress after each doc for real-time feedback
                        taskService.updateProgress(taskId, (int) totalDocs, indexedDocs);
                    }
                } catch (Exception e) {
                    String errorMsg = "Failed to index doc " + doc.get("_id") + ": " + e.getMessage();
                    taskService.addError(taskId, errorMsg);
                    System.err.println(errorMsg);
                    e.printStackTrace();
                }
                
                if (maxDocs != null && indexedDocs >= maxDocs) {
                    break;
                }
            }

            // Complete task
            Map<String, Object> result = new HashMap<>();
            result.put("totalDocs", totalDocs);
            result.put("indexedDocs", indexedDocs);
            taskService.completeTask(taskId, result);
            
        } catch (Exception e) {
            taskService.failTask(taskId, "Failed to rebuild collection: " + e.getMessage());
            e.printStackTrace();
        } finally {
            // Release lock
            if (lockAcquired && lock != null) {
                try {
                    lock.unlock();
                    System.out.println("Released rebuild lock for index: " + indexName);
                } catch (Exception e) {
                    System.err.println("Warning: Failed to release rebuild lock: " + e.getMessage());
                }
            }
        }
    }

    /**
     * Rebuild index for documents with status=-1 in IndexQueue (needs indexing)
     * Much faster than full rebuild as it only processes changed documents
     * 
     * @param indexName The mongo-index name
     * @param maxDocs Maximum number of documents to index (null for all)
     * @return Result map with statistics
     */
    public Map<String, Object> rebuildIndexForDocsWithOldIndex(String indexName, Integer maxDocs) {
        Map<String, Object> indexMeta = getIndex(indexName);
        if (indexMeta == null) {
            return createErrorResult("Index not found: " + indexName);
        }

        @SuppressWarnings("unchecked")
        List<Map<String, String>> collections = (List<Map<String, String>>) indexMeta.get("collections");

        int totalDocsNeedingReindex = 0;
        int indexedDocs = 0;
        List<String> errors = new ArrayList<>();

        // Scan all databases for IndexQueue entries with status=-1
        for (Map<String, String> collInfo : collections) {
            if (maxDocs != null && indexedDocs >= maxDocs) {
                break;
            }

            String dbName = collInfo.get("database");
            String collName = collInfo.get("collection");

            MongoClient client = mongoService.getMongoClient();
            MongoCollection<Document> indexQueue = indexQueueService.getIndexQueueCollection(dbName);

            // Count docs needing reindex in this collection
            Bson filter = Filters.and(
                Filters.eq("collection", collName),
                Filters.eq("status", -1)
            );
            long count = indexQueue.countDocuments(filter);
            totalDocsNeedingReindex += count;

            // Determine how many documents to fetch
            int remaining = maxDocs != null ? (maxDocs - indexedDocs) : Integer.MAX_VALUE;
            
            // Query IndexQueue for docs needing indexing
            FindIterable<Document> cursor = maxDocs != null 
                ? indexQueue.find(filter).sort(new Document("updateVersion", 1)).limit(remaining)
                : indexQueue.find(filter).sort(new Document("updateVersion", 1));
                
            for (Document queueEntry : cursor) {
                try {
                    String docId = queueEntry.getString("docId");
                    String mongoIdStr = queueEntry.getString("mongoId");
                    
                    if (docId != null && mongoIdStr != null) {
                        Object mongoId = parseDocId(mongoIdStr);
                        Long updateAt = queueEntry.getLong("updateAt");
                        if (updateAt == null) {
                            updateAt = TimeUtils.getCurrentTimestamp();
                        }
                        
                        createIndexForDoc(indexName, dbName, collName, mongoId, updateAt, true);
                        indexedDocs++;
                    }
                } catch (Exception e) {
                    String errorMsg = "Failed to index doc " + queueEntry.getString("docId") + ": " + e.getMessage();
                    errors.add(errorMsg);
                    System.err.println(errorMsg);
                    e.printStackTrace();
                }
                
                if (maxDocs != null && indexedDocs >= maxDocs) {
                    break;
                }
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("code", 0);
        result.put("message", maxDocs != null 
            ? "Incremental index rebuild completed (limited to " + maxDocs + " docs)" 
            : "Incremental index rebuild completed");
        Map<String, Object> data = new HashMap<>();
        data.put("totalDocsNeedingReindex", totalDocsNeedingReindex);
        data.put("indexedDocs", indexedDocs);
        data.put("errors", errors);
        result.put("data", data);
        return result;
    }

    /**
     * Get statistics for an index
     * 
     * @param indexName The mongo-index name
     * @return Result map with statistics
     */
    /**
     * Get stats for a single collection within an index
     */
    public Map<String, Object> getCollectionStats(String indexName, String dbName, String collName) {
        Map<String, Object> indexMeta = getIndex(indexName);
        if (indexMeta == null) {
            return createErrorResult("Index not found: " + indexName);
        }

        String esIndexName = (String) indexMeta.get("esIndex");

        MongoClient client = mongoService.getMongoClient();
        MongoDatabase database = client.getDatabase(dbName);
        MongoCollection<Document> collection = database.getCollection(collName);

        long count = collection.countDocuments();

        // Count indexed documents in ES for this collection
        long indexedCount = 0;
        try {
            indexedCount = elasticSearchService.countDocNumBySource(esIndexName, dbName, collName);
        } catch (Exception e) {
            System.err.println("Failed to count indexed docs for " + dbName + "." + collName + ": " + e.getMessage());
        }

        Map<String, Object> result = new HashMap<>();
        result.put("code", 0);
        result.put("message", "Success");
        Map<String, Object> data = new HashMap<>();
        data.put("database", dbName);
        data.put("collection", collName);
        data.put("docCount", count);
        data.put("indexedDocCount", indexedCount);
        result.put("data", data);
        
        return result;
    }

    public Map<String, Object> getIndexStats(String indexName) {
        Map<String, Object> indexMeta = getIndex(indexName);
        if (indexMeta == null) {
            return createErrorResult("Index not found: " + indexName);
        }

        String esIndexName = (String) indexMeta.get("esIndex");
        
        @SuppressWarnings("unchecked")
        List<Map<String, String>> collections = (List<Map<String, String>>) indexMeta.get("collections");

        List<Map<String, Object>> collectionStats = new ArrayList<>();
        long totalDocs = 0;

        for (Map<String, String> collInfo : collections) {
            String dbName = collInfo.get("database");
            String collName = collInfo.get("collection");

            MongoClient client = mongoService.getMongoClient();
            MongoDatabase database = client.getDatabase(dbName);
            MongoCollection<Document> collection = database.getCollection(collName);

            long count = collection.countDocuments();
            totalDocs += count;

            // Count indexed documents in ES for this collection
            long indexedCount = 0;
            try {
                indexedCount = elasticSearchService.countDocNumBySource(esIndexName, dbName, collName);
            } catch (Exception e) {
                System.err.println("Failed to count indexed docs for " + dbName + "." + collName + ": " + e.getMessage());
            }

            Map<String, Object> stat = new HashMap<>();
            stat.put("database", dbName);
            stat.put("collection", collName);
            stat.put("docCount", count);
            stat.put("indexedDocCount", indexedCount);
            collectionStats.add(stat);
        }

        // Get ES index doc count
        long esDocCount = 0;
        try {
            esDocCount = elasticSearchService.getDocumentCount(esIndexName);
        } catch (Exception e) {
            System.err.println("Failed to get ES doc count: " + e.getMessage());
            // Continue with esDocCount = 0
        }

        Map<String, Object> result = new HashMap<>();
        result.put("code", 0);
        Map<String, Object> data = new HashMap<>();
        data.put("indexName", indexName);
        data.put("esIndexName", esIndexName);
        data.put("totalMongoDocsCount", totalDocs);
        data.put("esDocsCount", esDocCount);
        data.put("collections", collectionStats);
        result.put("data", data);
        return result;
    }

    /**
     * Helper to create error result
     */
    private Map<String, Object> createErrorResult(String message) {
        Map<String, Object> result = new HashMap<>();
        result.put("code", -1);
        result.put("message", message);
        return result;
    }
}

