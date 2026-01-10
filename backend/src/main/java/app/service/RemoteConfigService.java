package app.service;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import org.bson.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

import static com.mongodb.client.model.Filters.eq;

/**
 * Service for managing remote config stored in MongoDB
 */
@Service
public class RemoteConfigService {
    
    private static final Logger logger = LoggerFactory.getLogger(RemoteConfigService.class);
    
    private final RemoteConfigMongoConnectionService remoteConfigMongoConnectionService;
    private final LocalConfigService localConfigService;
    
    public RemoteConfigService(
            RemoteConfigMongoConnectionService remoteConfigMongoConnectionService,
            LocalConfigService localConfigService) {
        this.remoteConfigMongoConnectionService = remoteConfigMongoConnectionService;
        this.localConfigService = localConfigService;
    }
    
    /**
     * Get remote config for a category (jdbc or mongo)
     * Returns flattened key-value pairs
     */
    public Map<String, String> getRemoteConfig(String category) {
        Map<String, String> result = new HashMap<>();
        
        try {
            // Get MongoDB settings from local config
            String enabledStr = localConfigService.getConfig(category + ".remote.enabled");
            boolean useRemoteConfig = Boolean.parseBoolean(enabledStr != null ? enabledStr : "false");
            
            if (!useRemoteConfig) {
                logger.debug("Remote config disabled for category: {}", category);
                return result;
            }
            
            String useSameStr = localConfigService.getConfig(category + ".remote.useSameAsData");
            boolean useSameAsData = Boolean.parseBoolean(useSameStr != null ? useSameStr : "false");
            
            String configUri = localConfigService.getConfig(category + ".remote.uri");
            String databaseName = localConfigService.getConfig(category + ".remote.database");
            String collectionName = localConfigService.getConfig(category + ".remote.collection");
            String documentName = localConfigService.getConfig(category + ".remote.documentName");
            
            configUri = configUri != null ? configUri : "";
            databaseName = databaseName != null ? databaseName : "";
            collectionName = collectionName != null ? collectionName : "";
            documentName = documentName != null ? documentName : "";
            
            if (databaseName.isEmpty() || collectionName.isEmpty() || documentName.isEmpty()) {
                logger.warn("Remote config settings incomplete for category: {}", category);
                return result;
            }
            
            // Get MongoDB database
            MongoDatabase database = remoteConfigMongoConnectionService.getConfigDatabase(
                useSameAsData, configUri, databaseName
            );
            
            // Get collection (create if not exists)
            MongoCollection<Document> collection = database.getCollection(collectionName);
            
            // Find document by name
            Document doc = collection.find(eq("name", documentName)).first();
            
            if (doc == null) {
                logger.debug("Remote config document not found: {}", documentName);
                return result;
            }
            
            // Flatten document to key-value pairs (excluding MongoDB _id and name)
            flattenDocument(doc, "", result);
            result.remove("_id");
            result.remove("name");
            
            logger.info("Loaded {} remote config items for category: {}", result.size(), category);
            return result;
            
        } catch (Exception e) {
            logger.error("Failed to get remote config for category {}: {}", category, e.getMessage());
            return result;
        }
    }
    
    /**
     * Save a config value to remote MongoDB
     */
    public void saveRemoteConfig(String category, String key, String value) {
        try {
            // Get MongoDB settings from local config
            String enabledStr = localConfigService.getConfig(category + ".remote.enabled");
            boolean useRemoteConfig = Boolean.parseBoolean(enabledStr != null ? enabledStr : "false");
            
            if (!useRemoteConfig) {
                throw new RuntimeException("Remote config is not enabled for category: " + category);
            }
            
            String useSameStr = localConfigService.getConfig(category + ".remote.useSameAsData");
            boolean useSameAsData = Boolean.parseBoolean(useSameStr != null ? useSameStr : "false");
            
            String configUri = localConfigService.getConfig(category + ".remote.uri");
            String databaseName = localConfigService.getConfig(category + ".remote.database");
            String collectionName = localConfigService.getConfig(category + ".remote.collection");
            String documentName = localConfigService.getConfig(category + ".remote.documentName");
            
            configUri = configUri != null ? configUri : "";
            databaseName = databaseName != null ? databaseName : "";
            collectionName = collectionName != null ? collectionName : "";
            documentName = documentName != null ? documentName : "";
            
            // Get MongoDB database
            MongoDatabase database = remoteConfigMongoConnectionService.getConfigDatabase(
                useSameAsData, configUri, databaseName
            );
            
            // Get or create collection
            MongoCollection<Document> collection = database.getCollection(collectionName);
            
            // Find or create document
            Document doc = collection.find(eq("name", documentName)).first();
            
            if (doc == null) {
                // Create new document
                doc = new Document("name", documentName);
                setNestedValue(doc, key, value);
                collection.insertOne(doc);
                logger.info("Created new remote config document: {}", documentName);
            } else {
                // Update existing document
                setNestedValue(doc, key, value);
                collection.replaceOne(eq("name", documentName), doc);
                logger.info("Updated remote config: {} = {}", key, value);
            }
            
        } catch (Exception e) {
            logger.error("Failed to save remote config for category {}: {}", category, e.getMessage());
            throw new RuntimeException("Failed to save remote config: " + e.getMessage());
        }
    }
    
    /**
     * Delete a config key from remote MongoDB
     */
    public void deleteRemoteConfig(String category, String key) {
        try {
            String enabledStr = localConfigService.getConfig(category + ".remote.enabled");
            boolean useRemoteConfig = Boolean.parseBoolean(enabledStr != null ? enabledStr : "false");
            
            if (!useRemoteConfig) {
                return;
            }
            
            String useSameStr = localConfigService.getConfig(category + ".remote.useSameAsData");
            boolean useSameAsData = Boolean.parseBoolean(useSameStr != null ? useSameStr : "false");
            
            String configUri = localConfigService.getConfig(category + ".remote.uri");
            String databaseName = localConfigService.getConfig(category + ".remote.database");
            String collectionName = localConfigService.getConfig(category + ".remote.collection");
            String documentName = localConfigService.getConfig(category + ".remote.documentName");
            
            configUri = configUri != null ? configUri : "";
            databaseName = databaseName != null ? databaseName : "";
            collectionName = collectionName != null ? collectionName : "";
            documentName = documentName != null ? documentName : "";
            
            MongoDatabase database = remoteConfigMongoConnectionService.getConfigDatabase(
                useSameAsData, configUri, databaseName
            );
            
            MongoCollection<Document> collection = database.getCollection(collectionName);
            Document doc = collection.find(eq("name", documentName)).first();
            
            if (doc != null) {
                removeNestedValue(doc, key);
                collection.replaceOne(eq("name", documentName), doc);
                logger.info("Deleted remote config key: {}", key);
            }
            
        } catch (Exception e) {
            logger.error("Failed to delete remote config for category {}: {}", category, e.getMessage());
        }
    }
    
    /**
     * Flatten nested document to dot-notation key-value pairs
     */
    private void flattenDocument(Document doc, String prefix, Map<String, String> result) {
        for (Map.Entry<String, Object> entry : doc.entrySet()) {
            String key = prefix.isEmpty() ? entry.getKey() : prefix + "." + entry.getKey();
            Object value = entry.getValue();
            
            if (value instanceof Document) {
                flattenDocument((Document) value, key, result);
            } else {
                result.put(key, String.valueOf(value));
            }
        }
    }
    
    /**
     * Set nested value in document using dot notation (e.g., "a.b.c")
     */
    private void setNestedValue(Document doc, String key, String value) {
        String[] parts = key.split("\\.");
        Document current = doc;
        
        for (int i = 0; i < parts.length - 1; i++) {
            String part = parts[i];
            if (!current.containsKey(part) || !(current.get(part) instanceof Document)) {
                current.put(part, new Document());
            }
            current = (Document) current.get(part);
        }
        
        current.put(parts[parts.length - 1], value);
    }
    
    /**
     * Remove nested value from document using dot notation
     */
    private void removeNestedValue(Document doc, String key) {
        String[] parts = key.split("\\.");
        Document current = doc;
        
        for (int i = 0; i < parts.length - 1; i++) {
            String part = parts[i];
            if (!current.containsKey(part)) {
                return;
            }
            Object next = current.get(part);
            if (!(next instanceof Document)) {
                return;
            }
            current = (Document) next;
        }
        
        current.remove(parts[parts.length - 1]);
    }
    
    /**
     * Check status of remote MongoDB (connection, database, collection, document)
     */
    public Map<String, Object> checkStatus(String category) {
        Map<String, Object> result = new HashMap<>();
        result.put("connection", false);
        result.put("connectionMessage", "");
        result.put("database", "N/A");
        result.put("collection", "N/A");
        result.put("document", "N/A");
        
        try {
            // Get MongoDB settings
            String enabledStr = localConfigService.getConfig(category + ".remote.enabled");
            boolean useRemoteConfig = Boolean.parseBoolean(enabledStr != null ? enabledStr : "false");
            
            if (!useRemoteConfig) {
                result.put("connectionMessage", "Remote config is not enabled");
                return result;
            }
            
            String useSameStr = localConfigService.getConfig(category + ".remote.useSameAsData");
            boolean useSameAsData = Boolean.parseBoolean(useSameStr != null ? useSameStr : "false");
            
            String configUri = localConfigService.getConfig(category + ".remote.uri");
            String databaseName = localConfigService.getConfig(category + ".remote.database");
            String collectionName = localConfigService.getConfig(category + ".remote.collection");
            String documentName = localConfigService.getConfig(category + ".remote.documentName");
            
            configUri = configUri != null ? configUri : "";
            databaseName = databaseName != null ? databaseName : "";
            collectionName = collectionName != null ? collectionName : "";
            documentName = documentName != null ? documentName : "";
            
            if (databaseName.isEmpty() || collectionName.isEmpty() || documentName.isEmpty()) {
                result.put("connectionMessage", "Settings incomplete");
                return result;
            }
            
            // Try to connect
            MongoDatabase database;
            try {
                database = remoteConfigMongoConnectionService.getConfigDatabase(
                    useSameAsData, configUri, databaseName
                );
                result.put("connection", true);
                result.put("connectionMessage", "Connected successfully");
            } catch (Exception e) {
                result.put("connection", false);
                result.put("connectionMessage", e.getMessage());
                return result;
            }
            
            // Check if database exists (for MongoDB, database is created on first write)
            // We can check by listing collections
            try {
                database.listCollectionNames().first();
                result.put("database", true);
            } catch (Exception e) {
                result.put("database", false);
                result.put("collection", "N/A");
                result.put("document", "N/A");
                return result;
            }
            
            // Check if collection exists
            boolean collectionExists = false;
            for (String name : database.listCollectionNames()) {
                if (name.equals(collectionName)) {
                    collectionExists = true;
                    break;
                }
            }
            result.put("collection", collectionExists);
            
            if (!collectionExists) {
                result.put("document", "N/A");
                return result;
            }
            
            // Check if document exists
            MongoCollection<Document> collection = database.getCollection(collectionName);
            Document doc = collection.find(eq("name", documentName)).first();
            result.put("document", doc != null);
            
            return result;
            
        } catch (Exception e) {
            logger.error("Failed to check remote config status for category {}: {}", category, e.getMessage());
            result.put("connection", false);
            result.put("connectionMessage", e.getMessage());
            return result;
        }
    }
    
    /**
     * Create a database resource (database, collection, or document)
     */
    public void createResource(String category, String resourceType) {
        try {
            // Get MongoDB settings
            String enabledStr = localConfigService.getConfig(category + ".remote.enabled");
            boolean useRemoteConfig = Boolean.parseBoolean(enabledStr != null ? enabledStr : "false");
            
            if (!useRemoteConfig) {
                throw new RuntimeException("Remote config is not enabled");
            }
            
            String useSameStr = localConfigService.getConfig(category + ".remote.useSameAsData");
            boolean useSameAsData = Boolean.parseBoolean(useSameStr != null ? useSameStr : "false");
            
            String configUri = localConfigService.getConfig(category + ".remote.uri");
            String databaseName = localConfigService.getConfig(category + ".remote.database");
            String collectionName = localConfigService.getConfig(category + ".remote.collection");
            String documentName = localConfigService.getConfig(category + ".remote.documentName");
            
            configUri = configUri != null ? configUri : "";
            databaseName = databaseName != null ? databaseName : "";
            collectionName = collectionName != null ? collectionName : "";
            documentName = documentName != null ? documentName : "";
            
            MongoDatabase database = remoteConfigMongoConnectionService.getConfigDatabase(
                useSameAsData, configUri, databaseName
            );
            
            switch (resourceType.toLowerCase()) {
                case "database":
                    // Database is created automatically when we access it
                    // Just create a dummy collection to ensure database exists
                    database.createCollection("_init");
                    logger.info("Created database: {}", databaseName);
                    break;
                    
                case "collection":
                    database.createCollection(collectionName);
                    logger.info("Created collection: {}", collectionName);
                    break;
                    
                case "document":
                    MongoCollection<Document> collection = database.getCollection(collectionName);
                    Document doc = new Document("name", documentName);
                    collection.insertOne(doc);
                    logger.info("Created document: {}", documentName);
                    break;
                    
                default:
                    throw new RuntimeException("Unknown resource type: " + resourceType);
            }
            
        } catch (Exception e) {
            logger.error("Failed to create {} for category {}: {}", resourceType, category, e.getMessage());
            throw new RuntimeException("Failed to create " + resourceType + ": " + e.getMessage());
        }
    }
}

