package app.controller;

import app.pojo.ApiResponse;
import app.pojo.RedisConfig;
import app.pojo.RedisConfigUpdateRequest;
import app.service.RedisConfigService;
import org.redisson.api.RedissonClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import redis.clients.jedis.Jedis;

@RestController
@RequestMapping("/redis/")
public class RedisController {

    private final RedisConfigService configService;
    
    @Autowired(required = false)
    private RedissonClient redissonClient;

    public RedisController(RedisConfigService configService) {
        this.configService = configService;
        System.out.println("RedisController initialized successfully");
    }

    /**
     * Test Redis connection directly using Jedis
     */
    @PostMapping("test/")
    public ApiResponse<String> testConnection() {
        try {
            RedisConfig config = configService.getConfigCurrent();
            
            if (config.getHost() == null || config.getHost().isEmpty()) {
                return ApiResponse.error(-1, "Redis host not configured");
            }
            
            String host = config.getHost();
            int port = config.getPort();
            int timeout = config.getTimeout();
            
            // Create Jedis connection
            Jedis jedis = null;
            try {
                // Don't provide username/password if both are empty
                String username = config.getUsername();
                String password = config.getPassword();
                
                if ((username == null || username.isEmpty()) && (password == null || password.isEmpty())) {
                    jedis = new Jedis(host, port, timeout);
                } else if (password != null && !password.isEmpty()) {
                    jedis = new Jedis(host, port, timeout);
                    if (username != null && !username.isEmpty()) {
                        jedis.auth(username, password);
                    } else {
                        jedis.auth(password);
                    }
                }
                
                // Test PING
                String response = jedis.ping();
                
                if ("PONG".equals(response)) {
                    return new ApiResponse<>(
                        0,
                        "Connection successful! Redis responded with: " + response,
                        "Redis connection test successful"
                    );
                } else {
                    return new ApiResponse<>(
                        -1,
                        null,
                        "Unexpected response from Redis: " + response
                    );
                }
            } finally {
                if (jedis != null) {
                    jedis.close();
                }
            }
        } catch (redis.clients.jedis.exceptions.JedisConnectionException e) {
            return ApiResponse.error(-1, "Connection failed: " + e.getMessage());
        } catch (redis.clients.jedis.exceptions.JedisDataException e) {
            return ApiResponse.error(-1, "Authentication failed: " + e.getMessage());
        } catch (Exception e) {
            System.err.println("Redis connection test failed: " + e.getMessage());
            e.printStackTrace();
            return ApiResponse.error(-1, "Connection test failed: " + e.getMessage());
        }
    }

    /**
     * Test Redisson connection (distributed lock library)
     */
    @PostMapping("test-redisson/")
    public ApiResponse<String> testRedissonConnection() {
        try {
            // Check if redissonClient bean exists (might be null if initialization failed earlier)
            if (redissonClient == null) {
                return ApiResponse.error(-1, "Redisson client not initialized. Check Redis configuration in application.properties.");
            }
            
            // Try to access redisson client - this will trigger lazy initialization if not yet done
            // Test by trying to get a lock
            String testLockKey = "test-lock:" + System.currentTimeMillis();
            org.redisson.api.RLock lock = null;
            
            try {
                lock = redissonClient.getLock(testLockKey);
            } catch (Exception e) {
                // Initialization or connection failed
                return ApiResponse.error(-1, "Failed to connect to Redis server: " + e.getMessage() + 
                    ". Check that Redis is running at the configured host and port.");
            }
            
            boolean acquired = lock.tryLock(1, 5, java.util.concurrent.TimeUnit.SECONDS);
            
            if (acquired) {
                try {
                    // Test successful - we got the lock
                    return new ApiResponse<>(
                        0,
                        "Connection successful! Redisson is working properly. Test lock acquired and released.",
                        "Redisson connection test successful"
                    );
                } finally {
                    lock.unlock();
                }
            } else {
                return new ApiResponse<>(
                    -1,
                    null,
                    "Could not acquire test lock (timeout)"
                );
            }
        } catch (org.redisson.client.RedisConnectionException e) {
            System.err.println("Redisson connection failed: " + e.getMessage());
            return ApiResponse.error(-1, "Redis connection failed: " + e.getMessage() + 
                ". Check that Redis is running and accessible.");
        } catch (Exception e) {
            System.err.println("Redisson connection test failed: " + e.getMessage());
            e.printStackTrace();
            return ApiResponse.error(-1, "Redisson test failed: " + e.getMessage());
        }
    }

    @GetMapping("config/")
    public ApiResponse<RedisConfig> getConfig() {
        try {
            RedisConfig config = configService.getConfigCurrent();
            return ApiResponse.success(config, "Current Redis configuration retrieved");
        } catch (Exception e) {
            System.err.println("RedisController.getConfig() error: " + e.getMessage());
            e.printStackTrace();
            return ApiResponse.error(500, "Failed to get config: " + e.getMessage());
        }
    }

    @GetMapping("config/local/")
    public ApiResponse<RedisConfig> getLocalConfig() {
        try {
            RedisConfig config = configService.getLocalConfig();
            return ApiResponse.success(config, "Local Redis configuration retrieved");
        } catch (Exception e) {
            System.err.println("RedisController.getLocalConfig() error: " + e.getMessage());
            e.printStackTrace();
            return ApiResponse.error(500, "Failed to get local config: " + e.getMessage());
        }
    }

    @GetMapping("config/computed/")
    public ApiResponse<RedisConfig> getComputedConfig() {
        try {
            RedisConfig config = configService.getConfigCurrent();
            return ApiResponse.success(config, "Computed Redis configuration retrieved");
        } catch (Exception e) {
            System.err.println("RedisController.getComputedConfig() error: " + e.getMessage());
            e.printStackTrace();
            return ApiResponse.error(500, "Failed to get computed config: " + e.getMessage());
        }
    }

    @PostMapping("config/set/")
    public ApiResponse<RedisConfig> setConfig(@RequestBody RedisConfigUpdateRequest request) {
        try {
            configService.updateConfig(request.getPath(), request.getValue());
            return ApiResponse.success(configService.getConfigCurrent(), "Redis configuration updated successfully");
        } catch (Exception e) {
            System.err.println("Failed to update config: " + e.getMessage());
            return ApiResponse.error(400, "Failed to update config: " + e.getMessage());
        }
    }
}
