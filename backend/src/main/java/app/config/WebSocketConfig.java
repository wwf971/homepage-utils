package app.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * WebSocket Configuration for STOMP messaging
 * 
 * This enables STOMP over WebSocket for real-time communication between server and clients.
 * Used for pushing task completion notifications from RabbitMQ consumers to frontend.
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    /**
     * Configure message broker
     * - Enable simple broker for /topic destinations (pub/sub messaging)
     * - Set application destination prefix to /app for sending messages
     */
    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Enable a simple in-memory message broker to send messages to clients subscribed to /topic
        config.enableSimpleBroker("/topic");
        
        // Prefix for messages bound for methods annotated with @MessageMapping
        config.setApplicationDestinationPrefixes("/app");
        
        System.out.println("Message broker configured: /topic for subscriptions, /app for client messages");
    }

    /**
     * Register STOMP endpoints
     * - Add /ws endpoint for WebSocket connections
     * - Enable SockJS fallback for browsers that don't support WebSocket
     * - Allow all origins (adjust in production for security)
     */
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")  // Allow all origins (adjust for production)
                .withSockJS();  // Enable SockJS fallback
        
        System.out.println("STOMP endpoint registered at /ws with SockJS support");
    }
}
