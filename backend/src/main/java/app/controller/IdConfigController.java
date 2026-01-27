package app.controller;

import app.pojo.ApiResponse;
import app.pojo.IdConfig;
import app.pojo.IdConfigUpdateRequest;
import app.pojo.IdTableCheckResult;
import app.pojo.IdTableStructureResult;
import app.service.IdConfigService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/id/")
public class IdConfigController {

    private final IdConfigService configService;

    public IdConfigController(IdConfigService configService) {
        this.configService = configService;
    }

    @GetMapping("config/app/")
    public ApiResponse<IdConfig> getAppConfig() {
        return ApiResponse.success(configService.getAppConfig(), "ID service application.properties configuration retrieved");
    }

    @GetMapping("config/")
    public ApiResponse<IdConfig> getConfig() {
        return ApiResponse.success(configService.getConfigCurrent(), "Current ID service configuration retrieved");
    }

    @PostMapping("config/set/")
    public ApiResponse<IdConfig> setConfig(@RequestBody IdConfigUpdateRequest request) {
        try {
            configService.updateConfig(request.getPath(), request.getValue());
            return ApiResponse.success(configService.getConfigCurrent(), "ID service configuration updated successfully");
        } catch (Exception e) {
            System.err.println("Failed to update config: " + e.getMessage());
            return ApiResponse.error(400, "Failed to update config: " + e.getMessage());
        }
    }

    @GetMapping("table/check/")
    public ApiResponse<IdTableCheckResult> checkTable() {
        try {
            IdTableCheckResult result = configService.checkTableExists();
            if (result.isExists()) {
                return ApiResponse.success(result, "Table exists");
            } else {
                return new ApiResponse<>(-1, result, result.getMessage());
            }
        } catch (Exception e) {
            System.err.println("Failed to check table: " + e.getMessage());
            return ApiResponse.error(500, "Failed to check table: " + e.getMessage());
        }
    }

    @GetMapping("table/structure/")
    public ApiResponse<IdTableStructureResult> checkTableStructure() {
        try {
            IdTableStructureResult result = configService.checkTableStructure();
            if (result.isExists()) {
                if (result.isHasValidStructure()) {
                    return ApiResponse.success(result, "Table structure is valid");
                } else {
                    return new ApiResponse<>(-1, result, "Table structure has issues");
                }
            } else {
                return new ApiResponse<>(-2, result, result.getMessage());
            }
        } catch (Exception e) {
            System.err.println("Failed to check table structure: " + e.getMessage());
            return ApiResponse.error(500, "Failed to check table structure: " + e.getMessage());
        }
    }

    @PostMapping("table/create/")
    public ApiResponse<IdTableCheckResult> createTable() {
        try {
            IdTableCheckResult result = configService.createTable();
            if (result.isExists()) {
                return ApiResponse.success(result, "Table created successfully");
            } else {
                return new ApiResponse<>(-1, result, result.getMessage());
            }
        } catch (Exception e) {
            System.err.println("Failed to create table: " + e.getMessage());
            return ApiResponse.error(500, "Failed to create table: " + e.getMessage());
        }
    }

    @PostMapping("table/delete/")
    public ApiResponse<IdTableCheckResult> deleteTable() {
        try {
            IdTableCheckResult result = configService.deleteTable();
            if (result.isExists()) {
                return ApiResponse.success(result, "Table deleted successfully");
            } else {
                return new ApiResponse<>(-1, result, result.getMessage());
            }
        } catch (Exception e) {
            System.err.println("Failed to delete table: " + e.getMessage());
            return ApiResponse.error(500, "Failed to delete table: " + e.getMessage());
        }
    }

    @PostMapping("table/recreate/")
    public ApiResponse<IdTableCheckResult> recreateTable() {
        try {
            IdTableCheckResult result = configService.recreateTable();
            if (result.isExists()) {
                return ApiResponse.success(result, "Table recreated successfully");
            } else {
                return new ApiResponse<>(-1, result, result.getMessage());
            }
        } catch (Exception e) {
            System.err.println("Failed to recreate table: " + e.getMessage());
            return ApiResponse.error(500, "Failed to recreate table: " + e.getMessage());
        }
    }
}
