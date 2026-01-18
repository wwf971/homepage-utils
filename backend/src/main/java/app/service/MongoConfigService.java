package app.service;

import app.event.MongoConfigChangeEvent;
import app.pojo.MongoConfig;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

@Service
public class MongoConfigService {

    private MongoConfig currentConfig;
    private MongoConfig appConfig; // Store application.properties config separately
    private final LocalConfigService localConfigService;
    private final RemoteConfigService remoteConfigService;
    private final ApplicationEventPublisher eventPublisher;

    public MongoConfigService(
            LocalConfigService localConfigService,
            @Lazy RemoteConfigService remoteConfigService,
            ApplicationEventPublisher eventPublisher,
            @Value("${spring.data.mongodb.uri}") String uri,
            @Value("${spring.data.mongodb.database}") String database,
            @Value("${spring.data.mongodb.username:}") String username,
            @Value("${spring.data.mongodb.password:}") String password) {

        this.localConfigService = localConfigService;
        this.remoteConfigService = remoteConfigService;
        this.eventPublisher = eventPublisher;

        // Store application.properties config
        this.appConfig = new MongoConfig(uri, database, username, password);
        
        // Initialize with merged config
        this.currentConfig = mergeAllLayers(uri, database, username, password);
        System.out.println("MongoConfigService initialized with merged config: " + currentConfig);
    }
    
    /**
     * Merge all config layers: application.properties -> local -> remote -> computed
     */
    private MongoConfig mergeAllLayers(String uri, String database, String username, String password) {
        // Layer 1: application.properties (base)
        // Already provided as parameters
        
        // Layer 2: Local overrides
        String localUri = localConfigService.getConfig("mongo.uri");
        String localDatabase = localConfigService.getConfig("mongo.database");
        String localUsername = localConfigService.getConfig("mongo.username");
        String localPassword = localConfigService.getConfig("mongo.password");
        
        if (localUri != null) uri = localUri;
        if (localDatabase != null) database = localDatabase;
        if (localUsername != null) username = localUsername;
        if (localPassword != null) password = localPassword;
        
        // Layer 3: Remote config (from MongoDB)
        try {
            java.util.Map<String, String> remoteConfig = remoteConfigService.getRemoteConfig("mongo");
            String remoteUri = remoteConfig.get("uri");
            String remoteDatabase = remoteConfig.get("database");
            String remoteUsername = remoteConfig.get("username");
            String remotePassword = remoteConfig.get("password");
            
            if (remoteUri != null) uri = remoteUri;
            if (remoteDatabase != null) database = remoteDatabase;
            if (remoteUsername != null) username = remoteUsername;
            if (remotePassword != null) password = remotePassword;
        } catch (Exception e) {
            System.err.println("Failed to load remote config: " + e.getMessage());
        }
        
        return new MongoConfig(uri, database, username, password);
    }
    
    /**
     * Reload config by merging all layers again
     */
    public void reloadConfig(String uri, String database, String username, String password) {
        MongoConfig oldConfig = cloneConfig(this.currentConfig);
        this.currentConfig = mergeAllLayers(uri, database, username, password);
        
        // Publish event
        MongoConfigChangeEvent event = new MongoConfigChangeEvent(oldConfig, this.currentConfig);
        eventPublisher.publishEvent(event);
    }

    /**
     * Get application.properties config only (first layer, no overrides)
     */
    public MongoConfig getAppConfig() {
        return appConfig;
    }

    /**
     * Get current merged config (all layers applied)
     */
    public MongoConfig getCurrentConfig() {
        return currentConfig;
    }

    public void updateConfig(String path, Object value) throws Exception {
        MongoConfig oldConfig = cloneConfig(this.currentConfig);

        setNestedProperty(this.currentConfig, path, value);

        // Save to local config
        localConfigService.saveConfig("mongo." + path, String.valueOf(value), "mongo");

        // Publish event
        MongoConfigChangeEvent event = new MongoConfigChangeEvent(oldConfig, this.currentConfig);
        eventPublisher.publishEvent(event);

        System.out.println("MongoConfigService: Config updated: path=" + path + ", value=" + value);
        System.out.println("Event published: " + event);
    }

    private MongoConfig cloneConfig(MongoConfig config) {
        return new MongoConfig(config.getUri(), config.getDatabase(), config.getUsername(), config.getPassword());
    }

    private void setNestedProperty(Object obj, String path, Object value) throws Exception {
        String[] parts = path.split("\\.");
        Object current = obj;

        for (int i = 0; i < parts.length - 1; i++) {
            String fieldName = parts[i];
            var field = current.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            current = field.get(current);
            if (current == null) {
                throw new IllegalArgumentException("Path segment '" + fieldName + "' is null");
            }
        }

        String finalField = parts[parts.length - 1];
        var field = current.getClass().getDeclaredField(finalField);
        field.setAccessible(true);

        Object convertedValue = convertValue(value, field.getType());
        field.set(current, convertedValue);
    }

    private Object convertValue(Object value, Class<?> targetType) {
        if (value == null) {
            return null;
        }
        if (targetType.isInstance(value)) {
            return value;
        }
        String strValue = value.toString();
        if (targetType == String.class) {
            return strValue;
        } else if (targetType == int.class || targetType == Integer.class) {
            return Integer.parseInt(strValue);
        } else if (targetType == long.class || targetType == Long.class) {
            return Long.parseLong(strValue);
        } else if (targetType == boolean.class || targetType == Boolean.class) {
            return Boolean.parseBoolean(strValue);
        } else if (targetType == double.class || targetType == Double.class) {
            return Double.parseDouble(strValue);
        }
        return value;
    }
}

