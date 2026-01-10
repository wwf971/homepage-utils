package app.controller;

import app.pojo.ApiResponse;
import app.service.LocalConfigService;
import app.service.RemoteConfigService;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * MongoDB-specific remote config controller with shorter URLs
 */
@RestController
@RequestMapping("/mongo/remote_config")
public class MongoRemoteConfigController {
    
    private static final String CATEGORY = "mongo";
    
    private final RemoteConfigService remoteConfigService;
    private final LocalConfigService localConfigService;
    
    public MongoRemoteConfigController(
            RemoteConfigService remoteConfigService,
            LocalConfigService localConfigService) {
        this.remoteConfigService = remoteConfigService;
        this.localConfigService = localConfigService;
    }
    
    /**
     * Get all remote config values
     * GET /mongo/remote_config/
     */
    @GetMapping("/")
    public ApiResponse<Map<String, String>> getRemoteConfig() {
        try {
            Map<String, String> config = remoteConfigService.getRemoteConfig(CATEGORY);
            return new ApiResponse<>(0, config, "Success");
        } catch (Exception e) {
            return new ApiResponse<>(-1, null, "Failed to get remote config: " + e.getMessage());
        }
    }
    
    /**
     * Save a config value to remote MongoDB
     * POST /mongo/remote_config/set/
     * Body: { "key": "uri", "value": "..." }
     */
    @PostMapping("/set/")
    public ApiResponse<String> setRemoteConfig(@RequestBody Map<String, String> request) {
        try {
            String key = request.get("key");
            String value = request.get("value");
            
            if (key == null || value == null) {
                return new ApiResponse<>(-1, null, "Missing key or value");
            }
            
            remoteConfigService.saveRemoteConfig(CATEGORY, key, value);
            return new ApiResponse<>(0, "Config saved successfully", "Success");
        } catch (Exception e) {
            return new ApiResponse<>(-1, null, "Failed to save remote config: " + e.getMessage());
        }
    }
    
    /**
     * Get remote config settings (stored in local config)
     * GET /mongo/remote_config/settings/
     */
    @GetMapping("/settings/")
    public ApiResponse<Map<String, String>> getRemoteConfigSettings() {
        try {
            Map<String, String> settings = new HashMap<>();
            
            String enabled = localConfigService.getConfig(CATEGORY + ".remote.enabled");
            String useSameAsData = localConfigService.getConfig(CATEGORY + ".remote.useSameAsData");
            String uri = localConfigService.getConfig(CATEGORY + ".remote.uri");
            String database = localConfigService.getConfig(CATEGORY + ".remote.database");
            String collection = localConfigService.getConfig(CATEGORY + ".remote.collection");
            String documentName = localConfigService.getConfig(CATEGORY + ".remote.documentName");
            
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
     * Update remote config settings
     * POST /mongo/remote_config/settings/
     * Body: { "key": "enabled", "value": "true" }
     */
    @PostMapping("/settings/")
    public ApiResponse<String> updateRemoteConfigSettings(@RequestBody Map<String, String> request) {
        try {
            String key = request.get("key");
            String value = request.get("value");
            
            if (key == null || value == null) {
                return new ApiResponse<>(-1, null, "Missing key or value");
            }
            
            localConfigService.saveConfig(CATEGORY + ".remote." + key, value, CATEGORY);
            
            return new ApiResponse<>(0, "Remote config settings updated successfully", "Success");
        } catch (Exception e) {
            return new ApiResponse<>(-1, null, "Failed to update remote config settings: " + e.getMessage());
        }
    }
    
    /**
     * Check remote MongoDB status
     * GET /mongo/remote_config/status/
     */
    @GetMapping("/status/")
    public ApiResponse<Map<String, Object>> checkRemoteConfigStatus() {
        try {
            Map<String, Object> statusData = remoteConfigService.checkStatus(CATEGORY);
            return new ApiResponse<>(0, statusData, "Success");
        } catch (Exception e) {
            return new ApiResponse<>(-1, null, "Failed to check status: " + e.getMessage());
        }
    }
    
    /**
     * Create database resource
     * POST /mongo/remote_config/create/{resourceType}/
     */
    @PostMapping("/create/{resourceType}/")
    public ApiResponse<String> createDatabaseResource(@PathVariable String resourceType) {
        try {
            remoteConfigService.createResource(CATEGORY, resourceType);
            return new ApiResponse<>(0, resourceType + " created successfully", "Success");
        } catch (Exception e) {
            return new ApiResponse<>(-1, null, "Failed to create " + resourceType + ": " + e.getMessage());
        }
    }
}

