package app.controller;

import app.pojo.ApiResponse;
import app.pojo.JdbcConfigUpdateRequest;
import app.pojo.JdbcConfig;
import app.pojo.JdbcConnectionStatus;
import app.service.JdbcConfigService;
import app.service.JdbcConnectionService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/jdbc/")
public class JdbcConfigController {

    private final JdbcConfigService configService;
    private final JdbcConnectionService connectionService;

    public JdbcConfigController(
            JdbcConfigService configService,
            JdbcConnectionService connectionService) {
        this.configService = configService;
        this.connectionService = connectionService;
    }

    @GetMapping("config/")
    public ApiResponse<JdbcConfig> getConfig() {
        return ApiResponse.success(configService.getCurrentConfig(), "Current JDBC configuration retrieved");
    }

    @PostMapping("config/set/")
    public ApiResponse<JdbcConfig> setConfig(@RequestBody JdbcConfigUpdateRequest request) {
        try {
            configService.updateConfig(request.getPath(), request.getValue());
            return ApiResponse.success(configService.getCurrentConfig(), "JDBC configuration updated successfully");
        } catch (Exception e) {
            System.err.println("Failed to update config: " + e.getMessage());
            return ApiResponse.error(400, "Failed to update config: " + e.getMessage());
        }
    }

    @GetMapping("status/")
    public ApiResponse<JdbcConnectionStatus> getStatus() {
        try {
            JdbcConnectionStatus status = connectionService.getStatus();
            if (status.isConnected()) {
                return new ApiResponse<>(0, status, "Connected");
            } else {
                return new ApiResponse<>(-1, status, "Not connected");
            }
        } catch (Exception e) {
            System.err.println("Failed to get connection status: " + e.getMessage());
            return new ApiResponse<>(-2, null, "Failed to retrieve status: " + e.getMessage());
        }
    }

    @PostMapping("connection/stop/")
    public ApiResponse<Void> stopConnection() {
        try {
            connectionService.stopConnection();
            return new ApiResponse<>(0, null, "Connection stopped successfully");
        } catch (Exception e) {
            System.err.println("Failed to stop connection: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to stop connection: " + e.getMessage());
        }
    }

    @PostMapping("connection/start/")
    public ApiResponse<JdbcConfig> startConnection() {
        try {
            connectionService.startConnection(configService.getCurrentConfig());
            return new ApiResponse<>(0, configService.getCurrentConfig(), "Connection started successfully");
        } catch (Exception e) {
            System.err.println("Failed to start connection: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to start connection: " + e.getMessage());
        }
    }

    @PostMapping("test/")
    public ApiResponse<String> testConnection() {
        try {
            String result = connectionService.testConnection();
            return new ApiResponse<>(0, result, "Connection test successful");
        } catch (Exception e) {
            System.err.println("Connection test failed: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Connection test failed: " + e.getMessage());
        }
    }
}
