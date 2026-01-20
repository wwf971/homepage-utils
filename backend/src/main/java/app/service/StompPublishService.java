package app.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class StompPublishService {

    @Autowired(required = false)
    @Lazy
    private SimpMessagingTemplate messagingTemplate;

    /**
     * Publish a message to a STOMP topic
     * @param topic The topic to publish to (e.g., "rabbitmq/task-message/receive")
     * @param message The message payload
     * @return true if published successfully, false otherwise
     */
    public boolean publishToTopic(String topic, Object message) {
        if (messagingTemplate == null) {
            System.err.println("SimpMessagingTemplate not available. Cannot publish to STOMP. Is WebSocket configured?");
            return false;
        }

        try {
            messagingTemplate.convertAndSend("/topic/" + topic, message);
            System.out.println("Published to STOMP topic: " + topic);
            return true;
        } catch (Exception e) {
            System.err.println("Failed to publish to STOMP topic: " + e.getMessage());
            e.printStackTrace();
            return false;
        }
    }

    /**
     * Check if STOMP messaging is available
     */
    public boolean isAvailable() {
        return messagingTemplate != null;
    }
}
