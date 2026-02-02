package app.service;

import java.util.HashMap;
import java.util.Map;

import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import app.config.RabbitMQConfig;

@Service
public class RabbitMQTaskPublishService {

    @Autowired(required = false)
    @Lazy
    private RabbitTemplate rabbitTemplate;

    @Autowired(required = false)
    @Lazy
    private MessageConverter messageConverter;

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
            // Create message body
            Map<String, Object> messageBody = new HashMap<>();
            messageBody.put("payload", payload);
            messageBody.put("timestamp", System.currentTimeMillis());

            // Create message properties with headers
            MessageProperties properties = new MessageProperties();
            properties.setHeader("taskType", taskType);
            properties.setContentType("application/json");

            // Convert body to bytes using the message converter
            Message message = messageConverter.toMessage(messageBody, properties);

            // Send the message
            rabbitTemplate.send(
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
