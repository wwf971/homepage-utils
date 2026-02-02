package app.service;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.rabbitmq.client.Channel;

import app.config.RabbitMQConfig;

@Service
public class RabbitMQTaskExecuteService {

    @Autowired
    private StompPublishService stompPublishService;

    @Autowired
    private MessageConverter messageConverter;

    // Define which task types this consumer can handle
    private static final Set<String> SUPPORTED_TASK_TYPES = Set.of(
        "example-task"
        // Add more task types here as needed
        // "rebuild-index",
        // "sync-data"
    );

    // Autowire other services that might be needed for task execution
    // For example:
    // @Autowired
    // private MongoIndexService mongoIndexService;
    //
    // @Autowired
    // private ElasticSearchService elasticSearchService;

    /**
     * Listen for tasks from the queue and execute them
     * Using manual acknowledgment mode for better control
     */
    @RabbitListener(queues = RabbitMQConfig.TASK_QUEUE, containerFactory = "rabbitListenerContainerFactory")
    public void executeTask(Message message, Channel channel) throws IOException {
        String taskId = null;
        String taskType = null;
        long deliveryTag = message.getMessageProperties().getDeliveryTag();
        
        try {
            // Step 1: Check message headers to see if we can handle this task type
            taskType = (String) message.getMessageProperties().getHeader("taskType");
            
            if (taskType == null || taskType.isEmpty()) {
                System.err.println("Message missing taskType header, rejecting");
                // Reject without requeue - malformed message
                channel.basicReject(deliveryTag, false);
                return;
            }
            
            // Step 2: Check if this consumer supports this task type
            if (!SUPPORTED_TASK_TYPES.contains(taskType)) {
                System.err.println("Unsupported task type: " + taskType + ", rejecting");
                // Reject with requeue - another consumer might handle it
                channel.basicReject(deliveryTag, true);
                return;
            }
            
            // Step 3: Parse message body
            @SuppressWarnings("unchecked")
            Map<String, Object> messageBody = (Map<String, Object>) messageConverter.fromMessage(message);
            
            @SuppressWarnings("unchecked")
            Map<String, Object> payload = (Map<String, Object>) messageBody.get("payload");
            Long timestamp = messageBody.get("timestamp") != null ? 
                ((Number) messageBody.get("timestamp")).longValue() : null;
            
            // Extract task ID from payload (where the controller puts it)
            taskId = payload != null && payload.containsKey("id") ? 
                (String) payload.get("id") : UUID.randomUUID().toString();

            System.out.println("Received task: " + taskType + " (id: " + taskId + ", timestamp: " + timestamp + ")");

            // Publish task received notification via STOMP
            publishTaskReceived(taskType, taskId);

            // Step 4: Execute the task based on task type
            switch (taskType) {
                case "example-task":
                    handleExampleTask(payload);
                    break;
                
                // Add more task types here as needed
                // case "rebuild-index":
                //     handleRebuildIndex(payload);
                //     break;
                
                default:
                    System.err.println("Unknown task type: " + taskType);
                    // Reject without requeue - we claim to support it but don't
                    channel.basicReject(deliveryTag, false);
                    return;
            }

            System.out.println("Task completed: " + taskType + " (id: " + taskId + ")");
            
            // Step 5: Acknowledge only after successful execution
            channel.basicAck(deliveryTag, false);
            
        } catch (Exception e) {
            System.err.println("Failed to execute task" + 
                (taskType != null ? " (" + taskType + ")" : "") + 
                (taskId != null ? " [id: " + taskId + "]" : "") + 
                ": " + e.getMessage());
            e.printStackTrace();
            
            // Reject the message and requeue it for retry
            // In production, you might want to:
            // - Track retry count in message headers
            // - Send to dead letter queue after max retries
            // - Use exponential backoff
            try {
                channel.basicNack(deliveryTag, false, true);
            } catch (IOException ioException) {
                System.err.println("Failed to nack message: " + ioException.getMessage());
            }
        }
    }

    /**
     * Publish task received notification via STOMP
     */
    private void publishTaskReceived(String taskType, String taskId) {
        try {
            Map<String, Object> notification = new HashMap<>();
            notification.put("type", taskType);
            notification.put("id", taskId);
            notification.put("timestamp", System.currentTimeMillis());
            
            stompPublishService.publishToTopic("rabbitmq/task-message/receive", notification);
        } catch (Exception e) {
            System.err.println("Failed to publish task received notification: " + e.getMessage());
        }
    }

    /**
     * Example task handler - for testing RabbitMQ + STOMP integration
     */
    private void handleExampleTask(Map<String, Object> payload) {
        System.out.println("Executing example task with payload: " + payload);
        // Simulate some work
        try {
            Thread.sleep(100);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    // Add more task handlers as needed
    // private void handleRebuildIndex(Map<String, Object> payload) {
    //     String indexName = (String) payload.get("indexName");
    //     mongoIndexService.rebuildIndex(indexName, null);
    // }
}
