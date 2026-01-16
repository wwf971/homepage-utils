package app.service;

import app.config.RabbitMQConfig;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Service
public class RabbitMQTaskPublishService {

    @Autowired(required = false)
    @Lazy
    private RabbitTemplate rabbitTemplate;

    /**
     * Publish a task to the queue
     * @param taskType The type of task to execute
     * @param payload The task payload (parameters)
     * @return true if published successfully, false otherwise
     */
    public boolean publishTask(String taskType, Map<String, Object> payload) {
        if (rabbitTemplate == null) {
            System.err.println("RabbitTemplate not available. Cannot publish task. Is RabbitMQ configured?");
            return false;
        }

        try {
            Map<String, Object> message = new HashMap<>();
            message.put("taskType", taskType);
            message.put("payload", payload);
            message.put("timestamp", System.currentTimeMillis());

            rabbitTemplate.convertAndSend(
                RabbitMQConfig.TASK_EXCHANGE,
                RabbitMQConfig.TASK_ROUTING_KEY,
                message
            );

            System.out.println("Published task: " + taskType);
            return true;
        } catch (Exception e) {
            System.err.println("Failed to publish task: " + e.getMessage());
            e.printStackTrace();
            return false;
        }
    }

    /**
     * Check if RabbitMQ is available
     */
    public boolean isAvailable() {
        return rabbitTemplate != null;
    }
}
