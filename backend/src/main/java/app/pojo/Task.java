package app.pojo;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Task model for tracking async operations
 */
public class Task {
    private String taskId;
    private String type; // e.g., "rebuild-collection"
    private String status; // "running", "completed", "failed"
    private Map<String, Object> params; // Task parameters
    private int totalDocs;
    private int processedDocs;
    private List<String> errors;
    private long startTime;
    private Long endTime;
    private Map<String, Object> result;

    public Task(String taskId, String type, Map<String, Object> params) {
        this.taskId = taskId;
        this.type = type;
        this.status = "running";
        this.params = params;
        this.totalDocs = 0;
        this.processedDocs = 0;
        this.errors = new ArrayList<>();
        this.startTime = System.currentTimeMillis();
    }

    // Getters and setters
    public String getTaskId() {
        return taskId;
    }

    public void setTaskId(String taskId) {
        this.taskId = taskId;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Map<String, Object> getParams() {
        return params;
    }

    public void setParams(Map<String, Object> params) {
        this.params = params;
    }

    public int getTotalDocs() {
        return totalDocs;
    }

    public void setTotalDocs(int totalDocs) {
        this.totalDocs = totalDocs;
    }

    public int getProcessedDocs() {
        return processedDocs;
    }

    public void setProcessedDocs(int processedDocs) {
        this.processedDocs = processedDocs;
    }

    public List<String> getErrors() {
        return errors;
    }

    public void setErrors(List<String> errors) {
        this.errors = errors;
    }

    public void addError(String error) {
        this.errors.add(error);
    }

    public long getStartTime() {
        return startTime;
    }

    public void setStartTime(long startTime) {
        this.startTime = startTime;
    }

    public Long getEndTime() {
        return endTime;
    }

    public void setEndTime(Long endTime) {
        this.endTime = endTime;
    }

    public Map<String, Object> getResult() {
        return result;
    }

    public void setResult(Map<String, Object> result) {
        this.result = result;
    }

    public int getRemainingDocs() {
        return totalDocs - processedDocs;
    }
}
