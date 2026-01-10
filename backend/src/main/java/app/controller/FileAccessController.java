package app.controller;

import app.pojo.ApiResponse;
import app.pojo.FileInfo;
import app.service.FileAccessPointService;
import org.springframework.web.bind.annotation.*;
import org.yaml.snakeyaml.Yaml;

import java.nio.charset.StandardCharsets;
import java.util.Map;

@RestController
@RequestMapping("/file/")
public class FileAccessController {

    private final FileAccessPointService fileAccessPointService;
    private final Yaml yaml = new Yaml();

    public FileAccessController(FileAccessPointService fileAccessPointService) {
        this.fileAccessPointService = fileAccessPointService;
    }

    @GetMapping("yaml/{fileAccessPoint}/**")
    public ApiResponse<Object> getYamlFile(
            @PathVariable String fileAccessPoint,
            @RequestParam(required = false, defaultValue = "true") boolean parse) {
        
        String path = extractPath();
        
        try {
            FileInfo fileInfo = fileAccessPointService.getFile(fileAccessPoint, path, true);
            
            if (fileInfo.getFileBytes() == null) {
                return new ApiResponse<>(-1, null, "File content not found");
            }

            String fileContent = new String(fileInfo.getFileBytes(), StandardCharsets.UTF_8);
            
            if (parse) {
                Object yamlData = yaml.load(fileContent);
                return new ApiResponse<>(0, yamlData, "YAML file retrieved and parsed successfully");
            } else {
                return new ApiResponse<>(0, fileContent, "YAML file retrieved successfully");
            }
            
        } catch (Exception e) {
            System.err.println("Failed to get YAML file: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to get file: " + e.getMessage());
        }
    }

    @GetMapping("info/{fileAccessPoint}/**")
    public ApiResponse<FileInfo> getFileInfo(@PathVariable String fileAccessPoint) {
        String path = extractPath();
        
        try {
            FileInfo fileInfo = fileAccessPointService.getFile(fileAccessPoint, path, false);
            return new ApiResponse<>(0, fileInfo, "File info retrieved successfully");
        } catch (Exception e) {
            System.err.println("Failed to get file info: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to get file info: " + e.getMessage());
        }
    }

    @GetMapping("content/{fileAccessPoint}/**")
    public ApiResponse<Map<String, Object>> getFileContent(@PathVariable String fileAccessPoint) {
        String path = extractPath();
        
        try {
            FileInfo fileInfo = fileAccessPointService.getFile(fileAccessPoint, path, true);
            
            Map<String, Object> result = Map.of(
                "path", fileInfo.getPath(),
                "name", fileInfo.getName(),
                "size", fileInfo.getSize(),
                "contentType", fileInfo.getContentType(),
                "content", new String(fileInfo.getFileBytes(), StandardCharsets.UTF_8)
            );
            
            return new ApiResponse<>(0, result, "File content retrieved successfully");
        } catch (Exception e) {
            System.err.println("Failed to get file content: " + e.getMessage());
            return new ApiResponse<>(-1, null, "Failed to get file content: " + e.getMessage());
        }
    }

    private String extractPath() {
        String requestURI = org.springframework.web.context.request.RequestContextHolder
            .currentRequestAttributes()
            .getAttribute("org.springframework.web.servlet.HandlerMapping.pathWithinHandlerMapping", 0)
            .toString();
        
        String[] parts = requestURI.split("/", 4);
        return parts.length > 3 ? parts[3] : "";
    }
}

