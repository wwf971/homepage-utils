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
    public ResponseEntity<ApiResponse<IdEntity>> issueRandomId(@RequestBody IdIssueRequest request) {
        ApiResponse<IdEntity> response = idService.issueRandomId(request);
        return ResponseEntity.ok(response);
    }

    /**
     * Issue a new timestamp-based ID (ms_48)
     */
    @PostMapping("/issue/ms48")
    public ResponseEntity<ApiResponse<IdEntity>> issueMs48Id(@RequestBody IdIssueRequest request) {
        ApiResponse<IdEntity> response = idService.issueMs48Id(request);
        return ResponseEntity.ok(response);
    }

    /**
     * Get ID by value (supports integer or string format)
     */
    @GetMapping("/get/{value}")
    public ResponseEntity<ApiResponse<IdEntity>> getById(@PathVariable String value) {
        ApiResponse<IdEntity> response = idService.getById(value);
        return ResponseEntity.ok(response);
    }

    /**
     * List all IDs with pagination
     */
    @GetMapping("/list")
    public ResponseEntity<ApiResponse<IdListResult>> listIds(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        ApiResponse<IdListResult> response = idService.listIds(page, pageSize);
        return ResponseEntity.ok(response);
    }

    /**
     * Search IDs by filters
     */
    @PostMapping("/search")
    public ResponseEntity<ApiResponse<IdListResult>> searchIds(@RequestBody IdSearchRequest request) {
        ApiResponse<IdListResult> response = idService.searchIds(request);
        return ResponseEntity.ok(response);
    }

    /**
     * Update ID metadata
     */
    @PutMapping("/{value}/metadata")
    public ResponseEntity<ApiResponse<Void>> updateMetadata(
            @PathVariable String value,
            @RequestBody IdMetadataUpdateRequest request) {
        ApiResponse<Void> response = idService.updateMetadata(value, request.getMetadata());
        return ResponseEntity.ok(response);
    }

    /**
     * Delete ID
     */
    @DeleteMapping("/{value}")
    public ResponseEntity<ApiResponse<Void>> deleteId(@PathVariable String value) {
        ApiResponse<Void> response = idService.deleteId(value);
        return ResponseEntity.ok(response);
    }

    /**
     * Convert ID to different formats
     */
    @GetMapping("/convert/{value}/{format}")
    public ResponseEntity<ApiResponse<IdConvertResult>> convertId(
            @PathVariable String value,
            @PathVariable String format) {
        ApiResponse<IdConvertResult> response = idService.convertId(value, format);
        return ResponseEntity.ok(response);
    }

    /**
     * Search IDs by base36 substring
     */
    @PostMapping("/search/substring")
    public ResponseEntity<ApiResponse<IdListResult>> searchBySubstring(@RequestBody IdSubstringSearchRequest request) {
        ApiResponse<IdListResult> response = idService.searchBySubstring(request);
        return ResponseEntity.ok(response);
    }
}
