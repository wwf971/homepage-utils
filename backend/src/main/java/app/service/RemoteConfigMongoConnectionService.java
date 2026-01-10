package app.service;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

/**
 * Manages MongoDB connection for remote config storage
 * Can reuse the data MongoDB connection or connect to a separate config MongoDB
 */
@Service
public class RemoteConfigMongoConnectionService {
    
    private static final Logger logger = LoggerFactory.getLogger(RemoteConfigMongoConnectionService.class);
    
    private final MongoService dataMongoService;
    private MongoClient configMongoClient;
    private String currentConfigUri;
    private boolean usingSameAsData = false;
    
    public RemoteConfigMongoConnectionService(@Lazy MongoService dataMongoService) {
        this.dataMongoService = dataMongoService;
    }
    
    /**
     * Get MongoDB database for config storage
     * If useSameAsData is true, returns the data MongoDB connection
     * Otherwise, returns a separate config MongoDB connection
     */
    public MongoDatabase getConfigDatabase(boolean useSameAsData, String configUri, String databaseName) {
        if (useSameAsData) {
            // Reuse data MongoDB connection
            this.usingSameAsData = true;
            MongoClient dataClient = dataMongoService.getMongoClient();
            if (dataClient == null) {
                throw new RuntimeException("Data MongoDB is not connected");
            }
            return dataClient.getDatabase(databaseName);
        } else {
            // Use separate config MongoDB
            this.usingSameAsData = false;
            
            // If URI changed, reconnect
            if (configMongoClient == null || !configUri.equals(currentConfigUri)) {
                closeConfigConnection();
                try {
                    configMongoClient = MongoClients.create(configUri);
                    currentConfigUri = configUri;
                    logger.info("Connected to config MongoDB: {}", configUri);
                } catch (Exception e) {
                    logger.error("Failed to connect to config MongoDB: {}", e.getMessage());
                    throw new RuntimeException("Failed to connect to config MongoDB: " + e.getMessage());
                }
            }
            
            return configMongoClient.getDatabase(databaseName);
        }
    }
    
    /**
     * Close the config MongoDB connection (if not reusing data connection)
     */
    public void closeConfigConnection() {
        if (configMongoClient != null && !usingSameAsData) {
            try {
                configMongoClient.close();
                logger.info("Closed config MongoDB connection");
            } catch (Exception e) {
                logger.error("Error closing config MongoDB connection: {}", e.getMessage());
            } finally {
                configMongoClient = null;
                currentConfigUri = null;
            }
        }
    }
    
    /**
     * Test connection to config MongoDB
     */
    public String testConnection(boolean useSameAsData, String configUri, String databaseName) {
        try {
            MongoDatabase database = getConfigDatabase(useSameAsData, configUri, databaseName);
            // Try to list collections to verify connection
            database.listCollectionNames().first();
            return "Connection successful";
        } catch (Exception e) {
            return "Connection failed: " + e.getMessage();
        }
    }
}

