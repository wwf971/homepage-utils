package app.controller;

import app.pojo.ApiResponse;
import app.pojo.RabbitMQConfig;
import app.pojo.RabbitMQConfigUpdateRequest;
import app.service.RabbitMQConfigService;
import com.rabbitmq.client.Connection;
import com.rabbitmq.client.ConnectionFactory;
import org.springframework.amqp.rabbit.connection.CachingConnectionFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.HashMap;

@RestController
@RequestMapping("/rabbitmq/")
public class RabbitMQController {

    @Autowired
    private RabbitMQConfigService rabbitMQConfigService;

    /**
     * Get application.properties configuration
     */
    @GetMapping("config/")
    public ApiResponse<RabbitMQConfig> getAppConfig() {
        try {
            RabbitMQConfig config = rabbitMQConfigService.getAppConfig();
            return new ApiResponse<>(0, config, "RabbitMQ application config retrieved successfully");
        } catch (Exception e) {
            System.err.println("Failed to get RabbitMQ app config: " + e.getMessage());
            e.printStackTrace();
            return ApiResponse.error(-1, "Failed to get config: " + e.getMessage());
        }
    }

    /**
     * Get local configuration overrides
     */
    @GetMapping("config/local/")
    public ApiResponse<List<Map<String, String>>> getLocalConfig() {
        try {
            List<Map<String, String>> config = rabbitMQConfigService.getLocalConfigList();
            return new ApiResponse<>(0, config, "RabbitMQ local config retrieved successfully");
        } catch (Exception e) {
            System.err.println("Failed to get RabbitMQ local config: " + e.getMessage());
            e.printStackTrace();
            return ApiResponse.error(-1, "Failed to get local config: " + e.getMessage());
        }
    }

    /**
     * Get computed configuration (merged all layers)
     */
    @GetMapping("config/computed/")
    public ApiResponse<List<Map<String, String>>> getComputedConfig() {
        try {
            List<Map<String, String>> config = rabbitMQConfigService.getComputedConfigList();
            return new ApiResponse<>(0, config, "RabbitMQ computed config retrieved successfully");
        } catch (Exception e) {
            System.err.println("Failed to get RabbitMQ computed config: " + e.getMessage());
            e.printStackTrace();
            return ApiResponse.error(-1, "Failed to get computed config: " + e.getMessage());
        }
    }

    /**
     * Update local configuration
     */
    @PostMapping("config/set/")
    public ApiResponse<RabbitMQConfig> setConfig(@RequestBody RabbitMQConfigUpdateRequest request) {
        try {
            rabbitMQConfigService.updateConfig(request.getPath(), request.getValue());
            RabbitMQConfig updatedConfig = rabbitMQConfigService.getComputedConfig();
            return new ApiResponse<>(0, updatedConfig, "RabbitMQ config updated successfully");
        } catch (Exception e) {
            System.err.println("Failed to update RabbitMQ config: " + e.getMessage());
            e.printStackTrace();
            return ApiResponse.error(-1, "Failed to update config: " + e.getMessage());
        }
    }

    /**
     * Test RabbitMQ connection using provided or computed config
     */
    @PostMapping("test/")
    public ApiResponse<String> testConnection(@RequestBody(required = false) Map<String, Object> requestBody) {
        RabbitMQConfig config;
        
        if (requestBody != null && !requestBody.isEmpty()) {
            // Use provided config for testing
            config = new RabbitMQConfig();
            config.setHost((String) requestBody.get("host"));
            config.setPort(requestBody.get("port") != null ? 
                Integer.parseInt(requestBody.get("port").toString()) : 5672);
            config.setUsername((String) requestBody.get("username"));
            config.setPassword((String) requestBody.get("password"));
            config.setVirtualHost((String) requestBody.get("virtualHost"));
            config.setConnectionTimeout(requestBody.get("connectionTimeout") != null ? 
                Integer.parseInt(requestBody.get("connectionTimeout").toString()) : 5000);
        } else {
            // Use computed config
            config = rabbitMQConfigService.getComputedConfig();
        }

        // Validate required fields
        if (config.getHost() == null || config.getHost().trim().isEmpty()) {
            return ApiResponse.error(-1, "Host is required");
        }

        try {
            // Create a test connection using RabbitMQ client library
            ConnectionFactory factory = new ConnectionFactory();
            factory.setHost(config.getHost());
            factory.setPort(config.getPort() != null ? config.getPort() : 5672);
            factory.setVirtualHost(config.getVirtualHost() != null && !config.getVirtualHost().isEmpty() ? 
                config.getVirtualHost() : "/");
            factory.setConnectionTimeout(config.getConnectionTimeout() != null ? 
                config.getConnectionTimeout() : 5000);
            
            if (config.getUsername() != null && !config.getUsername().isEmpty()) {
                factory.setUsername(config.getUsername());
            }
            if (config.getPassword() != null && !config.getPassword().isEmpty()) {
                factory.setPassword(config.getPassword());
            }

            // Try to establish connection
            Connection connection = factory.newConnection();
            
            // Get server properties to verify connection
            Map<String, Object> serverProperties = connection.getServerProperties();
            String version = serverProperties.get("version") != null ? 
                serverProperties.get("version").toString() : "unknown";
            
            connection.close();
            
            return new ApiResponse<>(
                0,
                "Connection successful! RabbitMQ server version: " + version,
                "RabbitMQ connection test successful"
            );
        } catch (java.net.UnknownHostException e) {
            return ApiResponse.error(-1, "Unknown host: " + config.getHost() + ". Check host configuration.");
        } catch (java.net.ConnectException e) {
            return ApiResponse.error(-1, "Connection refused. Is RabbitMQ running at " + 
                config.getHost() + ":" + config.getPort() + "?");
        } catch (java.net.SocketTimeoutException e) {
            return ApiResponse.error(-1, "Connection timeout. RabbitMQ server at " + 
                config.getHost() + ":" + config.getPort() + " is not responding.");
        } catch (com.rabbitmq.client.AuthenticationFailureException e) {
            return ApiResponse.error(-1, "Authentication failed. Check username and password.");
        } catch (Exception e) {
            System.err.println("RabbitMQ connection test failed: " + e.getMessage());
            e.printStackTrace();
            return ApiResponse.error(-1, "Connection test failed: " + e.getMessage());
        }
    }
}
