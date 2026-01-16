package app.service;

import app.pojo.RabbitMQConfig;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class RabbitMQConfigService {

    @Autowired
    private LocalConfigService localConfigService;

    @Value("${spring.rabbitmq.host:localhost}")
    private String host;

    @Value("${spring.rabbitmq.port:5672}")
    private int port;

    @Value("${spring.rabbitmq.username:}")
    private String username;

    @Value("${spring.rabbitmq.password:}")
    private String password;

    @Value("${spring.rabbitmq.virtual-host:/}")
    private String virtualHost;

    @Value("${spring.rabbitmq.connection-timeout:5000}")
    private int connectionTimeout;

    /**
     * Get application.properties config (base layer)
     */
    public RabbitMQConfig getAppConfig() {
        return new RabbitMQConfig(host, port, username, password, virtualHost, connectionTimeout);
    }

    /**
     * Get local config overrides (second layer)
     */
    public RabbitMQConfig getLocalConfig() {
        String localHost = localConfigService.getConfig("rabbitmq.host");
        String localPort = localConfigService.getConfig("rabbitmq.port");
        String localUsername = localConfigService.getConfig("rabbitmq.username");
        String localPassword = localConfigService.getConfig("rabbitmq.password");
        String localVirtualHost = localConfigService.getConfig("rabbitmq.virtualHost");
        String localConnectionTimeout = localConfigService.getConfig("rabbitmq.connectionTimeout");
        
        return new RabbitMQConfig(
            localHost,
            parseInteger(localPort),
            localUsername,
            localPassword,
            localVirtualHost,
            parseInteger(localConnectionTimeout)
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

    /**
     * Get final computed config (all layers merged)
     */
    public RabbitMQConfig getComputedConfig() {
        return mergeAllLayers(host, port, username, password, virtualHost, connectionTimeout);
    }

    /**
     * Merge all configuration layers
     */
    private RabbitMQConfig mergeAllLayers(String host, Integer port, String username, String password, 
                                          String virtualHost, Integer connectionTimeout) {
        // Layer 1: application.properties (base)
        // Already provided as parameters
        
        // Layer 2: Local overrides
        String localHost = localConfigService.getConfig("rabbitmq.host");
        String localPort = localConfigService.getConfig("rabbitmq.port");
        String localUsername = localConfigService.getConfig("rabbitmq.username");
        String localPassword = localConfigService.getConfig("rabbitmq.password");
        String localVirtualHost = localConfigService.getConfig("rabbitmq.virtualHost");
        String localConnectionTimeout = localConfigService.getConfig("rabbitmq.connectionTimeout");
        
        if (localHost != null && !localHost.trim().isEmpty()) host = localHost;
        if (localPort != null && !localPort.trim().isEmpty()) {
            Integer parsedPort = parseInteger(localPort);
            if (parsedPort != null) port = parsedPort;
        }
        if (localUsername != null) username = localUsername;
        if (localPassword != null) password = localPassword;
        if (localVirtualHost != null && !localVirtualHost.trim().isEmpty()) virtualHost = localVirtualHost;
        if (localConnectionTimeout != null && !localConnectionTimeout.trim().isEmpty()) {
            Integer parsedTimeout = parseInteger(localConnectionTimeout);
            if (parsedTimeout != null) connectionTimeout = parsedTimeout;
        }
        
        return new RabbitMQConfig(host, port, username, password, virtualHost, connectionTimeout);
    }

    /**
     * Update local config
     */
    public void updateConfig(String path, String value) {
        // Map frontend paths to local config keys  
        String configKey = "rabbitmq." + path;
        localConfigService.saveConfig(configKey, value, "rabbitmq");
    }

    /**
     * Get local config as list of key-value pairs for frontend
     */
    public List<Map<String, String>> getLocalConfigList() {
        List<Map<String, String>> result = new ArrayList<>();
        
        addConfigPair(result, "host", localConfigService.getConfig("rabbitmq.host"));
        addConfigPair(result, "port", localConfigService.getConfig("rabbitmq.port"));
        addConfigPair(result, "username", localConfigService.getConfig("rabbitmq.username"));
        addConfigPair(result, "password", localConfigService.getConfig("rabbitmq.password"));
        addConfigPair(result, "virtualHost", localConfigService.getConfig("rabbitmq.virtualHost"));
        addConfigPair(result, "connectionTimeout", localConfigService.getConfig("rabbitmq.connectionTimeout"));
        
        return result;
    }

    /**
     * Get computed config as list of key-value pairs for frontend
     */
    public List<Map<String, String>> getComputedConfigList() {
        RabbitMQConfig config = getComputedConfig();
        List<Map<String, String>> result = new ArrayList<>();
        
        addConfigPair(result, "host", config.getHost());
        addConfigPair(result, "port", config.getPort() != null ? String.valueOf(config.getPort()) : null);
        addConfigPair(result, "username", config.getUsername());
        addConfigPair(result, "password", config.getPassword());
        addConfigPair(result, "virtualHost", config.getVirtualHost());
        addConfigPair(result, "connectionTimeout", config.getConnectionTimeout() != null ? String.valueOf(config.getConnectionTimeout()) : null);
        
        return result;
    }

    private void addConfigPair(List<Map<String, String>> list, String key, String value) {
        Map<String, String> pair = new HashMap<>();
        pair.put("key", key);
        pair.put("value", value != null ? value : "");
        list.add(pair);
    }
}
