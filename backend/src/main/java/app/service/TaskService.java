package app.service;

import app.pojo.Task;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class TaskService {
    
    private final Map<String, Task> tasks = new ConcurrentHashMap<>();
    
    @Autowired
    private StompPublishService stompPublishService;
    
    /**
     * Create a new task
     */
    public Task createTask(String type, Map<String, Object> params) {
        String taskId = UUID.randomUUID().toString();
        Task task = new Task(taskId, type, params);
        tasks.put(taskId, task);
        return task;
    }
    
    /**
     * Get a task by ID
     */
    public Task getTask(String taskId) {
        return tasks.get(taskId);
    }
    
    /**
     * Update task progress and publish via STOMP
     */
    public void updateProgress(String taskId, int totalDocs, int processedDocs) {
        Task task = tasks.get(taskId);
        if (task != null) {
            task.setTotalDocs(totalDocs);
            task.setProcessedDocs(processedDocs);
            publishTaskUpdate(task);
        }
    }
    
    /**
     * Add error to task
     */
    public void addError(String taskId, String error) {
        Task task = tasks.get(taskId);
        if (task != null) {
            task.addError(error);
        }
    }
    
    /**
     * Mark task as completed
     */
    public void completeTask(String taskId, Map<String, Object> result) {
        Task task = tasks.get(taskId);
        if (task != null) {
            task.setStatus("completed");
            task.setEndTime(System.currentTimeMillis());
            task.setResult(result);
            publishTaskUpdate(task);
        }
    }
    
    /**
     * Mark task as failed
     */
    public void failTask(String taskId, String errorMessage) {
        Task task = tasks.get(taskId);
        if (task != null) {
            task.setStatus("failed");
            task.setEndTime(System.currentTimeMillis());
            task.addError(errorMessage);
            publishTaskUpdate(task);
        }
    }
    
    /**
     * Publish task update via STOMP
     */
    private void publishTaskUpdate(Task task) {
        Map<String, Object> message = new HashMap<>();
        message.put("taskId", task.getTaskId());
        message.put("type", task.getType());
        message.put("status", task.getStatus());
        message.put("totalDocs", task.getTotalDocs());
        message.put("processedDocs", task.getProcessedDocs());
        message.put("remainingDocs", task.getRemainingDocs());
        message.put("errors", task.getErrors());
        message.put("errorCount", task.getErrors().size());
        
        if (task.getEndTime() != null) {
            message.put("endTime", task.getEndTime());
            message.put("duration", task.getEndTime() - task.getStartTime());
        }
        
        if (task.getResult() != null) {
            message.put("result", task.getResult());
        }
        
        // Publish to task/{taskId}
        stompPublishService.publishToTopic("task/" + task.getTaskId(), message);
    }
    
    /**
     * Remove task from memory (cleanup)
     */
    public void removeTask(String taskId) {
        tasks.remove(taskId);
    }
}
