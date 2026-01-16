package app.service;

import app.config.RabbitMQConfig;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class RabbitMQTaskExecuteService {

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
        try {
            String taskType = (String) message.get("taskType");
            @SuppressWarnings("unchecked")
            Map<String, Object> payload = (Map<String, Object>) message.get("payload");
            Long timestamp = message.get("timestamp") != null ? 
                ((Number) message.get("timestamp")).longValue() : null;

            System.out.println("Received task: " + taskType + " (timestamp: " + timestamp + ")");

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

            System.out.println("Task completed: " + taskType);
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
     * Example task handler - replace with actual implementation
     */
    private void handleExampleTask(Map<String, Object> payload) {
        System.out.println("Executing example task with payload: " + payload);
        // Implement actual task logic here
    }

    // Add more task handlers as needed
    // private void handleRebuildIndex(Map<String, Object> payload) {
    //     String indexName = (String) payload.get("indexName");
    //     mongoIndexService.rebuildIndex(indexName, null);
    // }
}
