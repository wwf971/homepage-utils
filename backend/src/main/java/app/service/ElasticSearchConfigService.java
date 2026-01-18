package app.service;

import app.pojo.ElasticSearchConfig;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class ElasticSearchConfigService {

    private ElasticSearchConfig currentConfig;
    private ElasticSearchConfig appConfig; // Store application.properties config separately
    private final LocalConfigService localConfigService;

    public ElasticSearchConfigService(
            LocalConfigService localConfigService,
            @Value("${app.elasticsearch.uris:http://localhost:9200}") String uris,
            @Value("${app.elasticsearch.username:}") String username,
            @Value("${app.elasticsearch.password:}") String password) {

        this.localConfigService = localConfigService;

        try {
            System.out.println("ElasticSearchConfigService: Reading from application.properties:");
            System.out.println("  uris=" + uris);
            System.out.println("  username=" + username);
            System.out.println("  password=" + (password != null && !password.isEmpty() ? "***" : "(empty)"));

            // Store application.properties config
            this.appConfig = new ElasticSearchConfig(uris, username, password);
            
            // Initialize with merged config
            this.currentConfig = mergeAllLayers(uris, username, password);
            System.out.println("ElasticSearchConfigService initialized with merged config: " + currentConfig);
        } catch (Exception e) {
            System.err.println("WARNING: Failed to initialize ElasticSearchConfigService: " + e.getMessage());
            e.printStackTrace();
            // Fallback to empty config
            this.appConfig = new ElasticSearchConfig(
                uris != null ? uris : "http://localhost:9200",
                username != null ? username : "",
                password != null ? password : ""
            );
            this.currentConfig = new ElasticSearchConfig(
                uris != null ? uris : "http://localhost:9200",
                username != null ? username : "",
                password != null ? password : ""
            );
            System.out.println("ElasticSearchConfigService initialized with fallback config: " + currentConfig);
        }
    }
    
    /**
     * Merge all config layers: application.properties -> local -> computed
     * Currently only application.properties and local layers are implemented
     */
    private ElasticSearchConfig mergeAllLayers(String uris, String username, String password) {
        // Layer 1: application.properties (base)
        // Already provided as parameters
        
        // Layer 2: Local overrides
        String localUris = localConfigService.getConfig("elasticsearch.uris");
        String localUsername = localConfigService.getConfig("elasticsearch.username");
        String localPassword = localConfigService.getConfig("elasticsearch.password");
        
        if (localUris != null) uris = localUris;
        if (localUsername != null) username = localUsername;
        if (localPassword != null) password = localPassword;
        
        return new ElasticSearchConfig(uris, username, password);
    }
    
    /**
     * Reload config by merging all layers again
     */
    public void reloadConfig(String uris, String username, String password) {
        this.currentConfig = mergeAllLayers(uris, username, password);
    }

    /**
     * Get application.properties config only (first layer, no overrides)
     */
    public ElasticSearchConfig getAppConfig() {
        return appConfig;
    }

    /**
     * Get current merged config (all layers applied)
     */
    public ElasticSearchConfig getCurrentConfig() {
        return currentConfig;
    }

    public void updateConfig(String path, Object value) throws Exception {
        setNestedProperty(this.currentConfig, path, value);

        // Save to local config
        localConfigService.saveConfig("elasticsearch." + path, String.valueOf(value), "elasticsearch");

        System.out.println("ElasticSearchConfigService: Config updated: path=" + path + ", value=" + value);
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

