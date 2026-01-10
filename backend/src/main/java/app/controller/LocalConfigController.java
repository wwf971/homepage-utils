package app.controller;

import app.pojo.ApiResponse;
import app.pojo.LocalConfig;
import app.service.LocalConfigPathService;
import app.service.LocalConfigService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/local_config/")
public class LocalConfigController {

    private final LocalConfigService localConfigService;
    private final LocalConfigPathService pathService;

    public LocalConfigController(LocalConfigService localConfigService, LocalConfigPathService pathService) {
        this.localConfigService = localConfigService;
        this.pathService = pathService;
    }

    @GetMapping("list/")
    public ApiResponse<List<LocalConfig>> listConfigs() {
        try {
            List<LocalConfig> configs = localConfigService.getAllConfigs();
            return new ApiResponse<>(0, configs, "Local configs retrieved successfully");
        } catch (Exception e) {
            System.err.println("Failed to list local configs: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to list configs: " + e.getMessage());
        }
    }

    @GetMapping("get/{key}/")
    public ApiResponse<LocalConfig> getConfig(@PathVariable String key) {
        try {
            LocalConfig config = localConfigService.getConfigFull(key);
            if (config == null) {
                return new ApiResponse<>(-1, null, "Config not found: " + key);
            }
            return new ApiResponse<>(0, config, "Config retrieved successfully");
        } catch (Exception e) {
            System.err.println("Failed to get config: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to get config: " + e.getMessage());
        }
    }

    @GetMapping("category/{category}/")
    public ApiResponse<Map<String, String>> getConfigsByCategory(@PathVariable String category) {
        try {
            Map<String, String> configs = localConfigService.getConfigsByCategory(category);
            return new ApiResponse<>(0, configs, "Configs for category retrieved successfully");
        } catch (Exception e) {
            System.err.println("Failed to get configs by category: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to get configs: " + e.getMessage());
        }
    }

    @DeleteMapping("delete/{key}/")
    public ApiResponse<Void> deleteConfig(@PathVariable String key) {
        try {
            localConfigService.deleteConfig(key);
            return new ApiResponse<>(0, null, "Config deleted successfully");
        } catch (Exception e) {
            System.err.println("Failed to delete config: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to delete config: " + e.getMessage());
        }
    }

    @GetMapping("info/")
    public ApiResponse<Map<String, Object>> getInfo() {
        try {
            Map<String, Object> info = Map.of(
                "path", pathService.getConfigFilePath(),
                "mode", pathService.isDevelopmentMode() ? "development" : "docker",
                "configCount", localConfigService.getAllConfigs().size()
            );
            return new ApiResponse<>(0, info, "Local config info retrieved successfully");
        } catch (Exception e) {
            System.err.println("Failed to get info: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to get info: " + e.getMessage());
        }
    }
}

