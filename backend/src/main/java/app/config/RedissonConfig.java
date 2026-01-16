package app.config;

import org.redisson.Redisson;
import org.redisson.api.RedissonClient;
import org.redisson.config.Config;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;

@Configuration
public class RedissonConfig {

    @Value("${spring.data.redis.host}")
    private String redisHost;

    @Value("${spring.data.redis.port}")
    private int redisPort;

    @Bean
    @Lazy // Make bean lazy - won't be created until first use
    public RedissonClient redissonClient() {
        try {
            Config config = new Config();
            config.useSingleServer()
                .setAddress("redis://" + redisHost + ":" + redisPort)
                .setConnectionPoolSize(10)
                .setConnectionMinimumIdleSize(2)
                .setConnectTimeout(3000)
                .setTimeout(3000)
                .setRetryAttempts(2)
                .setRetryInterval(1000)
                // Don't ping on startup - allow lazy connection
                .setPingConnectionInterval(0);
            
            System.out.println("Creating Redisson client for Redis at " + redisHost + ":" + redisPort);
            System.out.println("Note: Connection will be established on first use");
            
            return Redisson.create(config);
        } catch (Exception e) {
            System.err.println("WARNING: Failed to create Redisson client: " + e.getMessage());
            System.err.println("Continuing without Redisson - distributed locks will not be available");
            // Return null to allow application to continue
            return null;
        }
    }
}
