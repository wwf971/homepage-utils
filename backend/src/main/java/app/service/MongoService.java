package app.service;

import app.event.MongoConfigChangeEvent;
import app.pojo.MongoConfig;
import app.pojo.MongoConnectionStatus;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import org.springframework.context.event.EventListener;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.SimpleMongoClientDatabaseFactory;
import org.springframework.stereotype.Service;

@Service
public class MongoService {

    private MongoClient mongoClient;
    private MongoDatabase mongoDatabase;
    private MongoConfig currentConfig;

    private final MongoConfigService configService;

    public MongoService(MongoConfigService configService) {
        this.configService = configService;
        this.currentConfig = configService.getCurrentConfig();
        System.out.println("MongoService initialized with config from MongoConfigService (lazy connection): " + currentConfig);
        System.out.println("MongoDB will connect on first use or manual start");
    }

    @EventListener
    public void onConfigChange(MongoConfigChangeEvent event) {
        System.out.println("Config change event received in MongoService");
        System.out.println("Old config: " + event.getOldConfig());
        System.out.println("New config: " + event.getNewConfig());
        
        // Close existing connection since config changed
        closeConnection();
        
        // Try to reconnect with new config, but don't throw exception if it fails
        // This allows config to be saved even if the new config doesn't work yet
        try {
            initializeConnection(event.getNewConfig());
            System.out.println("Successfully reconnected with new config");
        } catch (Exception e) {
            System.err.println("Failed to reconnect with new config (config still saved): " + e.getMessage());
            // Don't throw - config update should succeed even if connection fails
            this.currentConfig = event.getNewConfig();
        }
    }

    private String buildConnectionUri(MongoConfig config) {
        String uri = config.getUri();
        String username = config.getUsername();
        String password = config.getPassword();
        
        // If username and password are provided, inject them into the URI
        if (username != null && !username.trim().isEmpty() && 
            password != null && !password.trim().isEmpty()) {
            
            // Parse the URI to inject credentials
            // Expected format: mongodb://host:port/database or mongodb://host:port
            if (uri.startsWith("mongodb://")) {
                String afterProtocol = uri.substring("mongodb://".length());
                
                // Check if credentials already exist in URI
                if (afterProtocol.contains("@")) {
                    // URI already has credentials, use as-is
                    return uri;
                }
                
                // Build new URI with credentials
                try {
                    String encodedUsername = java.net.URLEncoder.encode(username, "UTF-8");
                    String encodedPassword = java.net.URLEncoder.encode(password, "UTF-8");
                    
                    // Add authSource=admin if not already present in URI
                    String newUri = "mongodb://" + encodedUsername + ":" + encodedPassword + "@" + afterProtocol;
                    
                    // Check if URI already has query parameters
                    if (!newUri.contains("?")) {
                        newUri += "?authSource=admin";
                    } else if (!newUri.contains("authSource=")) {
                        newUri += "&authSource=admin";
                    }
                    
                    return newUri;
                } catch (java.io.UnsupportedEncodingException e) {
                    System.err.println("Failed to encode credentials: " + e.getMessage());
                    return uri;
                }
            }
        }
        
        return uri;
    }

    private void initializeConnection(MongoConfig config) {
        try {
            String connectionUri = buildConnectionUri(config);
            
            // Configure MongoDB client with extremely relaxed settings (1 day intervals) to minimize connection attempts
            com.mongodb.ConnectionString connString = new com.mongodb.ConnectionString(connectionUri);
            com.mongodb.MongoClientSettings settings = com.mongodb.MongoClientSettings.builder()
                .applyConnectionString(connString)
                // Socket settings - generous timeouts
                .applyToSocketSettings(builder -> 
                    builder
                        .connectTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
                        .readTimeout(300, java.util.concurrent.TimeUnit.SECONDS))  // 5 min read timeout
                // Cluster settings - very patient with server selection
                .applyToClusterSettings(builder ->
                    builder
                        .serverSelectionTimeout(60, java.util.concurrent.TimeUnit.SECONDS))
                // Connection pool settings - extremely relaxed, check only once per day
                .applyToConnectionPoolSettings(builder ->
                    builder
                        .maxSize(50)
                        .minSize(0)  // Never maintain minimum connections
                        .maxWaitTime(60, java.util.concurrent.TimeUnit.SECONDS)
                        .maxConnectionIdleTime(1, java.util.concurrent.TimeUnit.DAYS)  // Keep idle connections for 1 day
                        .maxConnectionLifeTime(0, java.util.concurrent.TimeUnit.MILLISECONDS)  // No max lifetime
                        .maintenanceFrequency(1, java.util.concurrent.TimeUnit.DAYS)  // Check pool once per day
                        .maintenanceInitialDelay(1, java.util.concurrent.TimeUnit.DAYS))  // Wait 1 day before first check
                // Server settings - heartbeat once per day only
                .applyToServerSettings(builder ->
                    builder
                        .heartbeatFrequency(1, java.util.concurrent.TimeUnit.DAYS)  // Check server health once per day
                        .minHeartbeatFrequency(1, java.util.concurrent.TimeUnit.DAYS))  // Minimum also 1 day
                .retryWrites(true)
                .retryReads(true)
                .build();
            
            this.mongoClient = MongoClients.create(settings);
            this.mongoDatabase = mongoClient.getDatabase(config.getDatabase());
            
            // Test connection
            this.mongoDatabase.listCollectionNames().first();
            
            this.currentConfig = config;
            System.out.println("MongoDB connection initialized successfully with connection pool settings");
        } catch (Exception e) {
            System.err.println("Failed to initialize MongoDB connection: " + e.getMessage());
            throw new RuntimeException("Failed to connect to MongoDB", e);
        }
    }

    private void closeConnection() {
        if (this.mongoClient != null) {
            this.mongoClient.close();
            this.mongoClient = null;
            this.mongoDatabase = null;
            System.out.println("MongoDB connection closed");
        }
    }

    public MongoClient getMongoClient() {
        if (this.mongoClient == null && this.currentConfig != null) {
            try {
                initializeConnection(this.currentConfig);
            } catch (Exception e) {
                System.err.println("Failed to lazily connect to MongoDB: " + e.getMessage());
                
                if (isConnectionException(e)) {
                    try {
                        System.out.println("Retrying connection...");
                        Thread.sleep(2000);
                        initializeConnection(this.currentConfig);
                    } catch (Exception retry) {
                        System.err.println("Retry failed: " + retry.getMessage());
                        return null;
                    }
                } else {
                    return null;
                }
            }
        }
        return this.mongoClient;
    }

    public MongoDatabase getMongoDatabase() {
        if (this.mongoClient == null && this.currentConfig != null) {
            try {
                initializeConnection(this.currentConfig);
            } catch (Exception e) {
                System.err.println("Failed to lazily connect to MongoDB: " + e.getMessage());
                
                if (isConnectionException(e)) {
                    try {
                        System.out.println("Retrying connection...");
                        Thread.sleep(2000);
                        initializeConnection(this.currentConfig);
                    } catch (Exception retry) {
                        System.err.println("Retry failed: " + retry.getMessage());
                        return null;
                    }
                } else {
                    return null;
                }
            }
        }
        
        // Test connection before returning
        if (this.mongoDatabase != null) {
            try {
                this.mongoDatabase.listCollectionNames().first();
            } catch (Exception e) {
                System.err.println("Connection test failed: " + e.getMessage());
                if (isConnectionException(e)) {
                    try {
                        attemptReconnect();
                    } catch (Exception retry) {
                        System.err.println("Reconnection failed: " + retry.getMessage());
                        return null;
                    }
                } else {
                    return null;
                }
            }
        }
        
        return this.mongoDatabase;
    }

    /**
     * Helper method to detect if an exception is connection-related
     * Checks both the exception type and its cause chain
     */
    private boolean isConnectionException(Exception e) {
        if (e == null) return false;
        
        // Check the exception and its entire cause chain
        Throwable current = e;
        while (current != null) {
            // Check for specific network exception types
            if (current instanceof java.net.NoRouteToHostException) {
                System.err.println("Detected NoRouteToHostException - network routing issue");
                return true;
            }
            if (current instanceof java.net.ConnectException) {
                System.err.println("Detected ConnectException - connection refused or unreachable");
                return true;
            }
            if (current instanceof java.net.SocketException) {
                System.err.println("Detected SocketException - socket-level error");
                return true;
            }
            if (current instanceof java.net.SocketTimeoutException) {
                System.err.println("Detected SocketTimeoutException - timeout");
                return true;
            }
            if (current instanceof com.mongodb.MongoSocketException) {
                System.err.println("Detected MongoSocketException - MongoDB socket error");
                return true;
            }
            if (current instanceof com.mongodb.MongoTimeoutException) {
                System.err.println("Detected MongoTimeoutException - MongoDB timeout");
                return true;
            }
            
            // Check exception message for connection error patterns
            String message = current.getMessage();
            if (message != null) {
                if (message.contains("No route to host") ||
                    message.contains("Connection refused") ||
                    message.contains("Connection reset") ||
                    message.contains("Broken pipe") ||
                    message.contains("Connection timed out")) {
                    System.err.println("Detected connection error in message: " + message);
                    return true;
                }
            }
            
            // Move to the cause
            current = current.getCause();
        }
        
        return false;
    }

    /**
     * Attempt to reconnect if connection is lost
     */
    private void attemptReconnect() {
        System.out.println("Attempting to reconnect to MongoDB...");
        closeConnection();
        if (this.currentConfig != null) {
            try {
                initializeConnection(this.currentConfig);
                System.out.println("Successfully reconnected to MongoDB");
            } catch (Exception e) {
                System.err.println("Failed to reconnect: " + e.getMessage());
                throw new RuntimeException("Failed to reconnect to MongoDB", e);
            }
        }
    }

    public MongoTemplate getMongoTemplate() {
        if (this.mongoClient == null && this.currentConfig != null) {
            try {
                initializeConnection(this.currentConfig);
            } catch (Exception e) {
                System.err.println("Failed to connect to MongoDB: " + e.getMessage());
                
                // If it's a connection exception, try once more after a short delay
                if (isConnectionException(e)) {
                    try {
                        System.out.println("Connection error detected, retrying after 2 seconds...");
                        Thread.sleep(2000);
                        initializeConnection(this.currentConfig);
                    } catch (Exception retry) {
                        System.err.println("Retry also failed: " + retry.getMessage());
                        return null;
                    }
                } else {
                    return null;
                }
            }
        }
        
        if (this.mongoClient == null || this.currentConfig == null) {
            return null;
        }
        
        try {
            // Test the connection before returning template
            mongoDatabase.listCollectionNames().first();
            return new MongoTemplate(new SimpleMongoClientDatabaseFactory(this.mongoClient, this.currentConfig.getDatabase()));
        } catch (Exception e) {
            System.err.println("Failed to create MongoTemplate or connection test failed: " + e.getMessage());
            
            // If connection issue, attempt reconnect
            if (isConnectionException(e)) {
                try {
                    attemptReconnect();
                    return new MongoTemplate(new SimpleMongoClientDatabaseFactory(this.mongoClient, this.currentConfig.getDatabase()));
                } catch (Exception retry) {
                    System.err.println("Reconnection failed: " + retry.getMessage());
                    return null;
                }
            }
            
            return null;
        }
    }

    public MongoConfig getCurrentConfig() {
        return this.currentConfig;
    }

    public MongoConnectionStatus getStatus() {
        MongoConnectionStatus status = new MongoConnectionStatus();
        status.setCurrentUri(currentConfig != null ? currentConfig.getUri() : null);
        status.setCurrentDatabase(currentConfig != null ? currentConfig.getDatabase() : null);

        if (mongoClient == null) {
            status.setConnected(false);
            return status;
        }

        try {
            mongoDatabase.listCollectionNames().first();
            status.setConnected(true);
        } catch (Exception e) {
            status.setConnected(false);
            System.err.println("MongoDB connection test failed: " + e.getMessage());
        }
        return status;
    }

    public void stopConnection() {
        closeConnection();
        System.out.println("MongoDB connection stopped manually");
    }

    public void startConnection(MongoConfig config) {
        if (mongoClient != null) {
            throw new IllegalStateException("MongoDB connection is already active. Stop it first.");
        }
        initializeConnection(config);
        System.out.println("MongoDB connection started manually with config: " + config);
    }

    public String testConnection() {
        try {
            if (mongoClient == null || mongoDatabase == null) {
                if (currentConfig != null) {
                    try {
                        // Create a client with shorter timeout for testing
                        String connectionUri = buildConnectionUri(currentConfig);
                        com.mongodb.ConnectionString connString = new com.mongodb.ConnectionString(connectionUri);
                        com.mongodb.MongoClientSettings settings = com.mongodb.MongoClientSettings.builder()
                            .applyConnectionString(connString)
                            .applyToSocketSettings(builder -> 
                                builder.connectTimeout(120, java.util.concurrent.TimeUnit.SECONDS)
                                       .readTimeout(120, java.util.concurrent.TimeUnit.SECONDS))
                            .applyToClusterSettings(builder ->
                                builder.serverSelectionTimeout(120, java.util.concurrent.TimeUnit.SECONDS))
                            .build();
                        
                        MongoClient testClient = MongoClients.create(settings);
                        MongoDatabase testDb = testClient.getDatabase(currentConfig.getDatabase());
                        
                        // Test the connection
                        String firstCollection = testDb.listCollectionNames().first();
                        
                        // Close test client
                        testClient.close();
                        
                        if (firstCollection != null) {
                            return "Connection successful! Database '" + currentConfig.getDatabase() + "' has collection: " + firstCollection;
                        } else {
                            return "Connection successful! Database '" + currentConfig.getDatabase() + "' exists but has no collections";
                        }
                    } catch (Exception e) {
                        throw new RuntimeException("Failed to connect: " + e.getMessage());
                    }
                } else {
                    throw new RuntimeException("No configuration available");
                }
            }
            
            // If already connected, just test it
            String firstCollection = mongoDatabase.listCollectionNames().first();
            if (firstCollection != null) {
                return "Connection successful! Database '" + currentConfig.getDatabase() + "' has collection: " + firstCollection;
            } else {
                return "Connection successful! Database '" + currentConfig.getDatabase() + "' exists but has no collections";
            }
        } catch (Exception e) {
            System.err.println("MongoDB connection test failed: " + e.getMessage());
            throw new RuntimeException("Connection test failed: " + e.getMessage());
        }
    }

    public java.util.List<String> listAllDatabases() {
        try {
            // Ensure connection exists
            if (mongoClient == null) {
                if (currentConfig != null) {
                    initializeConnection(currentConfig);
                } else {
                    throw new RuntimeException("No configuration available");
                }
            }
            
            // List all databases
            java.util.List<String> databases = new java.util.ArrayList<>();
            for (String dbName : mongoClient.listDatabaseNames()) {
                databases.add(dbName);
            }
            
            return databases;
        } catch (Exception e) {
            System.err.println("Failed to list databases: " + e.getMessage());
            throw new RuntimeException("Failed to list databases: " + e.getMessage());
        }
    }

    public java.util.List<String> listCollectionsInDatabase(String databaseName) {
        try {
            // Ensure connection exists
            if (mongoClient == null) {
                if (currentConfig != null) {
                    initializeConnection(currentConfig);
                } else {
                    throw new RuntimeException("No configuration available");
                }
            }
            
            // Get the specified database
            MongoDatabase database = mongoClient.getDatabase(databaseName);
            
            // List all collections
            java.util.List<String> collections = new java.util.ArrayList<>();
            for (String collectionName : database.listCollectionNames()) {
                collections.add(collectionName);
            }
            
            return collections;
        } catch (Exception e) {
            System.err.println("Failed to list collections in database '" + databaseName + "': " + e.getMessage());
            throw new RuntimeException("Failed to list collections: " + e.getMessage());
        }
    }

    public java.util.Map<String, Object> listDocumentsInCollection(String databaseName, String collectionName, int page, int pageSize) {
        try {
            // Ensure connection exists
            if (mongoClient == null) {
                if (currentConfig != null) {
                    initializeConnection(currentConfig);
                } else {
                    throw new RuntimeException("No configuration available");
                }
            }
            
            // Get the specified database and collection
            MongoDatabase database = mongoClient.getDatabase(databaseName);
            com.mongodb.client.MongoCollection<org.bson.Document> collection = database.getCollection(collectionName);
            
            // Calculate skip value
            int skip = (page - 1) * pageSize;
            
            // Get total count
            long total = collection.countDocuments();
            
            // Get documents with pagination
            java.util.List<org.bson.Document> documents = new java.util.ArrayList<>();
            for (org.bson.Document doc : collection.find().skip(skip).limit(pageSize)) {
                // Convert ObjectId to string for proper JSON serialization
                if (doc.get("_id") instanceof org.bson.types.ObjectId) {
                    doc.put("_id", doc.getObjectId("_id").toHexString());
                }
                documents.add(doc);
            }
            
            // Create response
            java.util.Map<String, Object> response = new java.util.HashMap<>();
            response.put("documents", documents);
            response.put("total", total);
            response.put("page", page);
            response.put("pageSize", pageSize);
            
            return response;
        } catch (Exception e) {
            System.err.println("Failed to list documents in collection '" + collectionName + "': " + e.getMessage());
            throw new RuntimeException("Failed to list documents: " + e.getMessage());
        }
    }

    /**
     * Update a MongoDB document with various operations
     * 
     * @param databaseName Database name
     * @param collectionName Collection name
     * @param docId Document _id as string
     * @param action Action type: "setValue", "deleteField", "addArrayItem", "removeArrayItem"
     * @param path Field path in dot notation (e.g., "user.name", "tags.0")
     * @param value Value for setValue and addArrayItem actions
     * @param position Position for addArrayItem (-1 for end, or specific index)
     * @return Updated document
     */
    public org.bson.Document updateDocument(
            String databaseName, 
            String collectionName, 
            String docId,
            String action,
            String path,
            Object value,
            Integer position) {
        
        if (mongoClient == null) {
            throw new RuntimeException("MongoDB client is not initialized");
        }

        // Prevent modification of _id field
        if (path != null && (path.equals("_id") || path.startsWith("_id."))) {
            throw new RuntimeException("Cannot modify _id field");
        }

        com.mongodb.client.MongoDatabase database = mongoClient.getDatabase(databaseName);
        com.mongodb.client.MongoCollection<org.bson.Document> collection = database.getCollection(collectionName);

        // Create filter for the document
        org.bson.Document filter = new org.bson.Document("_id", new org.bson.types.ObjectId(docId));

        // Create update operation based on action
        org.bson.Document update = new org.bson.Document();

        switch (action) {
            case "setValue":
                // Set or update a field value
                update.put("$set", new org.bson.Document(path, value));
                break;

            case "deleteField":
                // Remove a field
                update.put("$unset", new org.bson.Document(path, ""));
                break;

            case "addArrayItem":
                // Add item to array
                if (position != null && position >= 0) {
                    // Insert at specific position (requires $push with $position)
                    org.bson.Document pushDoc = new org.bson.Document("$each", java.util.Arrays.asList(value))
                        .append("$position", position);
                    update.put("$push", new org.bson.Document(path, pushDoc));
                } else {
                    // Append to end
                    update.put("$push", new org.bson.Document(path, value));
                }
                break;

            case "removeArrayItem":
                // Remove array item at specific index
                // Path format: "tags.0" - we need to extract array path and index
                int lastDot = path.lastIndexOf('.');
                if (lastDot > 0) {
                    String arrayPath = path.substring(0, lastDot);
                    try {
                        int index = Integer.parseInt(path.substring(lastDot + 1));
                        
                        // MongoDB doesn't have a direct "remove by index" operator
                        // We need to: 1) unset the index (makes it null), 2) pull all nulls
                        org.bson.Document unsetOp = new org.bson.Document("$unset", 
                            new org.bson.Document(path, ""));
                        collection.updateOne(filter, unsetOp);
                        
                        // Now pull all null values from the array
                        org.bson.Document pullOp = new org.bson.Document("$pull", 
                            new org.bson.Document(arrayPath, null));
                        collection.updateOne(filter, pullOp);
                        
                        // Don't set update variable since we already executed the operations
                        update = null;
                    } catch (NumberFormatException e) {
                        throw new RuntimeException("Invalid array index in path: " + path);
                    }
                } else {
                    throw new RuntimeException("Invalid array item path: " + path);
                }
                break;

            case "replaceFields":
                // Replace all fields in the document (used for reordering root-level fields)
                // Value should be a Map containing all fields except _id
                if (path == null || path.isEmpty()) {
                    // Root level replacement - use replaceOne to preserve field order
                    if (value instanceof java.util.Map) {
                        @SuppressWarnings("unchecked")
                        java.util.Map<String, Object> fields = (java.util.Map<String, Object>) value;
                        
                        // Build new document with _id + all other fields in specified order
                        org.bson.Document newDoc = new org.bson.Document();
                        newDoc.put("_id", new org.bson.types.ObjectId(docId));
                        
                        // Add fields in the order they appear in the map
                        // LinkedHashMap preserves insertion order
                        fields.forEach((k, v) -> {
                            if (!"_id".equals(k)) {  // Skip _id as we already added it
                                newDoc.put(k, v);
                            }
                        });
                        
                        // Use replaceOne instead of updateOne to preserve field order
                        collection.replaceOne(filter, newDoc);
                        
                        // Set update to null to skip the updateOne call below
                        update = null;
                    } else {
                        throw new RuntimeException("replaceFields requires a Map value");
                    }
                } else {
                    // Nested object replacement
                    update.put("$set", new org.bson.Document(path, value));
                }
                break;

            default:
                throw new RuntimeException("Unknown action: " + action);
        }

        // Perform update (if update is not null - some actions like removeArrayItem handle it themselves)
        if (update != null && !update.isEmpty()) {
            collection.updateOne(filter, update);
        }

        // Fetch and return updated document
        org.bson.Document updatedDoc = collection.find(filter).first();
        if (updatedDoc == null) {
            throw new RuntimeException("Document not found after update");
        }

        // Convert ObjectId to string for proper JSON serialization
        if (updatedDoc.get("_id") instanceof org.bson.types.ObjectId) {
            updatedDoc.put("_id", updatedDoc.getObjectId("_id").toHexString());
        }

        return updatedDoc;
    }

    /**
     * Query a document by a filter and extract a value from a specific path
     * 
     * @param databaseName Database name
     * @param collectionName Collection name
     * @param filterParams Map of filter key-value pairs
     * @param extractPath Path to extract from the document (dot notation, e.g., "aa.0.1" for doc.aa[0][1])
     * @param sortBy Comma-separated list of fields to sort by (e.g., "field1,field2")
     * @param sortOrder Sort order: "asc" for ascending, "desc" for descending (default: "asc")
     * @return The extracted value from the first matching document
     */
    public Object queryDocument(
            String databaseName,
            String collectionName,
            java.util.Map<String, String> filterParams,
            String extractPath,
            String sortBy,
            String sortOrder) {
        
        if (mongoClient == null) {
            if (currentConfig != null) {
                initializeConnection(currentConfig);
            } else {
                throw new RuntimeException("MongoDB client is not initialized");
            }
        }

        com.mongodb.client.MongoDatabase database = mongoClient.getDatabase(databaseName);
        com.mongodb.client.MongoCollection<org.bson.Document> collection = database.getCollection(collectionName);

        // Create filter from multiple key-value pairs
        // Support path-like keys (e.g., "a.0.b") using MongoDB's dot notation
        org.bson.Document filter = new org.bson.Document();
        for (java.util.Map.Entry<String, String> entry : filterParams.entrySet()) {
            String key = entry.getKey();
            String value = entry.getValue();
            
            // MongoDB supports dot notation directly in queries
            // e.g., filter.put("setting.type", "local/internal") will match nested field
            filter.put(key, value);
        }

        // Build sort document if sortBy is provided
        org.bson.Document sortDoc = null;
        if (sortBy != null && !sortBy.trim().isEmpty()) {
            sortDoc = new org.bson.Document();
            String[] sortFields = sortBy.split(",");
            int sortDirection = (sortOrder != null && sortOrder.equalsIgnoreCase("desc")) ? -1 : 1;
            
            for (String field : sortFields) {
                field = field.trim();
                if (!field.isEmpty()) {
                    sortDoc.put(field, sortDirection);
                }
            }
            System.out.println("MongoDB sort: " + sortDoc.toJson());
        }

        // Find first matching document with optional sorting
        com.mongodb.client.FindIterable<org.bson.Document> findIterable = collection.find(filter);
        if (sortDoc != null) {
            findIterable = findIterable.sort(sortDoc);
        }
        org.bson.Document doc = findIterable.first();
        
        if (doc == null) {
            throw new RuntimeException("No document found matching filter " + filter.toJson() + " (collection: " + collectionName + ", database: " + databaseName + ")");
        }

        // Extract value from path
        // Support path="." to return the entire document
        if (extractPath == null || extractPath.trim().isEmpty() || ".".equals(extractPath.trim())) {
            // Return the whole document if no path specified or path is "."
            if (doc.get("_id") instanceof org.bson.types.ObjectId) {
                doc.put("_id", doc.getObjectId("_id").toHexString());
            }
            return doc;
        }

        // Parse path and navigate through document
        String[] parts = extractPath.split("\\.");
        Object current = doc;

        for (String part : parts) {
            if (current == null) {
                throw new RuntimeException("Path " + extractPath + " not found in document");
            }

            // Check if part is an array index
            try {
                int index = Integer.parseInt(part);
                if (current instanceof java.util.List) {
                    @SuppressWarnings("unchecked")
                    java.util.List<Object> list = (java.util.List<Object>) current;
                    if (index < 0 || index >= list.size()) {
                        throw new RuntimeException("Array index " + index + " out of bounds");
                    }
                    current = list.get(index);
                } else {
                    throw new RuntimeException("Expected array at " + part + " but got " + current.getClass().getSimpleName());
                }
            } catch (NumberFormatException e) {
                // Not an array index, treat as object field
                if (current instanceof org.bson.Document) {
                    current = ((org.bson.Document) current).get(part);
                } else if (current instanceof java.util.Map) {
                    @SuppressWarnings("unchecked")
                    java.util.Map<String, Object> map = (java.util.Map<String, Object>) current;
                    current = map.get(part);
                } else {
                    throw new RuntimeException("Expected object at " + part + " but got " + current.getClass().getSimpleName());
                }
            }
        }

        // Convert ObjectId to string if needed
        if (current instanceof org.bson.types.ObjectId) {
            return ((org.bson.types.ObjectId) current).toHexString();
        }

        return current;
    }

    /**
     * Query all documents matching filters with pagination
     * Returns matching documents with pagination info
     * 
     * @param databaseName Database name
     * @param collectionName Collection name
     * @param filterParams Map of filter key-value pairs
     * @param sortBy Comma-separated list of fields to sort by (e.g., "field1,field2")
     * @param sortOrder Sort order: "asc" for ascending, "desc" for descending (default: "asc")
     * @param page Page number (1-based)
     * @param pageSize Number of documents per page
     * @return Map containing documents, total count, page info
     */
    public java.util.Map<String, Object> queryAllDocuments(
            String databaseName,
            String collectionName,
            java.util.Map<String, String> filterParams,
            String sortBy,
            String sortOrder,
            int page,
            int pageSize) {
        
        if (mongoClient == null) {
            if (currentConfig != null) {
                initializeConnection(currentConfig);
            } else {
                throw new RuntimeException("MongoDB client is not initialized");
            }
        }

        com.mongodb.client.MongoDatabase database = mongoClient.getDatabase(databaseName);
        com.mongodb.client.MongoCollection<org.bson.Document> collection = database.getCollection(collectionName);

        // Create filter from multiple key-value pairs
        org.bson.Document filter = new org.bson.Document();
        for (java.util.Map.Entry<String, String> entry : filterParams.entrySet()) {
            String key = entry.getKey();
            String value = entry.getValue();
            filter.put(key, value);
        }

        // Build sort document if sortBy is provided
        org.bson.Document sortDoc = null;
        if (sortBy != null && !sortBy.trim().isEmpty()) {
            sortDoc = new org.bson.Document();
            String[] sortFields = sortBy.split(",");
            int sortDirection = (sortOrder != null && sortOrder.equalsIgnoreCase("desc")) ? -1 : 1;
            
            for (String field : sortFields) {
                field = field.trim();
                if (!field.isEmpty()) {
                    sortDoc.put(field, sortDirection);
                }
            }
        }

        // Get total count of matching documents
        long totalCount = collection.countDocuments(filter);

        // Calculate pagination
        int skip = (page - 1) * pageSize;

        // Find matching documents with optional sorting and pagination
        com.mongodb.client.FindIterable<org.bson.Document> findIterable = collection.find(filter);
        if (sortDoc != null) {
            findIterable = findIterable.sort(sortDoc);
        }
        findIterable = findIterable.skip(skip).limit(pageSize);

        // Convert to list and process ObjectIds
        java.util.List<org.bson.Document> results = new java.util.ArrayList<>();
        for (org.bson.Document doc : findIterable) {
            if (doc.get("_id") instanceof org.bson.types.ObjectId) {
                doc.put("_id", doc.getObjectId("_id").toHexString());
            }
            results.add(doc);
        }
        
        // Build result map with pagination info
        java.util.Map<String, Object> result = new java.util.HashMap<>();
        result.put("documents", results);
        result.put("total", totalCount);
        result.put("page", page);
        result.put("pageSize", pageSize);
        
        return result;
    }

    /**
     * Create a new collection in a database
     * 
     * @param databaseName Database name
     * @param collectionName Collection name to create
     */
    public void createCollection(String databaseName, String collectionName) {
        if (mongoClient == null) {
            if (currentConfig != null) {
                initializeConnection(currentConfig);
            } else {
                throw new RuntimeException("MongoDB client is not initialized");
            }
        }

        com.mongodb.client.MongoDatabase database = mongoClient.getDatabase(databaseName);
        
        // Check if collection already exists
        for (String existingCollection : database.listCollectionNames()) {
            if (existingCollection.equals(collectionName)) {
                throw new RuntimeException("Collection '" + collectionName + "' already exists in database '" + databaseName + "'");
            }
        }
        
        // create the collection
        database.createCollection(collectionName);
    }

    /**
     * Create an empty document in a collection (only contains _id)
     * 
     * @param databaseName Database name
     * @param collectionName Collection name
     * @return The created document with _id
     */
    public org.bson.Document createEmptyDocument(String databaseName, String collectionName) {
        if (mongoClient == null) {
            if (currentConfig != null) {
                initializeConnection(currentConfig);
            } else {
                throw new RuntimeException("MongoDB client is not initialized");
            }
        }

        com.mongodb.client.MongoDatabase database = mongoClient.getDatabase(databaseName);
        com.mongodb.client.MongoCollection<org.bson.Document> collection = database.getCollection(collectionName);

        // Create an empty document
        org.bson.Document newDoc = new org.bson.Document();
        
        // Insert the document (MongoDB will auto-generate _id)
        collection.insertOne(newDoc);
        
        // Convert ObjectId to string for proper JSON serialization
        if (newDoc.get("_id") instanceof org.bson.types.ObjectId) {
            newDoc.put("_id", newDoc.getObjectId("_id").toHexString());
        }
        
        return newDoc;
    }

    /**
     * Delete a document by its ID
     * 
     * @param databaseName Database name
     * @param collectionName Collection name
     * @param docId Document _id as string
     */
    public void deleteDocument(String databaseName, String collectionName, String docId) {
        if (mongoClient == null) {
            throw new RuntimeException("MongoDB client is not initialized");
        }

        com.mongodb.client.MongoDatabase database = mongoClient.getDatabase(databaseName);
        com.mongodb.client.MongoCollection<org.bson.Document> collection = database.getCollection(collectionName);

        // Create filter for the document
        org.bson.Document filter = new org.bson.Document("_id", new org.bson.types.ObjectId(docId));

        // Delete the document
        com.mongodb.client.result.DeleteResult result = collection.deleteOne(filter);
        
        if (result.getDeletedCount() == 0) {
            throw new RuntimeException("Document with _id '" + docId + "' not found");
        }
    }
}

