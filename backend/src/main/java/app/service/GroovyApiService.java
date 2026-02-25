package app.service;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.bson.Document;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;

import app.pojo.ApiResponse;
import app.pojo.FileInfo;
import app.pojo.GroovyApiScript;
import app.util.TimeUtils;
import groovy.lang.Binding;
import groovy.lang.GroovyShell;

/**
 * Service for managing and executing Groovy API scripts
 */
@Service
public class GroovyApiService {

    @Autowired
    private MongoService mongoService;

    @Autowired
    private MongoAppService mongoAppService;

    @Autowired
    private IdService idService;

    @Autowired
    private FileAccessPointService fileAccessPointService;

    private static final String DB_NAME = "main";
    private static final String COLLECTION_NAME = "groovy-api";

    // Cache of compiled scripts: endpoint -> compiled script
    private final Map<String, groovy.lang.Script> scriptCache = new ConcurrentHashMap<>();
    
    // Cache of endpoint -> id mapping for quick lookup
    private final Map<String, String> endpointToIdMap = new ConcurrentHashMap<>();

    /**
     * Get the groovy-api collection
     */
    private MongoCollection<Document> getCollection() {
        MongoClient client = mongoService.getMongoClient();
        if (client == null) {
            throw new RuntimeException("MongoDB client not initialized");
        }

        MongoDatabase database = client.getDatabase(DB_NAME);

        // Try to create collection if it doesn't exist
        try {
            database.createCollection(COLLECTION_NAME);
            System.out.println("Created groovy-api collection");
        } catch (com.mongodb.MongoCommandException e) {
            if (e.getErrorCode() != 48) {
                throw e;
            }
        }

        return database.getCollection(COLLECTION_NAME);
    }

    /**
     * Extract executable script code from scriptSource
     * Handles both legacy String format and new Object format
     * 
     * @param scriptSource Can be String (legacy) or Object (new format)
     * @return The executable Groovy script code
     */
    private String extractScriptCode(Object scriptSource) {
        if (scriptSource == null) {
            return null;
        }
        
        // Legacy format: scriptSource is a String
        if (scriptSource instanceof String) {
            return (String) scriptSource;
        }
        
        // New format: scriptSource is an Object/Map
        if (scriptSource instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> sourceMap = (Map<String, Object>) scriptSource;
            String storageType = (String) sourceMap.get("storageType");
            
            if ("inline".equals(storageType)) {
                return (String) sourceMap.get("rawText");
            } else if ("fileAccessPoint".equals(storageType)) {
                return (String) sourceMap.get("cachedContent");
            }
        }
        
        return null;
    }

    /**
     * Check if scriptSource is file-based
     */
    private boolean isFileBasedScript(Object scriptSource) {
        if (scriptSource instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> sourceMap = (Map<String, Object>) scriptSource;
            return "fileAccessPoint".equals(sourceMap.get("storageType"));
        }
        return false;
    }

    /**
     * Load script content from file access point
     * Updates the scriptSource with fresh content from file
     * 
     * @param scriptSource The scriptSource map (must be file-based)
     * @return Updated scriptSource map with fresh cachedContent
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> loadScriptFromFile(Map<String, Object> scriptSource) throws Exception {
        String fileAccessPointId = (String) scriptSource.get("fileAccessPointId");
        String path = (String) scriptSource.get("path");
        
        if (fileAccessPointId == null || path == null) {
            throw new IllegalArgumentException("File-based script missing fileAccessPointId or path");
        }
        
        // Load file content
        FileInfo fileInfo = fileAccessPointService.getFileContent(fileAccessPointId, path);
        if (fileInfo == null || fileInfo.getFileBytes() == null) {
            throw new IllegalArgumentException("Failed to load script file: " + path);
        }
        
        String scriptCode = new String(fileInfo.getFileBytes(), java.nio.charset.StandardCharsets.UTF_8);
        
        // Update scriptSource with cached content
        Map<String, Object> updated = new HashMap<>(scriptSource);
        updated.put("cachedContent", scriptCode);
        updated.put("lastSyncAt", TimeUtils.getCurrentTimestamp());
        updated.put("lastSyncAtTimezone", TimeUtils.getCurrentTimezoneOffset() / 60);
        
        return updated;
    }

    /**
     * Check if file-based script needs refresh
     * For now, always returns false (manual refresh only)
     * Could be enhanced to check file modification time
     */
    private boolean needsRefresh(Map<String, Object> scriptSource) {
        // For now, don't auto-refresh (only manual refresh)
        // Could add logic to check file mtime vs lastSyncAt
        return false;
    }

    /**
     * Load all scripts from MongoDB on startup
     * Using lazy compilation: scripts are registered but not compiled until first execution
     */
    public void loadAllScripts() {
        try {
            MongoCollection<Document> collection = getCollection();
            scriptCache.clear();
            endpointToIdMap.clear();

            int count = 0;
            for (Document doc : collection.find()) {
                String id = doc.getString("id");
                String endpoint = doc.getString("endpoint");

                if (id != null && endpoint != null) {
                    // Just register the endpoint, don't compile yet (lazy compilation)
                    endpointToIdMap.put(endpoint, id);
                    count++;
                    System.out.println("Registered Groovy script: " + id + " (endpoint: " + endpoint + ")");
                }
            }

            System.out.println("Registered " + count + " Groovy scripts (lazy compilation enabled)");
        } catch (Exception e) {
            System.err.println("Failed to load Groovy scripts: " + e.getMessage());
            e.printStackTrace();
        }
    }

    /**
     * Upload or update a Groovy script (legacy String format)
     * Converts String to inline scriptSource format
     */
    public ApiResponse<GroovyApiScript> uploadScript(String id, String endpoint, String scriptSource, String description, Integer timezone, String owner, String source) {
        // Convert legacy String format to new Object format
        Map<String, Object> scriptSourceObj = new HashMap<>();
        scriptSourceObj.put("storageType", "inline");
        scriptSourceObj.put("rawText", scriptSource);
        
        return uploadScriptWithObject(id, endpoint, scriptSourceObj, description, timezone, owner, source);
    }

    /**
     * Upload or update a Groovy script with Object scriptSource format
     * Supports both inline and file-based scripts
     */
    public ApiResponse<GroovyApiScript> uploadScriptWithObject(String id, String endpoint, Object scriptSource, String description, Integer timezone, String owner, String source) {
        if (endpoint == null || endpoint.trim().isEmpty()) {
            return ApiResponse.error("Endpoint cannot be empty");
        }

        if (scriptSource == null) {
            return ApiResponse.error("Script source cannot be empty");
        }

        // Validate endpoint name (alphanumeric, dash, underscore, slash)
        if (!endpoint.matches("^[a-zA-Z0-9_/-]+$")) {
            return ApiResponse.error("Endpoint must contain only alphanumeric characters, dashes, underscores, and slashes");
        }

        // For file-based scripts, load content from file
        if (isFileBasedScript(scriptSource)) {
            try {
                @SuppressWarnings("unchecked")
                Map<String, Object> scriptSourceMap = (Map<String, Object>) scriptSource;
                scriptSource = loadScriptFromFile(scriptSourceMap);
            } catch (Exception e) {
                return ApiResponse.error("Failed to load script from file: " + e.getMessage());
            }
        }

        // Extract actual script code for compilation
        String scriptCode = extractScriptCode(scriptSource);
        if (scriptCode == null || scriptCode.trim().isEmpty()) {
            return ApiResponse.error("Script code cannot be empty");
        }

        // Try to compile the script to validate it
        try {
            compileAndCacheScript(endpoint, scriptCode);
        } catch (Exception e) {
            return ApiResponse.error("Failed to compile script: " + e.getMessage());
        }

        MongoCollection<Document> collection = getCollection();
        long currentTime = TimeUtils.getCurrentTimestamp();

        Document existing = null;
        boolean isUpdate = false;

        if (id != null && !id.trim().isEmpty()) {
            // Update existing by ID
            existing = collection.find(Filters.eq("id", id)).first();
            isUpdate = (existing != null);
        } else {
            // Check if endpoint already exists
            existing = collection.find(Filters.eq("endpoint", endpoint)).first();
            if (existing != null) {
                return ApiResponse.error("Endpoint already exists: " + endpoint + ". Use the existing script ID to update it.");
            }
        }

        // Convert scriptSource to Document for MongoDB storage
        Object scriptSourceForDb = convertScriptSourceForDb(scriptSource);

        if (isUpdate) {
            // Update existing script
            int tz = (timezone != null) ? timezone : 0;
            
            Document doc = new Document();
            doc.append("id", id);
            doc.append("endpoint", endpoint);
            doc.append("scriptSource", scriptSourceForDb);
            doc.append("description", description != null ? description : "");
            doc.append("owner", owner != null ? owner : existing.getString("owner"));
            doc.append("source", source != null ? source : existing.getString("source"));
            doc.append("createdAt", existing.getLong("createdAt"));
            doc.append("createdAtTimezone", existing.get("createdAtTimezone", 0));
            doc.append("updatedAt", currentTime);
            doc.append("updatedAtTimezone", tz);

            collection.replaceOne(Filters.eq("id", id), doc);

            GroovyApiScript result = new GroovyApiScript();
            result.setId(id);
            result.setEndpoint(endpoint);
            result.setScriptSource(scriptSource);
            result.setDescription(description);
            result.setOwner(doc.getString("owner"));
            result.setSource(doc.getString("source"));
            result.setCreatedAt(doc.getLong("createdAt"));
            result.setUpdatedAt(currentTime);

            endpointToIdMap.put(endpoint, id);

            return ApiResponse.success(result, "Script updated");
        } else {
            // Create new script with generated ID
            try {
                app.pojo.IdIssueRequest idRequest = new app.pojo.IdIssueRequest();
                idRequest.setType("groovy-api");
                idRequest.setMetadata("endpoint: " + endpoint);

                ApiResponse<app.pojo.IdEntity> idResponse = idService.issueRandomId(idRequest);
                if (idResponse.getCode() != 0) {
                    return ApiResponse.error("Failed to generate script ID: " + idResponse.getMessage());
                }

                String newId = app.util.IdFormatConverter.longToBase36(idResponse.getData().getValue());
                int tz = (timezone != null) ? timezone : 0;

                Document doc = new Document();
                doc.append("id", newId);
                doc.append("endpoint", endpoint);
                doc.append("scriptSource", scriptSourceForDb);
                doc.append("description", description != null ? description : "");
                doc.append("owner", owner != null ? owner : "");
                doc.append("source", source != null ? source : "");
                doc.append("createdAt", currentTime);
                doc.append("createdAtTimezone", tz);
                doc.append("updatedAt", currentTime);
                doc.append("updatedAtTimezone", tz);

                collection.insertOne(doc);

                GroovyApiScript result = new GroovyApiScript();
                result.setId(newId);
                result.setEndpoint(endpoint);
                result.setScriptSource(scriptSource);
                result.setDescription(description);
                result.setOwner(owner);
                result.setSource(source);
                result.setCreatedAt(currentTime);
                result.setUpdatedAt(currentTime);

                endpointToIdMap.put(endpoint, newId);

                return ApiResponse.success(result, "Script created");
            } catch (Exception e) {
                return ApiResponse.error("Failed to create script: " + e.getMessage());
            }
        }
    }

    /**
     * Convert scriptSource Object to format suitable for MongoDB storage
     */
    private Object convertScriptSourceForDb(Object scriptSource) {
        if (scriptSource instanceof Map) {
            // Already in Object format, convert to Document for MongoDB
            @SuppressWarnings("unchecked")
            Map<String, Object> sourceMap = (Map<String, Object>) scriptSource;
            return new Document(sourceMap);
        }
        return scriptSource; // String format (legacy)
    }

    /**
     * Get a script by ID
     */
    public ApiResponse<GroovyApiScript> getScriptById(String id) {
        MongoCollection<Document> collection = getCollection();
        Document doc = collection.find(Filters.eq("id", id)).first();

        if (doc == null) {
            return ApiResponse.error("Script not found: " + id);
        }

        GroovyApiScript script = new GroovyApiScript();
        script.setId(doc.getString("id"));
        script.setEndpoint(doc.getString("endpoint"));
        
        // scriptSource can be String (legacy) or Document (new format)
        Object scriptSource = doc.get("scriptSource");
        script.setScriptSource(scriptSource);
        
        script.setDescription(doc.getString("description"));
        script.setOwner(doc.getString("owner"));
        script.setSource(doc.getString("source"));
        script.setCreatedAt(doc.getLong("createdAt"));
        script.setUpdatedAt(doc.getLong("updatedAt"));

        return ApiResponse.success(script);
    }

    /**
     * List all scripts (returns as a map keyed by script ID)
     */
    public ApiResponse<Map<String, Object>> listScripts() {
        try {
            MongoCollection<Document> collection = getCollection();
            Map<String, Object> scripts = new HashMap<>();

            for (Document doc : collection.find()) {
                String id = doc.getString("id");
                
                // Skip documents without ID (shouldn't happen, but be safe)
                if (id == null || id.isEmpty()) {
                    System.err.println("Warning: Found script document without ID.");
                    id = "ID_DOES_NOT_EXIST";
                }
                
                Map<String, Object> script = new HashMap<>();
                script.put("id", id);
                script.put("endpoint", doc.getString("endpoint"));
                script.put("description", doc.getString("description"));
                
                // scriptSource can be String (legacy) or Document (new format)
                Object scriptSource = doc.get("scriptSource");
                script.put("scriptSource", scriptSource);
                
                script.put("owner", doc.getString("owner"));
                script.put("source", doc.getString("source"));
                script.put("createdAt", doc.getLong("createdAt"));
                script.put("createdAtTimezone", doc.get("createdAtTimezone", 0));
                script.put("updatedAt", doc.getLong("updatedAt"));
                script.put("updatedAtTimezone", doc.get("updatedAtTimezone", 0));
                
                scripts.put(id, script);
            }

            return ApiResponse.success(scripts);
        } catch (Exception e) {
            return ApiResponse.error("Failed to list scripts: " + e.getMessage());
        }
    }

    /**
     * Delete a script by ID
     */
    public ApiResponse<String> deleteScript(String id) {
        MongoCollection<Document> collection = getCollection();
        Document doc = collection.find(Filters.eq("id", id)).first();
        
        if (doc == null) {
            return ApiResponse.error("Script not found: " + id);
        }
        
        String endpoint = doc.getString("endpoint");
        long deletedCount = collection.deleteOne(Filters.eq("id", id)).getDeletedCount();

        if (deletedCount > 0) {
            scriptCache.remove(endpoint);
            endpointToIdMap.remove(endpoint);
            return ApiResponse.success(id, "Script deleted");
        } else {
            return ApiResponse.error("Script not found: " + id);
        }
    }

    /**
     * Manually refresh a file-based script from its source file
     * @param scriptId The script ID
     * @return Updated script
     */
    public ApiResponse<GroovyApiScript> refreshScriptFromFile(String scriptId) {
        MongoCollection<Document> collection = getCollection();
        Document doc = collection.find(Filters.eq("id", scriptId)).first();
        
        if (doc == null) {
            return ApiResponse.error("Script not found: " + scriptId);
        }
        
        Object scriptSource = doc.get("scriptSource");
        
        if (!isFileBasedScript(scriptSource)) {
            return ApiResponse.error("Script is not file-based");
        }
        
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> scriptSourceMap = (Map<String, Object>) scriptSource;
            
            // Load fresh content from file
            Map<String, Object> updated = loadScriptFromFile(scriptSourceMap);
            
            // Validate by compiling
            String scriptCode = extractScriptCode(updated);
            String endpoint = doc.getString("endpoint");
            compileAndCacheScript(endpoint, scriptCode);
            
            // Update database
            Document updateDoc = new Document("$set", new Document("scriptSource", new Document(updated)));
            collection.updateOne(Filters.eq("id", scriptId), updateDoc);
            
            // Return updated script
            GroovyApiScript result = new GroovyApiScript();
            result.setId(scriptId);
            result.setEndpoint(endpoint);
            result.setScriptSource(updated);
            result.setDescription(doc.getString("description"));
            result.setOwner(doc.getString("owner"));
            result.setSource(doc.getString("source"));
            result.setCreatedAt(doc.getLong("createdAt"));
            result.setUpdatedAt(doc.getLong("updatedAt"));
            
            return ApiResponse.success(result, "Script refreshed from file");
        } catch (Exception e) {
            return ApiResponse.error("Failed to refresh script: " + e.getMessage());
        }
    }

    /**
     * Execute a script for a given endpoint
     * Returns a standardized response: {code: 0, data: xxx, message: xxx}
     * code = 0 means success, code < 0 means failure
     */
    public Map<String, Object> executeScript(String endpoint, Map<String, Object> params, Map<String, String> headers) {
        return executeScript(endpoint, params, headers, null);
    }
    
    /**
     * Execute a script by endpoint with optional backend APIs wrapper
     */
    public Map<String, Object> executeScript(String endpoint, Map<String, Object> params, Map<String, String> headers, MongoAppScriptBackendApis backendApis) {
        groovy.lang.Script script = scriptCache.get(endpoint);

        if (script == null) {
            // Try to load from database
            MongoCollection<Document> collection = getCollection();
            Document doc = collection.find(Filters.eq("endpoint", endpoint)).first();

            if (doc == null) {
                Map<String, Object> error = new HashMap<>();
                error.put("code", -1);
                error.put("message", "No script found for endpoint: " + endpoint);
                error.put("data", null);
                return error;
            }

            Object scriptSource = doc.get("scriptSource");
            
            // For file-based scripts, check if needs refresh and reload
            if (isFileBasedScript(scriptSource)) {
                try {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> scriptSourceMap = (Map<String, Object>) scriptSource;
                    
                    // Reload from file to get latest content
                    scriptSourceMap = loadScriptFromFile(scriptSourceMap);
                    
                    // Update database with fresh content
                    Document update = new Document("$set", new Document("scriptSource", new Document(scriptSourceMap)));
                    collection.updateOne(Filters.eq("endpoint", endpoint), update);
                    
                    scriptSource = scriptSourceMap;
                } catch (Exception e) {
                    Map<String, Object> error = new HashMap<>();
                    error.put("code", -2);
                    error.put("message", "Failed to load script from file: " + e.getMessage());
                    error.put("data", null);
                    return error;
                }
            }
            
            // Extract actual script code
            String scriptCode = extractScriptCode(scriptSource);
            if (scriptCode == null || scriptCode.trim().isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("code", -2);
                error.put("message", "Script code is empty");
                error.put("data", null);
                return error;
            }
            
            try {
                script = compileAndCacheScript(endpoint, scriptCode);
            } catch (Exception e) {
                Map<String, Object> error = new HashMap<>();
                error.put("code", -2);
                error.put("message", "Failed to compile script: " + e.getMessage());
                error.put("data", null);
                return error;
            }
        }

        // Create a new binding for each execution
        Binding binding = new Binding();
        
        // Provide parameters with new naming convention
        binding.setVariable("requestParams", params != null ? params : new HashMap<>());
        binding.setVariable("requestHeaders", headers != null ? headers : new HashMap<>());
        
        // Provide backend APIs wrapper if available (for MongoApp scripts)
        if (backendApis != null) {
            binding.setVariable("backendApis", backendApis);
        }
        
        // Legacy support: Keep old variable names for backward compatibility
        binding.setVariable("params", params != null ? params : new HashMap<>());
        binding.setVariable("headers", headers != null ? headers : new HashMap<>());
        binding.setVariable("mongoAppService", mongoAppService);

        // Set the binding and run
        script.setBinding(binding);

        try {
            Object result = script.run();
            
            // Validate and normalize the response format
            if (result instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> resultMap = (Map<String, Object>) result;
                
                // Check if it already has the standard format
                if (resultMap.containsKey("code")) {
                    // Ensure required fields exist
                    if (!resultMap.containsKey("data")) {
                        resultMap.put("data", null);
                    }
                    if (!resultMap.containsKey("message")) {
                        resultMap.put("message", null);
                    }
                    return resultMap;
                } else {
                    // Wrap the result in standard format
                    Map<String, Object> wrapped = new HashMap<>();
                    wrapped.put("code", 0);
                    wrapped.put("data", resultMap);
                    wrapped.put("message", null);
                    return wrapped;
                }
            } else {
                // Wrap non-map results in standard format
                Map<String, Object> wrapped = new HashMap<>();
                wrapped.put("code", 0);
                wrapped.put("data", result);
                wrapped.put("message", null);
                return wrapped;
            }
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("code", -3);
            error.put("message", "Script execution failed: " + e.getMessage());
            error.put("data", getStackTraceString(e));
            return error;
        }
    }

    /**
     * Compile and cache a script
     */
    private groovy.lang.Script compileAndCacheScript(String endpoint, String scriptSource) {
        GroovyShell shell = new GroovyShell();
        groovy.lang.Script script = shell.parse(scriptSource);
        scriptCache.put(endpoint, script);
        return script;
    }

    /**
     * Clear script cache (useful for testing)
     */
    public void clearCache() {
        scriptCache.clear();
    }

    /**
     * Get stack trace as string
     */
    private String getStackTraceString(Exception e) {
        StringBuilder sb = new StringBuilder();
        for (StackTraceElement element : e.getStackTrace()) {
            sb.append(element.toString()).append("\n");
        }
        return sb.toString();
    }
}
