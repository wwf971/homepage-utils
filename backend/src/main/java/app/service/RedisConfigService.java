package app.service;

import app.pojo.RedisConfig;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class RedisConfigService {

    private RedisConfig currentConfig;
    private final LocalConfigService localConfigService;

    public RedisConfigService(
            LocalConfigService localConfigService,
            @Value("${spring.data.redis.host:localhost}") String host,
            @Value("${spring.data.redis.port:6379}") Integer port,
            @Value("${spring.data.redis.username:}") String username,
            @Value("${spring.data.redis.password:}") String password,
            @Value("${spring.data.redis.timeout:3000}") Integer timeout) {

        this.localConfigService = localConfigService;

        try {
            System.out.println("RedisConfigService: Reading from application.properties:");
            System.out.println("  host=" + host);
            System.out.println("  port=" + port);
            System.out.println("  username=" + username);
            System.out.println("  password=" + (password != null && !password.isEmpty() ? "***" : "(empty)"));
            System.out.println("  timeout=" + timeout);

            // Initialize with merged config
            this.currentConfig = mergeAllLayers(host, port, username, password, timeout);
            System.out.println("RedisConfigService initialized with merged config: " + currentConfig);
        } catch (Exception e) {
            System.err.println("WARNING: Failed to initialize RedisConfigService: " + e.getMessage());
            e.printStackTrace();
            // Fallback to empty config
            this.currentConfig = new RedisConfig(
                host != null ? host : "localhost",
                port != null ? port : 6379,
                username != null ? username : "",
                password != null ? password : "",
                timeout != null ? timeout : 3000
            );
            System.out.println("RedisConfigService initialized with fallback config: " + currentConfig);
        }
    }
    
    /**
     * Merge all config layers: application.properties -> local -> computed
     * Currently only application.properties and local layers are implemented
     */
    private RedisConfig mergeAllLayers(String host, Integer port, String username, String password, Integer timeout) {
        // Layer 1: application.properties (base)
        // Already provided as parameters
        
        // Layer 2: Local overrides
        String localHost = localConfigService.getConfig("redis.host");
        String localPort = localConfigService.getConfig("redis.port");
        String localUsername = localConfigService.getConfig("redis.username");
        String localPassword = localConfigService.getConfig("redis.password");
        String localTimeout = localConfigService.getConfig("redis.timeout");
        
        if (localHost != null && !localHost.trim().isEmpty()) host = localHost;
        if (localPort != null && !localPort.trim().isEmpty()) {
            Integer parsedPort = parseInteger(localPort);
            if (parsedPort != null) port = parsedPort;
        }
        if (localUsername != null) username = localUsername;
        if (localPassword != null) password = localPassword;
        if (localTimeout != null && !localTimeout.trim().isEmpty()) {
            Integer parsedTimeout = parseInteger(localTimeout);
            if (parsedTimeout != null) timeout = parsedTimeout;
        }
        
        return new RedisConfig(host, port, username, password, timeout);
    }
    
    /**
     * Reload config by merging all layers again
     */
    public void reloadConfig(String host, Integer port, String username, String password, Integer timeout) {
        this.currentConfig = mergeAllLayers(host, port, username, password, timeout);
    }

    public RedisConfig getCurrentConfig() {
        return currentConfig;
    }

    public RedisConfig getLocalConfig() {
        String localHost = localConfigService.getConfig("redis.host");
        String localPort = localConfigService.getConfig("redis.port");
        String localUsername = localConfigService.getConfig("redis.username");
        String localPassword = localConfigService.getConfig("redis.password");
        String localTimeout = localConfigService.getConfig("redis.timeout");
        
        return new RedisConfig(
            localHost,
            parseInteger(localPort),
            localUsername,
            localPassword,
            parseInteger(localTimeout)
        );
    }
    
    private Integer parseInteger(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public void updateConfig(String path, Object value) throws Exception {
        setNestedProperty(this.currentConfig, path, value);

        // Save to local config
        localConfigService.saveConfig("redis." + path, String.valueOf(value), "redis");

        System.out.println("RedisConfigService: Config updated: path=" + path + ", value=" + value);
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
