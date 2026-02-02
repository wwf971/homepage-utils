package app.controller;

import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import app.pojo.ApiResponse;
import app.pojo.GroovyApiScript;
import app.service.GroovyApiService;
import jakarta.annotation.PostConstruct;

/**
 * Controller for Groovy API dynamic endpoints
 */
@RestController
@RequestMapping("/groovy-api/")
public class GroovyApiController {

    @Autowired
    private GroovyApiService groovyApiService;

    /**
     * Load all scripts on startup
     */
    @PostConstruct
    public void init() {
        groovyApiService.loadAllScripts();
    }

    /**
     * Upload or update a Groovy script
     */
    @PostMapping("upload")
    public ApiResponse<GroovyApiScript> uploadScript(@RequestBody Map<String, Object> request) {
        String id = (String) request.get("id");
        String endpoint = (String) request.get("endpoint");
        String scriptSource = (String) request.get("scriptSource");
        String description = (String) request.get("description");
        Integer timezoneOffset = request.get("timezoneOffset") != null ? 
            ((Number) request.get("timezoneOffset")).intValue() : null;

        return groovyApiService.uploadScript(id, endpoint, scriptSource, description, timezoneOffset);
    }

    /**
     * Get a script by ID
     */
    @GetMapping("get/{id}")
    public ApiResponse<GroovyApiScript> getScript(@PathVariable String id) {
        return groovyApiService.getScriptById(id);
    }

    /**
     * List all scripts
     */
    @GetMapping("list")
    public ApiResponse<Map<String, Object>> listScripts() {
        return groovyApiService.listScripts();
    }

    /**
     * Delete a script
     */
    @DeleteMapping("delete/{id}")
    public ApiResponse<String> deleteScript(@PathVariable String id) {
        return groovyApiService.deleteScript(id);
    }

    /**
     * Reload all scripts from database
     */
    @PostMapping("reload")
    public ApiResponse<String> reloadScripts() {
        try {
            groovyApiService.loadAllScripts();
            return ApiResponse.success("Scripts reloaded");
        } catch (Exception e) {
            return ApiResponse.error("Failed to reload scripts: " + e.getMessage());
        }
    }

    /**
     * Dynamic endpoint handler - executes Groovy script based on endpoint
     * Handles both GET and POST requests
     * Returns standardized response: {code: 0, data: xxx, message: xxx}
     */
    @PostMapping("{endpoint}")
    public Map<String, Object> executeScriptPost(
            @PathVariable String endpoint,
            @RequestBody(required = false) Map<String, Object> params,
            @RequestHeader Map<String, String> headers) {
        return groovyApiService.executeScript(endpoint, params, headers);
    }

    @GetMapping("{endpoint}")
    public Map<String, Object> executeScriptGet(
            @PathVariable String endpoint,
            @RequestParam(required = false) Map<String, Object> params,
            @RequestHeader Map<String, String> headers) {
        return groovyApiService.executeScript(endpoint, params, headers);
    }
}
