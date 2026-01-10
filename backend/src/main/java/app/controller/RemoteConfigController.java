package app.controller;

import app.pojo.ApiResponse;
import app.service.LocalConfigService;
import app.service.RemoteConfigService;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * Controller for managing remote config stored in MongoDB
 */
@RestController
@RequestMapping("/remote_config")
public class RemoteConfigController {
    
    private final RemoteConfigService remoteConfigService;
    private final LocalConfigService localConfigService;
    
    public RemoteConfigController(
            RemoteConfigService remoteConfigService,
            LocalConfigService localConfigService) {
        this.remoteConfigService = remoteConfigService;
        this.localConfigService = localConfigService;
    }
    
    /**
     * Get all remote config for a category
     * GET /remote_config/category/{category}/
     */
    @GetMapping("/category/{category}/")
    public ApiResponse<Map<String, String>> getRemoteConfig(@PathVariable String category) {
        try {
            Map<String, String> config = remoteConfigService.getRemoteConfig(category);
            return new ApiResponse<>(0, config, "Success");
        } catch (Exception e) {
            return new ApiResponse<>(-1, null, "Failed to get remote config: " + e.getMessage());
        }
    }
    
    /**
     * Save a config value to remote MongoDB
     * POST /remote_config/category/{category}/set/
     * Body: { "key": "url", "value": "..." }
     */
    @PostMapping("/category/{category}/set/")
    public ApiResponse<String> setRemoteConfig(
            @PathVariable String category,
            @RequestBody Map<String, String> request) {
        try {
            String key = request.get("key");
            String value = request.get("value");
            
            if (key == null || value == null) {
                return new ApiResponse<>(-1, null, "Missing key or value");
            }
            
            remoteConfigService.saveRemoteConfig(category, key, value);
            return new ApiResponse<>(0, "Config saved successfully", "Success");
        } catch (Exception e) {
            return new ApiResponse<>(-1, null, "Failed to save remote config: " + e.getMessage());
        }
    }
    
    /**
     * Delete a config key from remote MongoDB
     * DELETE /remote_config/category/{category}/key/{key}/
     */
    @DeleteMapping("/category/{category}/key/{key}/")
    public ApiResponse<String> deleteRemoteConfig(
            @PathVariable String category,
            @PathVariable String key) {
        try {
            remoteConfigService.deleteRemoteConfig(category, key);
            return new ApiResponse<>(0, "Config deleted successfully", "Success");
        } catch (Exception e) {
            return new ApiResponse<>(-1, null, "Failed to delete remote config: " + e.getMessage());
        }
    }
    
    /**
     * Get remote config settings (from local config)
     * These special settings control remote config behavior
     * GET /remote_config/category/{category}/settings/
     */
    @GetMapping("/category/{category}/settings/")
    public ApiResponse<Map<String, String>> getRemoteConfigSettings(@PathVariable String category) {
        try {
            Map<String, String> settings = new HashMap<>();
            
            // Get special settings from local config (getConfig returns null if not found)
            String enabled = localConfigService.getConfig(category + ".remote.enabled");
            String useSameAsData = localConfigService.getConfig(category + ".remote.useSameAsData");
            String uri = localConfigService.getConfig(category + ".remote.uri");
            String database = localConfigService.getConfig(category + ".remote.database");
            String collection = localConfigService.getConfig(category + ".remote.collection");
            String documentName = localConfigService.getConfig(category + ".remote.documentName");
            
            settings.put("enabled", enabled != null ? enabled : "false");
            settings.put("useSameAsData", useSameAsData != null ? useSameAsData : "false");
            settings.put("uri", uri != null ? uri : "");
            settings.put("database", database != null ? database : "");
            settings.put("collection", collection != null ? collection : "");
            settings.put("documentName", documentName != null ? documentName : "");
            
            return new ApiResponse<>(0, settings, "Success");
        } catch (Exception e) {
            return new ApiResponse<>(-1, null, "Failed to get remote config settings: " + e.getMessage());
        }
    }
    
    /**
     * Update remote config settings (stored in local config)
     * POST /remote_config/category/{category}/settings/
     * Body: { "key": "enabled", "value": "true" }
     */
    @PostMapping("/category/{category}/settings/")
    public ApiResponse<String> updateRemoteConfigSettings(
            @PathVariable String category,
            @RequestBody Map<String, String> request) {
        try {
            String key = request.get("key");
            String value = request.get("value");
            
            if (key == null || value == null) {
                return new ApiResponse<>(-1, null, "Missing key or value");
            }
            
            // Save to local config with remote prefix
            localConfigService.saveConfig(category + ".remote." + key, value, category);
            
            return new ApiResponse<>(0, "Remote config settings updated successfully", "Success");
        } catch (Exception e) {
            return new ApiResponse<>(-1, null, "Failed to update remote config settings: " + e.getMessage());
        }
    }
    
    /**
     * Check remote MongoDB status (connection, database, collection, document existence)
     * GET /remote_config/category/{category}/status/
     */
    @GetMapping("/category/{category}/status/")
    public ApiResponse<Map<String, Object>> checkRemoteConfigStatus(@PathVariable String category) {
        try {
            Map<String, Object> statusData = remoteConfigService.checkStatus(category);
            return new ApiResponse<>(0, statusData, "Success");
        } catch (Exception e) {
            return new ApiResponse<>(-1, null, "Failed to check status: " + e.getMessage());
        }
    }
    
    /**
     * Create database resource (database, collection, or document)
     * POST /remote_config/category/{category}/create/{resourceType}/
     */
    @PostMapping("/category/{category}/create/{resourceType}/")
    public ApiResponse<String> createDatabaseResource(
            @PathVariable String category,
            @PathVariable String resourceType) {
        try {
            remoteConfigService.createResource(category, resourceType);
            return new ApiResponse<>(0, resourceType + " created successfully", "Success");
        } catch (Exception e) {
            return new ApiResponse<>(-1, null, "Failed to create " + resourceType + ": " + e.getMessage());
        }
    }
}

