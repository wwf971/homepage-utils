package app.service;

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

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Service for managing __IndexQueue__ collections
 * IndexQueue stores document metadata and indexing status
 */
@Service
public class MongoIndexQueueService {

    @Autowired
    private MongoService mongoService;

    private static final String INDEX_QUEUE_COLLECTION = "__IndexQueue__";

    /**
     * Get the IndexQueue collection for a specific database
     * MongoDB auto-creates collections, so this always succeeds
     */
    public MongoCollection<Document> getIndexQueueCollection(String databaseName) {
        MongoClient client = mongoService.getMongoClient();
        if (client == null) {
            throw new RuntimeException("MongoDB client not initialized");
        }

        MongoDatabase database = client.getDatabase(databaseName);
        return database.getCollection(INDEX_QUEUE_COLLECTION);
    }

    /**
     * Get or create IndexQueue entry for a document
     * Returns null if entry doesn't exist and document doesn't exist
     */
    public Document getOrCreateIndexQueueEntry(String database, String collection, String docId, Object mongoIdObj) {
        MongoCollection<Document> indexQueue = getIndexQueueCollection(database);
        
        // Try to find existing entry
        Document queueEntry = indexQueue.find(
            Filters.eq("docId", docId)
            // Filters.eq("collection", collection) // docId is unique globally
        ).first();
        
        if (queueEntry != null) {
            return queueEntry;
        }
        
        // Entry doesn't exist - check if document exists in main collection
        MongoClient client = mongoService.getMongoClient();
        MongoDatabase db = client.getDatabase(database);
        MongoCollection<Document> coll = db.getCollection(collection);
        
        // First try to find by custom 'id' field (used by MongoAppService)
        Document mainDoc = coll.find(Filters.eq("id", docId)).first();
        if (mainDoc == null) {
            return null; // Document doesn't exist
        }
        
        // Create new queue entry with default values
        long now = TimeUtils.getCurrentTimestamp();
        int tz = TimeUtils.getCurrentTimezoneOffset();
        
        Document newEntry = new Document()
            .append("docId", docId)
            .append("collection", collection)
            .append("mongoId", mongoIdObj.toString())
            .append("updateVersion", 0L)
            .append("indexVersion", 0L)
            .append("status", -1)  // needs indexing
            .append("createAt", now)
            .append("createAtTimeZone", tz)
            .append("updateAt", now)
            .append("updateAtTimeZone", tz)
            .append("isDeleted", false);
        
        try {
            indexQueue.insertOne(newEntry);
            return newEntry;
        } catch (com.mongodb.MongoWriteException e) {
            // Race condition - another thread created it
            return indexQueue.find(Filters.eq("docId", docId)).first();
        }
    }

    /**
     * Check if compound index on (status, updateVersion) exists in IndexQueue
     */
    public boolean indexQueueIndexExists(String database) {
        try {
            MongoCollection<Document> indexQueue = getIndexQueueCollection(database);
            
            for (Document index : indexQueue.listIndexes()) {
                Document key = (Document) index.get("key");
                if (key != null && 
                    key.containsKey("status") && 
                    key.containsKey("updateVersion")) {
                    return true;
                }
            }
            return false;
        } catch (Exception e) {
            System.err.println("Failed to check index existence: " + e.getMessage());
            return false;
        }
    }

    /**
     * Create compound index on (status, updateVersion) in IndexQueue
     * This optimizes queries for finding pending documents
     */
    public Map<String, Object> createIndexQueueIndex(String database) {
        try {
            MongoCollection<Document> indexQueue = getIndexQueueCollection(database);
            
            // Check if index already exists
            if (indexQueueIndexExists(database)) {
                Map<String, Object> result = new HashMap<>();
                result.put("code", 0);
                result.put("message", "Index already exists");
                result.put("data", Map.of("database", database, "exists", true));
                return result;
            }
            
            // Create compound index: (status, updateVersion)
            IndexOptions options = new IndexOptions()
                .name("status_updateVersion_idx")
                .background(false);
            
            String indexName = indexQueue.createIndex(
                Indexes.compoundIndex(
                    Indexes.ascending("status"),
                    Indexes.ascending("updateVersion")
                ),
                options
            );
            
            Map<String, Object> result = new HashMap<>();
            result.put("code", 0);
            result.put("message", "Index created successfully");
            result.put("data", Map.of(
                "database", database,
                "indexName", indexName,
                "collection", INDEX_QUEUE_COLLECTION
            ));
            return result;
        } catch (Exception e) {
            Map<String, Object> result = new HashMap<>();
            result.put("code", -1);
            result.put("message", "Failed to create index: " + e.getMessage());
            return result;
        }
    }

    /**
     * Get all indexes on IndexQueue collection
     */
    public List<Map<String, Object>> listIndexQueueIndexes(String database) {
        try {
            MongoCollection<Document> indexQueue = getIndexQueueCollection(database);
            List<Map<String, Object>> indexes = new ArrayList<>();
            
            for (Document index : indexQueue.listIndexes()) {
                Map<String, Object> indexInfo = new HashMap<>();
                indexInfo.put("name", index.getString("name"));
                indexInfo.put("key", index.get("key"));
                indexInfo.put("unique", index.getBoolean("unique", false));
                indexInfo.put("background", index.getBoolean("background", false));
                indexes.add(indexInfo);
            }
            
            return indexes;
        } catch (Exception e) {
            System.err.println("Failed to list indexes: " + e.getMessage());
            return new ArrayList<>();
        }
    }
}
