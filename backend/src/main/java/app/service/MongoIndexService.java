package app.service;

import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Updates;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.bson.types.ObjectId;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
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

    @Autowired(required = false)
    @org.springframework.context.annotation.Lazy
    private RedissonClient redissonClient;

    private static final String METADATA_COLLECTION = "mongo-index";
    
    // If true, continue execution even if distributed lock cannot be acquired (e.g., Redis is down)
    private static final boolean CONTINUE_ON_LOCK_FAILURE = true;
    private static final boolean CHECK_BEFORE_SETTING_INDEX_VERSION = true;

    /**
     * Get the metadata collection, creating it if necessary
     */
    private MongoCollection<Document> getMetadataCollection() {
        MongoClient client = mongoService.getMongoClient();
        if (client == null) {
            throw new RuntimeException("MongoDB client not initialized");
        }

        String databaseName = mongoService.getCurrentConfig() != null 
            ? mongoService.getCurrentConfig().getDatabase()
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
        
        return deletedCount > 0;
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
     * Get current timestamp in milliseconds
     */
    private long getCurrentTimestamp() {
        return System.currentTimeMillis();
    }

    /**
     * Get current timezone offset (-12 to +12)
     */
    private int getCurrentTimezoneOffset() {
        ZonedDateTime now = ZonedDateTime.now(ZoneId.systemDefault());
        return now.getOffset().getTotalSeconds() / 3600;
    }

    /**
     * Update a document with metadata management
     * 
     * @param indexName The mongo-index name
     * @param docId The document ID
     * @param updateDict Map of field paths to update (paths will be prefixed with "content.")
     * @param updateIndex Whether to trigger index update (default true)
     * @return Result map with code, message, and data
     */
    public Map<String, Object> updateDoc(String indexName, String docId, Map<String, Object> updateDict, boolean updateIndex) {
        // Get index metadata
        Map<String, Object> indexMeta = getIndex(indexName);
        if (indexMeta == null) {
            return createErrorResult("Index not found: " + indexName);
        }

        @SuppressWarnings("unchecked")
        List<Map<String, String>> collections = (List<Map<String, String>>) indexMeta.get("collections");
        
        if (collections == null || collections.isEmpty()) {
            return createErrorResult("No collections configured for index: " + indexName);
        }

        // Update each collection (assuming docId is unique across collections)
        boolean anyUpdated = false;
        long currentTime = getCurrentTimestamp();
        int currentTz = getCurrentTimezoneOffset();
        
        // Convert docId string to appropriate type (ObjectId or String)
        Object docIdObj = parseDocId(docId);

        for (Map<String, String> collInfo : collections) {
            String dbName = collInfo.get("database");
            String collName = collInfo.get("collection");

            MongoClient client = mongoService.getMongoClient();
            MongoDatabase database = client.getDatabase(dbName);
            MongoCollection<Document> collection = database.getCollection(collName);

            // Find the document first to get custom ID for lock
            Document doc = collection.find(Filters.eq("_id", docIdObj)).first();
            if (doc == null) {
                continue; // Try next collection
            }

            // Extract custom id from content for lock
            Object content = doc.get("content");
            String customId = null;
            if (content instanceof Document) {
                Object idObj = ((Document) content).get("id");
                if (idObj != null) {
                    customId = idObj.toString();
                }
            } else if (content instanceof Map) {
                Object idObj = ((Map<?, ?>) content).get("id");
                if (idObj != null) {
                    customId = idObj.toString();
                }
            }

            if (customId == null || customId.trim().isEmpty()) {
                return createErrorResult("Document missing custom id field in content: MongoDB _id=" + docId);
            }

            String esIndexName = (String) indexMeta.get("esIndex");
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
                        return createErrorResult("Failed to acquire lock for document: " + customId);
                    }
                }
            } catch (Exception e) {
                // Redis connection error or other lock-related exception
                if (CONTINUE_ON_LOCK_FAILURE) {
                    System.err.println("Warning: Lock acquisition failed for document " + customId + " (Redis may be down), continuing without lock: " + e.getMessage());
                    lockAcquired = false;
                } else {
                    return createErrorResult("Failed to acquire lock: " + e.getMessage());
                }
            }
            
            try {
                // Prepare update operations
                List<Bson> updates = new ArrayList<>();

                // Add content.* field updates
                for (Map.Entry<String, Object> entry : updateDict.entrySet()) {
                    updates.add(Updates.set("content." + entry.getKey(), entry.getValue()));
                }

                // Update metadata
                updates.add(Updates.set("updateAt", currentTime));
                updates.add(Updates.set("updateAtTimeZone", currentTz));
                
                // Mark document as needing index update
                updates.add(Updates.set("shouldUpdateIndex", true));

                // Increment or initialize updateVersion
                Long currentVersion = doc.getLong("updateVersion");
                if (currentVersion == null) {
                    updates.add(Updates.set("updateVersion", 1L));
                } else {
                    updates.add(Updates.set("updateVersion", currentVersion + 1));
                }

                // Initialize createAt if not exists (-1 means unknown)
                if (doc.get("createAt") == null) {
                    updates.add(Updates.set("createAt", -1L));
                    updates.add(Updates.set("createAtTimeZone", -1));
                } else {
                    // If createAt exists but createAtTimeZone is missing, set to -1 (unknown)
                    if (doc.get("createAtTimeZone") == null) {
                        updates.add(Updates.set("createAtTimeZone", -1));
                    }
                }
                
                // Initialize content if not exists (empty object)
                if (doc.get("content") == null) {
                    updates.add(Updates.set("content", new Document()));
                }

                // Perform update
                collection.updateOne(Filters.eq("_id", docIdObj), Updates.combine(updates));
                anyUpdated = true;

                // Trigger index update asynchronously if requested
                if (updateIndex) {
                    CompletableFuture.runAsync(() -> {
                        try {
                            // Metadata should already be initialized by updateDoc, but ensure it
                            MongoClient asyncClient = mongoService.getMongoClient();
                            MongoDatabase asyncDatabase = asyncClient.getDatabase(dbName);
                            MongoCollection<Document> asyncCollection = asyncDatabase.getCollection(collName);
                            ensureDocMetadata(asyncCollection, docIdObj, currentTime);
                            
                            createIndexForDoc(indexName, dbName, collName, docIdObj, currentTime);
                        } catch (Exception e) {
                            System.err.println("Failed to index document: " + e.getMessage());
                        }
                    });
                }
            } catch (Exception e) {
                return createErrorResult("Failed to update document: " + e.getMessage());
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

            break; // Document found and updated
        }

        if (!anyUpdated) {
            return createErrorResult("Document not found. _id: " + docId);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("code", 0);
        result.put("message", "Document updated successfully");
        result.put("data", Map.of("docId", docId, "updateAt", currentTime));
        return result;
    }

    /**
     * Get a document (returns only the content)
     * 
     * @param indexName The mongo-index name
     * @param docId The document ID
     * @return Result map with code, message, and data (content only)
     */
    public Map<String, Object> getDoc(String indexName, String docId) {
        Map<String, Object> indexMeta = getIndex(indexName);
        if (indexMeta == null) {
            return createErrorResult("Index not found: " + indexName);
        }

        @SuppressWarnings("unchecked")
        List<Map<String, String>> collections = (List<Map<String, String>>) indexMeta.get("collections");
        
        // Convert docId string to appropriate type (ObjectId or String)
        Object docIdObj = parseDocId(docId);

        for (Map<String, String> collInfo : collections) {
            String dbName = collInfo.get("database");
            String collName = collInfo.get("collection");

            MongoClient client = mongoService.getMongoClient();
            MongoDatabase database = client.getDatabase(dbName);
            MongoCollection<Document> collection = database.getCollection(collName);

            Document doc = collection.find(Filters.eq("_id", docIdObj)).first();
            if (doc != null) {
                Object content = doc.get("content");
                Map<String, Object> result = new HashMap<>();
                result.put("code", 0);
                result.put("data", content != null ? content : new Document());
                return result;
            }
        }

        return createErrorResult("Document not found: " + docId);
    }

    /**
     * Soft delete a document
     * 
     * @param indexName The mongo-index name
     * @param docId The document ID
     * @return Result map
     */
    public Map<String, Object> deleteDoc(String indexName, String docId) {
        Map<String, Object> indexMeta = getIndex(indexName);
        if (indexMeta == null) {
            return createErrorResult("Index not found: " + indexName);
        }

        @SuppressWarnings("unchecked")
        List<Map<String, String>> collections = (List<Map<String, String>>) indexMeta.get("collections");

        boolean anyUpdated = false;
        long currentTime = getCurrentTimestamp();
        
        // Convert docId string to appropriate type (ObjectId or String)
        Object docIdObj = parseDocId(docId);

        for (Map<String, String> collInfo : collections) {
            String dbName = collInfo.get("database");
            String collName = collInfo.get("collection");

            MongoClient client = mongoService.getMongoClient();
            MongoDatabase database = client.getDatabase(dbName);
            MongoCollection<Document> collection = database.getCollection(collName);

            Document doc = collection.find(Filters.eq("_id", docIdObj)).first();
            if (doc != null) {
                // Prepare updates for soft delete
                List<Bson> deleteUpdates = new ArrayList<>();
                deleteUpdates.add(Updates.set("isDeleted", true));
                deleteUpdates.add(Updates.set("isIndexDeleted", false));
                deleteUpdates.add(Updates.set("updateAt", currentTime));
                deleteUpdates.add(Updates.set("updateAtTimeZone", getCurrentTimezoneOffset()));
                
                // Initialize createAt if missing (-1 means unknown)
                if (doc.get("createAt") == null) {
                    deleteUpdates.add(Updates.set("createAt", -1L));
                    deleteUpdates.add(Updates.set("createAtTimeZone", -1));
                } else {
                    // If createAt exists but createAtTimeZone is missing, set to -1 (unknown)
                    if (doc.get("createAtTimeZone") == null) {
                        deleteUpdates.add(Updates.set("createAtTimeZone", -1));
                    }
                }
                
                // Initialize updateVersion if missing
                Long currentVersion = doc.getLong("updateVersion");
                if (currentVersion == null) {
                    deleteUpdates.add(Updates.set("updateVersion", 1L));
                } else {
                    deleteUpdates.add(Updates.set("updateVersion", currentVersion + 1));
                }
                
                // Set soft delete flags
                collection.updateOne(
                    Filters.eq("_id", docIdObj),
                    Updates.combine(deleteUpdates)
                );
                anyUpdated = true;

                // Trigger index deletion asynchronously
                CompletableFuture.runAsync(() -> {
                    try {
                        deleteFromIndex(indexName, docId);
                        // Mark as index-deleted
                        collection.updateOne(
                            Filters.eq("_id", docIdObj),
                            Updates.set("isIndexDeleted", true)
                        );
                        // If both flags are true, actually delete
                        collection.deleteOne(
                            Filters.and(
                                Filters.eq("_id", docIdObj),
                                Filters.eq("isDeleted", true),
                                Filters.eq("isIndexDeleted", true)
                            )
                        );
                    } catch (Exception e) {
                        System.err.println("Failed to delete from index: " + e.getMessage());
                    }
                });

                break;
            }
        }

        if (!anyUpdated) {
            return createErrorResult("Document not found: " + docId);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("code", 0);
        result.put("message", "Document marked for deletion");
        return result;
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
     * Ensure document has all required metadata fields initialized
     * 
     * @param collection MongoDB collection
     * @param docId Document ID
     * @param updateAtTimestamp The updateAt timestamp to use if initializing (if null, uses current time)
     */
    private void ensureDocMetadata(MongoCollection<Document> collection, Object docId, Long updateAtTimestamp) {
        Document doc = collection.find(Filters.eq("_id", docId)).first();
        if (doc == null) {
            throw new RuntimeException("Document not found: " + docId);
        }

        List<Bson> metadataUpdates = new ArrayList<>();
        boolean needsMetadataUpdate = false;
        
        long currentTime = getCurrentTimestamp();
        int currentTz = getCurrentTimezoneOffset();
        
        // Initialize createAt if missing (-1 means unknown)
        if (doc.get("createAt") == null) {
            metadataUpdates.add(Updates.set("createAt", -1L));
            metadataUpdates.add(Updates.set("createAtTimeZone", -1));
            needsMetadataUpdate = true;
        } else {
            // If createAt exists but createAtTimeZone is missing, set to -1 (unknown)
            if (doc.get("createAtTimeZone") == null) {
                metadataUpdates.add(Updates.set("createAtTimeZone", -1));
                needsMetadataUpdate = true;
            }
        }
        
        // Initialize updateAt if missing
        if (doc.get("updateAt") == null) {
            long updateAt = (updateAtTimestamp != null) ? updateAtTimestamp : currentTime;
            metadataUpdates.add(Updates.set("updateAt", updateAt));
            metadataUpdates.add(Updates.set("updateAtTimeZone", currentTz));
            needsMetadataUpdate = true;
        } else {
            // If updateAt exists but updateAtTimeZone is missing, set to -1 (unknown)
            if (doc.get("updateAtTimeZone") == null) {
                metadataUpdates.add(Updates.set("updateAtTimeZone", -1));
                needsMetadataUpdate = true;
            }
        }
        
        // Initialize updateVersion if missing
        if (doc.get("updateVersion") == null) {
            metadataUpdates.add(Updates.set("updateVersion", 0L));
            needsMetadataUpdate = true;
        }
        
        // Initialize content if missing (empty object)
        if (doc.get("content") == null) {
            metadataUpdates.add(Updates.set("content", new Document()));
            needsMetadataUpdate = true;
        }
        
        // Initialize shouldUpdateIndex if missing (default to true for migrated docs)
        if (doc.get("shouldUpdateIndex") == null) {
            metadataUpdates.add(Updates.set("shouldUpdateIndex", true));
            needsMetadataUpdate = true;
        }
        
        // Apply metadata updates if needed
        if (needsMetadataUpdate) {
            collection.updateOne(Filters.eq("_id", docId), Updates.combine(metadataUpdates));
        }
    }

    /**
     * Index a single document to Elasticsearch
     * Assumes document metadata is already initialized
     * 
     * @param indexName The mongo-index name
     * @param dbName Database name
     * @param collName Collection name
     * @param docId Document ID (can be ObjectId, String, etc.)
     * @param updateAtTimestamp The updateAt timestamp this index represents (unused, kept for compatibility)
     */
    private void createIndexForDoc(String indexName, String dbName, String collName, Object docId, long updateAtTimestamp) {
        // Get index metadata
        Map<String, Object> indexMeta = getIndex(indexName);
        if (indexMeta == null) {
            throw new RuntimeException("Index not found: " + indexName);
        }

        String esIndexName = (String) indexMeta.get("esIndex");

        // Get the document
        MongoClient client = mongoService.getMongoClient();
        MongoDatabase database = client.getDatabase(dbName);
        MongoCollection<Document> collection = database.getCollection(collName);

        // Metadata should already be initialized by caller
        Document doc = collection.find(Filters.eq("_id", docId)).first();
        if (doc == null) {
            throw new RuntimeException("Document not found: " + docId);
        }

        Object content = doc.get("content");
        if (content == null) {
            content = new Document(); // Fallback (should not happen after above initialization)
        }

        // Extract custom id from content
        String customId = null;
        if (content instanceof Document) {
            Object idObj = ((Document) content).get("id");
            if (idObj != null) {
                customId = idObj.toString();
            }
        } else if (content instanceof Map) {
            Object idObj = ((Map<?, ?>) content).get("id");
            if (idObj != null) {
                customId = idObj.toString();
            }
        }

        if (customId == null || customId.trim().isEmpty()) {
            throw new RuntimeException("Document missing custom id field in content: MongoDB _id=" + docId);
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
            // Re-read document after acquiring lock (or not) to get latest version
            doc = collection.find(Filters.eq("_id", docId)).first();
            if (doc == null) {
                throw new RuntimeException("Document not found: " + docId);
            }
            
            // Read version and timestamp metadata
            Long docUpdateAt = doc.getLong("updateAt");
            if (docUpdateAt == null) {
                // Initialize updateAt if missing (e.g., migrated documents)
                docUpdateAt = getCurrentTimestamp();
                collection.updateOne(
                    Filters.eq("_id", docId),
                    Updates.set("updateAt", docUpdateAt)
                );
            }

            Long docUpdateVersion = doc.getLong("updateVersion");
            if (docUpdateVersion == null) {
                // Initialize updateVersion if missing (e.g., migrated documents)
                docUpdateVersion = 0L;
                collection.updateOne(
                    Filters.eq("_id", docId),
                    Updates.set("updateVersion", docUpdateVersion)
                );
            }

            Integer docUpdateAtTimeZone = doc.getInteger("updateAtTimeZone");

            // Re-read content
            content = doc.get("content");
            if (content == null) {
                content = new Document();
            }

            // Flatten the content for indexing
            List<Map<String, String>> flattened = flattenJson(content, null);

            // Index to Elasticsearch with custom id, version, and metadata
            elasticSearchService.indexDoc(esIndexName, customId, dbName, collName, flattened, 
                                         docUpdateVersion, docUpdateAt, docUpdateAtTimeZone);

            if(CHECK_BEFORE_SETTING_INDEX_VERSION) {
                // After successful ES indexing, verify MongoDB doc hasn't been updated in the meantime
                Document currentDoc = collection.find(Filters.eq("_id", docId)).first();
                if (currentDoc == null) {
                    System.err.println("Warning: Document disappeared after ES indexing: " + docId);
                    return;
                }
                
                Long currentUpdateVersion = currentDoc.getLong("updateVersion");
                if (currentUpdateVersion == null) {
                    currentUpdateVersion = 0L;
                }
                
                Long currentIndexVersion = currentDoc.getLong("indexVersion");
                if (currentIndexVersion == null) {
                    currentIndexVersion = 0L;
                }
                
                // Check if document was updated after we read it (race condition detected)
                if (currentUpdateVersion > docUpdateVersion) {
                    System.err.println("Warning: Document " + docId + " was updated during indexing. " +
                        "Original version: " + docUpdateVersion + ", current version: " + currentUpdateVersion + 
                        ". Aborting indexVersion update to avoid overwriting newer version.");
                    return;
                }
                
                // Check if indexVersion has already been set to this version or higher
                // (another process may have already indexed this version or a newer one)
                if (currentIndexVersion >= docUpdateVersion) {
                    System.err.println("Warning: Document " + docId + " indexVersion already at " + currentIndexVersion + 
                        ", which is >= target version " + docUpdateVersion + 
                        ". Aborting to avoid overwriting or redundant update.");
                    return;
                }
            }

            // Set indexVersion and indexAt (auxiliary) to match the version we just indexed
            // Clear shouldUpdateIndex flag since indexing is complete
            List<Bson> updates = new ArrayList<>();
            updates.add(Updates.set("indexVersion", docUpdateVersion));
            updates.add(Updates.set("indexAt", docUpdateAt));
            updates.add(Updates.set("shouldUpdateIndex", false));
            collection.updateOne(
                Filters.eq("_id", docId),
                Updates.combine(updates)
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
     * Delete a document from Elasticsearch index
     * 
     * @param indexName The mongo-index name
     * @param docId Document ID
     */
    private void deleteFromIndex(String indexName, String docId) {
        Map<String, Object> indexMeta = getIndex(indexName);
        if (indexMeta == null) {
            throw new RuntimeException("Index not found: " + indexName);
        }

        String esIndexName = (String) indexMeta.get("esIndex");

        // Delete from Elasticsearch
        try {
            elasticSearchService.deleteDocument(esIndexName, docId);
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
                    Object docId = doc.get("_id");
                    if (docId != null) {
                        // Ensure document has all required metadata
                        Long existingUpdateAt = doc.getLong("updateAt");
                        ensureDocMetadata(collection, docId, existingUpdateAt);
                        
                        // Now fetch the updateAt (guaranteed to exist after ensureDocMetadata)
                        doc = collection.find(Filters.eq("_id", docId)).first();
                        if (doc == null) {
                            throw new RuntimeException("Document disappeared: " + docId);
                        }
                        
                        Long updateAt = doc.getLong("updateAt");
                        if (updateAt == null) {
                            throw new RuntimeException("updateAt is null after initialization for doc: " + docId);
                        }
                        
                        createIndexForDoc(indexName, dbName, collName, docId, updateAt);
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
    }

    /**
     * Rebuild index for documents marked with shouldUpdateIndex=true
     * Much faster than full rebuild as it only processes documents needing reindex
     * 
     * @param indexName The mongo-index name
     * @param maxDocs Maximum number of documents to index (null for all)
     * @return Result map with statistics
     */
    public Map<String, Object> rebuildIndexOnShouldUpdateIndex(String indexName, Integer maxDocs) {
        Map<String, Object> indexMeta = getIndex(indexName);
        if (indexMeta == null) {
            return createErrorResult("Index not found: " + indexName);
        }

        @SuppressWarnings("unchecked")
        List<Map<String, String>> collections = (List<Map<String, String>>) indexMeta.get("collections");

        int totalDocsNeedingReindex = 0;
        int indexedDocs = 0;
        List<String> errors = new ArrayList<>();

        // Scan all collections for documents with shouldUpdateIndex=true
        for (Map<String, String> collInfo : collections) {
            if (maxDocs != null && indexedDocs >= maxDocs) {
                break; // Already indexed enough documents
            }

            String dbName = collInfo.get("database");
            String collName = collInfo.get("collection");

            MongoClient client = mongoService.getMongoClient();
            MongoDatabase database = client.getDatabase(dbName);
            MongoCollection<Document> collection = database.getCollection(collName);

            // Ensure index on shouldUpdateIndex field exists for fast query
            try {
                collection.createIndex(new Document("shouldUpdateIndex", 1));
            } catch (Exception e) {
                System.err.println("Warning: Could not create index on shouldUpdateIndex: " + e.getMessage());
            }

            // Count docs needing reindex
            Bson filter = Filters.eq("shouldUpdateIndex", true);
            long count = collection.countDocuments(filter);
            totalDocsNeedingReindex += count;

            // Determine how many documents to fetch from this collection
            int remaining = maxDocs != null ? (maxDocs - indexedDocs) : Integer.MAX_VALUE;
            
            // Query only documents with shouldUpdateIndex=true (with limit if specified)
            FindIterable<Document> cursor = maxDocs != null 
                ? collection.find(filter).limit(remaining)
                : collection.find(filter);
                
            for (Document doc : cursor) {
                try {
                    Object docId = doc.get("_id");
                    if (docId != null) {
                        // Ensure document has all required metadata
                        Long existingUpdateAt = doc.getLong("updateAt");
                        ensureDocMetadata(collection, docId, existingUpdateAt);
                        
                        // Now fetch the updateAt (guaranteed to exist after ensureDocMetadata)
                        doc = collection.find(Filters.eq("_id", docId)).first();
                        if (doc == null) {
                            throw new RuntimeException("Document disappeared: " + docId);
                        }
                        
                        Long updateAt = doc.getLong("updateAt");
                        if (updateAt == null) {
                            throw new RuntimeException("updateAt is null after initialization for doc: " + docId);
                        }
                        
                        createIndexForDoc(indexName, dbName, collName, docId, updateAt);
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

            Map<String, Object> stat = new HashMap<>();
            stat.put("database", dbName);
            stat.put("collection", collName);
            stat.put("docCount", count);
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

