package app.controller;

import app.pojo.ApiResponse;
import app.service.MongoIndexQueueService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Controller for managing __IndexQueue__ collections
 */
@RestController
@RequestMapping("/mongo-index-queue")
public class MongoIndexQueueController {

    @Autowired
    private MongoIndexQueueService indexQueueService;

    /**
     * Check if index exists on __IndexQueue__ collection
     * Query params: database
     */
    @GetMapping("/index-exists")
    public ApiResponse<Map<String, Object>> checkIndexQueueIndex(@RequestParam String database) {
        try {
            boolean exists = indexQueueService.indexQueueIndexExists(database);
            return new ApiResponse<>(0, Map.of("database", database, "exists", exists), 
                "Index check completed");
        } catch (Exception e) {
            System.err.println("Failed to check index: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to check index: " + e.getMessage());
        }
    }

    /**
     * Create compound index on (status, updateVersion) in __IndexQueue__
     * Query params: database
     */
    @PostMapping("/create-index")
    public ApiResponse<Map<String, Object>> createIndexQueueIndex(@RequestParam String database) {
        try {
            Map<String, Object> result = indexQueueService.createIndexQueueIndex(database);
            
            if ((Integer) result.get("code") != 0) {
                return new ApiResponse<>(-1, null, (String) result.get("message"));
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) result.get("data");
            return new ApiResponse<>(0, data, (String) result.get("message"));
        } catch (Exception e) {
            System.err.println("Failed to create index: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to create index: " + e.getMessage());
        }
    }

    /**
     * List all indexes on __IndexQueue__ collection
     * Query params: database
     */
    @GetMapping("/list-indexes")
    public ApiResponse<List<Map<String, Object>>> listIndexQueueIndexes(@RequestParam String database) {
        try {
            List<Map<String, Object>> indexes = indexQueueService.listIndexQueueIndexes(database);
            return new ApiResponse<>(0, indexes, "Indexes retrieved successfully");
        } catch (Exception e) {
            System.err.println("Failed to list indexes: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to list indexes: " + e.getMessage());
        }
    }
}
