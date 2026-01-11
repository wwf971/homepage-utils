package app.service;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import org.bson.Document;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Service for managing MongoDB-Elasticsearch index metadata
 * Stores metadata in mongo-index collection in the metadata database
 */
@Service
public class MongoIndexService {

    @Autowired
    private MongoService mongoService;

    private static final String METADATA_COLLECTION = "mongo-index";

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
    public Map<String, Object> updateIndex(String name, String esIndex, List<Map<String, String>> collections) {
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
}

