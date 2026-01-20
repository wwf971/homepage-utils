package app.service;

import app.config.RabbitMQConfig;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class RabbitMQTaskExecuteService {

    @Autowired
    private StompPublishService stompPublishService;

    // Autowire other services that might be needed for task execution
    // For example:
    // @Autowired
    // private MongoIndexService mongoIndexService;
    //
    // @Autowired
    // private ElasticSearchService elasticSearchService;

    /**
     * Listen for tasks from the queue and execute them
     */
    @RabbitListener(queues = RabbitMQConfig.TASK_QUEUE)
    public void executeTask(Map<String, Object> message) {
        String taskId = null;
        String taskType = null;
        
        try {
            taskType = (String) message.get("taskType");
            @SuppressWarnings("unchecked")
            Map<String, Object> payload = (Map<String, Object>) message.get("payload");
            Long timestamp = message.get("timestamp") != null ? 
                ((Number) message.get("timestamp")).longValue() : null;
            
            // Extract task ID from payload (where the controller puts it)
            taskId = payload != null && payload.containsKey("id") ? 
                (String) payload.get("id") : UUID.randomUUID().toString();

            System.out.println("Received task: " + taskType + " (id: " + taskId + ", timestamp: " + timestamp + ")");

            // Publish task received notification via STOMP
            publishTaskReceived(taskType, taskId);

            // Route to appropriate handler based on task type
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
                    break;
            }

            System.out.println("Task completed: " + taskType + " (id: " + taskId + ")");
        } catch (Exception e) {
            System.err.println("Failed to execute task: " + e.getMessage());
            e.printStackTrace();
            // In a production system, you might want to:
            // - Send to a dead letter queue
            // - Retry with exponential backoff
            // - Alert monitoring systems
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
