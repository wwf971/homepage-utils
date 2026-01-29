package app.controller;

import app.pojo.*;
import app.service.IdService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/id")
public class IdController {

    private final IdService idService;

    @Autowired
    public IdController(IdService idService) {
        this.idService = idService;
    }

    /**
     * Issue a new random ID
     */
    @PostMapping("/issue/random")
    public ResponseEntity<Map<String, Object>> issueRandomId(@RequestBody IdIssueRequest request) {
        try {
            IdEntity id = idService.issueRandomId(request);
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("id", id);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    /**
     * Issue a new timestamp-based ID (ms_48)
     */
    @PostMapping("/issue/ms48")
    public ResponseEntity<Map<String, Object>> issueMs48Id(@RequestBody IdIssueRequest request) {
        try {
            IdEntity id = idService.issueMs48Id(request);
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("id", id);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    /**
     * Get ID by value (supports integer or string format)
     */
    @GetMapping("/get/{value}")
    public ResponseEntity<Map<String, Object>> getById(@PathVariable String value) {
        try {
            IdEntity id = idService.getById(value);
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("id", id);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
        }
    }

    /**
     * List all IDs with pagination
     */
    @GetMapping("/list")
    public ResponseEntity<Map<String, Object>> listIds(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        try {
            IdListResult result = idService.listIds(page, pageSize);
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", result);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    /**
     * Search IDs by filters
     */
    @PostMapping("/search")
    public ResponseEntity<Map<String, Object>> searchIds(@RequestBody IdSearchRequest request) {
        try {
            IdListResult result = idService.searchIds(request);
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", result);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    /**
     * Update ID metadata
     */
    @PutMapping("/{value}/metadata")
    public ResponseEntity<Map<String, Object>> updateMetadata(
            @PathVariable String value,
            @RequestBody IdMetadataUpdateRequest request) {
        try {
            idService.updateMetadata(value, request.getMetadata());
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Metadata updated successfully");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    /**
     * Delete ID
     */
    @DeleteMapping("/{value}")
    public ResponseEntity<Map<String, Object>> deleteId(@PathVariable String value) {
        try {
            idService.deleteId(value);
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "ID deleted successfully");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    /**
     * Convert ID to different formats
     */
    @GetMapping("/convert/{value}/{format}")
    public ResponseEntity<Map<String, Object>> convertId(
            @PathVariable String value,
            @PathVariable String format) {
        try {
            IdConvertResult result = idService.convertId(value, format);
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("conversions", result);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    /**
     * Search IDs by base36 substring
     */
    @PostMapping("/search/substring")
    public ResponseEntity<Map<String, Object>> searchBySubstring(@RequestBody IdSubstringSearchRequest request) {
        try {
            IdListResult result = idService.searchBySubstring(request);
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", result);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
}
