package app.service;

import app.event.JdbcConfigChangeEvent;
import app.pojo.JdbcConfig;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

@Service
public class JdbcConfigService {

    private JdbcConfig configCurrent;
    private JdbcConfig appConfig; // Store application.properties config separately
    private final LocalConfigService localConfigService;
    private final ApplicationEventPublisher eventPublisher;

    public JdbcConfigService(
            LocalConfigService localConfigService,
            ApplicationEventPublisher eventPublisher,
            @Value("${spring.datasource.url}") String url,
            @Value("${spring.datasource.username}") String username,
            @Value("${spring.datasource.password}") String password,
            @Value("${spring.datasource.driver-class-name}") String driverClassName) {

        this.localConfigService = localConfigService;
        this.eventPublisher = eventPublisher;

        // Store application.properties config
        this.appConfig = new JdbcConfig(url, username, password, driverClassName);
        
        // Initialize with merged config
        this.configCurrent = mergeAllLayers(url, username, password, driverClassName);
        System.out.println("JdbcConfigService initialized with merged config: " + configCurrent);
    }
    
    /**
     * Merge all config layers: application.properties -> local -> computed
     */
    private JdbcConfig mergeAllLayers(String url, String username, String password, String driverClassName) {
        // Layer 1: application.properties (base)
        // Already provided as parameters
        
        // Layer 2: Local overrides
        String localUrl = localConfigService.getConfig("jdbc.url");
        String localUsername = localConfigService.getConfig("jdbc.username");
        String localPassword = localConfigService.getConfig("jdbc.password");
        String localDriverClassName = localConfigService.getConfig("jdbc.driverClassName");
        
        if (localUrl != null) url = localUrl;
        if (localUsername != null) username = localUsername;
        if (localPassword != null) password = localPassword;
        if (localDriverClassName != null) driverClassName = localDriverClassName;
        
        return new JdbcConfig(url, username, password, driverClassName);
    }
    
    /**
     * Reload config by merging all layers again
     */
    public void reloadConfig(String url, String username, String password, String driverClassName) {
        JdbcConfig oldConfig = cloneConfig(this.configCurrent);
        this.configCurrent = mergeAllLayers(url, username, password, driverClassName);
        
        // Publish event
        JdbcConfigChangeEvent event = new JdbcConfigChangeEvent(oldConfig, this.configCurrent);
        eventPublisher.publishEvent(event);
    }

    /**
     * Get application.properties config only (first layer, no overrides)
     */
    public JdbcConfig getAppConfig() {
        return appConfig;
    }

    /**
     * Get current merged config (all layers applied)
     */
    public JdbcConfig getConfigCurrent() {
        return configCurrent;
    }

    public void updateConfig(String path, Object value) throws Exception {
        JdbcConfig oldConfig = cloneConfig(this.configCurrent);

        setNestedProperty(this.configCurrent, path, value);

        // Save to local config
        localConfigService.saveConfig("jdbc." + path, String.valueOf(value), "jdbc");

        // Publish event
        JdbcConfigChangeEvent event = new JdbcConfigChangeEvent(oldConfig, this.configCurrent);
        eventPublisher.publishEvent(event);

        System.out.println("JdbcConfigService: Config updated: path=" + path + ", value=" + value);
        System.out.println("Event published: " + event);
    }

    private JdbcConfig cloneConfig(JdbcConfig config) {
        return new JdbcConfig(config.getUrl(), config.getUsername(), config.getPassword(), config.getDriverClassName());
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

