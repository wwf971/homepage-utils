package app.controller;

import app.pojo.ApiResponse;
import app.pojo.ElasticSearchConfig;
import app.pojo.ElasticSearchConfigUpdateRequest;
import app.service.ElasticSearchConfigService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/elasticsearch/")
public class ElasticSearchController {

    private final ElasticSearchConfigService configService;

    public ElasticSearchController(ElasticSearchConfigService configService) {
        this.configService = configService;
        System.out.println("ElasticSearchController initialized successfully");
    }

    @PostMapping("test/")
    public ApiResponse<String> testConnection() {
        try {
            // Get current config
            ElasticSearchConfig config = configService.getCurrentConfig();
            
            // Check if config is valid
            if (config.getUris() == null || config.getUris().isEmpty()) {
                return ApiResponse.error(-1, "Elasticsearch URIs not configured");
            }
            
            // Test the connection by making a simple request to /_cluster/health
            String uris = config.getUris();
            String username = config.getUsername();
            String password = config.getPassword();
            
            // Use the first URI for testing
            String testUri = uris.split(",")[0].trim();
            if (!testUri.endsWith("/")) {
                testUri += "/";
            }
            testUri += "_cluster/health";
            
            // Build the connection (with or without auth)
            java.net.URL url = new java.net.URL(testUri);
            java.net.HttpURLConnection connection = (java.net.HttpURLConnection) url.openConnection(java.net.Proxy.NO_PROXY);
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);
            
            // Add basic auth if username and password are provided
            if (username != null && !username.isEmpty() && password != null && !password.isEmpty()) {
                String auth = username + ":" + password;
                String encodedAuth = java.util.Base64.getEncoder().encodeToString(auth.getBytes());
                connection.setRequestProperty("Authorization", "Basic " + encodedAuth);
            }
            
            int responseCode = connection.getResponseCode();
            
            if (responseCode == 200) {
                // Read response to get cluster status
                java.io.BufferedReader in = new java.io.BufferedReader(
                    new java.io.InputStreamReader(connection.getInputStream())
                );
                StringBuilder response = new StringBuilder();
                String inputLine;
                while ((inputLine = in.readLine()) != null) {
                    response.append(inputLine);
                }
                in.close();
                
                return new ApiResponse<>(
                    0,
                    "Connection successful! Cluster health: " + response.toString(),
                    "Elasticsearch connection test successful"
                );
            } else {
                return new ApiResponse<>(
                    -1,
                    null,
                    "Connection failed with HTTP " + responseCode
                );
            }
        } catch (java.net.UnknownHostException e) {
            return ApiResponse.error(-1, "Unknown host: " + e.getMessage());
        } catch (java.net.ConnectException e) {
            return ApiResponse.error(-1, "Connection refused: " + e.getMessage());
        } catch (java.net.SocketTimeoutException e) {
            return ApiResponse.error(-1, "Connection timeout: " + e.getMessage());
        } catch (Exception e) {
            System.err.println("Elasticsearch connection test failed: " + e.getMessage());
            e.printStackTrace();
            return ApiResponse.error(-1, "Connection test failed: " + e.getMessage());
        }
    }

    @GetMapping("config/app/")
    public ApiResponse<ElasticSearchConfig> getAppConfig() {
        try {
            ElasticSearchConfig config = configService.getAppConfig();
            return ApiResponse.success(config, "Elasticsearch application.properties configuration retrieved");
        } catch (Exception e) {
            System.err.println("ElasticSearchController.getAppConfig() error: " + e.getMessage());
            e.printStackTrace();
            return ApiResponse.error(500, "Failed to get app config: " + e.getMessage());
        }
    }

    @GetMapping("config/")
    public ApiResponse<ElasticSearchConfig> getConfig() {
        try {
            ElasticSearchConfig config = configService.getCurrentConfig();
            System.out.println("ElasticSearchController.getConfig() returning: " + config);
            return ApiResponse.success(config, "Current Elasticsearch configuration retrieved");
        } catch (Exception e) {
            System.err.println("ElasticSearchController.getConfig() error: " + e.getMessage());
            e.printStackTrace();
            return ApiResponse.error(500, "Failed to get config: " + e.getMessage());
        }
    }

    @PostMapping("config/set/")
    public ApiResponse<ElasticSearchConfig> setConfig(@RequestBody ElasticSearchConfigUpdateRequest request) {
        try {
            configService.updateConfig(request.getPath(), request.getValue());
            return ApiResponse.success(configService.getCurrentConfig(), "Elasticsearch configuration updated successfully");
        } catch (Exception e) {
            System.err.println("Failed to update config: " + e.getMessage());
            return ApiResponse.error(400, "Failed to update config: " + e.getMessage());
        }
    }

    /**
     * Create a new index
     */
    @PostMapping("indices/")
    public ApiResponse<String> createIndex(@RequestBody java.util.Map<String, Object> request) {
        try {
            String indexName = (String) request.get("indexName");
            if (indexName == null || indexName.isEmpty()) {
                return ApiResponse.error(-1, "Index name is required");
            }
            
            @SuppressWarnings("unchecked")
            java.util.Map<String, Object> body = (java.util.Map<String, Object>) request.get("body");
            
            ElasticSearchConfig config = configService.getCurrentConfig();
            
            if (config.getUris() == null || config.getUris().isEmpty()) {
                return ApiResponse.error(-1, "Elasticsearch URIs not configured");
            }
            
            String uris = config.getUris();
            String username = config.getUsername();
            String password = config.getPassword();
            
            String baseUri = uris.split(",")[0].trim();
            if (!baseUri.endsWith("/")) {
                baseUri += "/";
            }
            String createUri = baseUri + indexName;
            
            java.net.URL url = new java.net.URL(createUri);
            java.net.HttpURLConnection connection = (java.net.HttpURLConnection) url.openConnection(java.net.Proxy.NO_PROXY);
            connection.setRequestMethod("PUT");
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");
            
            if (username != null && !username.isEmpty() && password != null && !password.isEmpty()) {
                String auth = username + ":" + password;
                String encodedAuth = java.util.Base64.getEncoder().encodeToString(auth.getBytes());
                connection.setRequestProperty("Authorization", "Basic " + encodedAuth);
            }
            
            // Send body if provided
            if (body != null && !body.isEmpty()) {
                com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                String jsonBody = mapper.writeValueAsString(body);
                java.io.OutputStream os = connection.getOutputStream();
                os.write(jsonBody.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                os.close();
            }
            
            int responseCode = connection.getResponseCode();
            
            if (responseCode == 200 || responseCode == 201) {
                return ApiResponse.success("Index created", "Successfully created index: " + indexName);
            } else if (responseCode == 400) {
                java.io.BufferedReader errorReader = new java.io.BufferedReader(
                    new java.io.InputStreamReader(connection.getErrorStream())
                );
                StringBuilder errorResponse = new StringBuilder();
                String line;
                while ((line = errorReader.readLine()) != null) {
                    errorResponse.append(line);
                }
                errorReader.close();
                return ApiResponse.error(-1, "Failed to create index: " + errorResponse.toString());
            } else {
                return ApiResponse.error(-1, "Failed to create index: HTTP " + responseCode);
            }
        } catch (Exception e) {
            System.err.println("Failed to create index: " + e.getMessage());
            e.printStackTrace();
            return ApiResponse.error(-1, "Failed to create index: " + e.getMessage());
        }
    }

    /**
     * List all indices in the Elasticsearch cluster
     */
    @GetMapping("indices/")
    public ApiResponse<java.util.List<String>> listIndices() {
        try {
            ElasticSearchConfig config = configService.getCurrentConfig();
            
            if (config.getUris() == null || config.getUris().isEmpty()) {
                return ApiResponse.error(-1, "Elasticsearch URIs not configured");
            }
            
            String uris = config.getUris();
            String username = config.getUsername();
            String password = config.getPassword();
            
            String baseUri = uris.split(",")[0].trim();
            if (!baseUri.endsWith("/")) {
                baseUri += "/";
            }
            String listUri = baseUri + "_cat/indices?format=json";
            
            java.net.URL url = new java.net.URL(listUri);
            java.net.HttpURLConnection connection = (java.net.HttpURLConnection) url.openConnection(java.net.Proxy.NO_PROXY);
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);
            
            if (username != null && !username.isEmpty() && password != null && !password.isEmpty()) {
                String auth = username + ":" + password;
                String encodedAuth = java.util.Base64.getEncoder().encodeToString(auth.getBytes());
                connection.setRequestProperty("Authorization", "Basic " + encodedAuth);
            }
            
            int responseCode = connection.getResponseCode();
            
            if (responseCode == 200) {
                java.io.BufferedReader in = new java.io.BufferedReader(
                    new java.io.InputStreamReader(connection.getInputStream())
                );
                StringBuilder response = new StringBuilder();
                String inputLine;
                while ((inputLine = in.readLine()) != null) {
                    response.append(inputLine);
                }
                in.close();
                
                // Parse JSON response to extract index names
                String jsonResponse = response.toString();
                java.util.List<String> indexNames = new java.util.ArrayList<>();
                
                // Simple JSON parsing (using org.json or similar would be better for production)
                // The response is an array of objects with "index" field
                if (jsonResponse.startsWith("[")) {
                    com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                    java.util.List<java.util.Map<String, Object>> indices = mapper.readValue(
                        jsonResponse, 
                        new com.fasterxml.jackson.core.type.TypeReference<java.util.List<java.util.Map<String, Object>>>(){}
                    );
                    
                    for (java.util.Map<String, Object> index : indices) {
                        String indexName = (String) index.get("index");
                        if (indexName != null) {
                            indexNames.add(indexName);
                        }
                    }
                }
                
                return ApiResponse.success(indexNames, "Retrieved " + indexNames.size() + " indices");
            } else {
                return ApiResponse.error(-1, "Failed to list indices: HTTP " + responseCode);
            }
        } catch (Exception e) {
            System.err.println("Failed to list indices: " + e.getMessage());
            e.printStackTrace();
            return ApiResponse.error(-1, "Failed to list indices: " + e.getMessage());
        }
    }

    /**
     * Get information about a specific index
     */
    @GetMapping("indices/{indexName}")
    public ApiResponse<java.util.Map<String, Object>> getIndexInfo(@PathVariable String indexName) {
        try {
            ElasticSearchConfig config = configService.getCurrentConfig();
            
            if (config.getUris() == null || config.getUris().isEmpty()) {
                return ApiResponse.error(-1, "Elasticsearch URIs not configured");
            }
            
            String uris = config.getUris();
            String username = config.getUsername();
            String password = config.getPassword();
            
            String baseUri = uris.split(",")[0].trim();
            if (!baseUri.endsWith("/")) {
                baseUri += "/";
            }
            String infoUri = baseUri + indexName;
            
            java.net.URL url = new java.net.URL(infoUri);
            java.net.HttpURLConnection connection = (java.net.HttpURLConnection) url.openConnection(java.net.Proxy.NO_PROXY);
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);
            
            if (username != null && !username.isEmpty() && password != null && !password.isEmpty()) {
                String auth = username + ":" + password;
                String encodedAuth = java.util.Base64.getEncoder().encodeToString(auth.getBytes());
                connection.setRequestProperty("Authorization", "Basic " + encodedAuth);
            }
            
            int responseCode = connection.getResponseCode();
            
            if (responseCode == 200) {
                java.io.BufferedReader in = new java.io.BufferedReader(
                    new java.io.InputStreamReader(connection.getInputStream())
                );
                StringBuilder response = new StringBuilder();
                String inputLine;
                while ((inputLine = in.readLine()) != null) {
                    response.append(inputLine);
                }
                in.close();
                
                // Parse JSON response
                com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                java.util.Map<String, Object> indexInfo = mapper.readValue(
                    response.toString(),
                    new com.fasterxml.jackson.core.type.TypeReference<java.util.Map<String, Object>>(){}
                );
                
                return ApiResponse.success(indexInfo, "Retrieved info for index: " + indexName);
            } else if (responseCode == 404) {
                return ApiResponse.error(-1, "Index not found: " + indexName);
            } else {
                return ApiResponse.error(-1, "Failed to get index info: HTTP " + responseCode);
            }
        } catch (Exception e) {
            System.err.println("Failed to get index info: " + e.getMessage());
            e.printStackTrace();
            return ApiResponse.error(-1, "Failed to get index info: " + e.getMessage());
        }
    }

    /**
     * Delete an index
     */
    @DeleteMapping("indices/{indexName}")
    public ApiResponse<String> deleteIndex(@PathVariable String indexName) {
        try {
            ElasticSearchConfig config = configService.getCurrentConfig();
            
            if (config.getUris() == null || config.getUris().isEmpty()) {
                return ApiResponse.error(-1, "Elasticsearch URIs not configured");
            }
            
            String uris = config.getUris();
            String username = config.getUsername();
            String password = config.getPassword();
            
            String baseUri = uris.split(",")[0].trim();
            if (!baseUri.endsWith("/")) {
                baseUri += "/";
            }
            String deleteUri = baseUri + indexName;
            
            java.net.URL url = new java.net.URL(deleteUri);
            java.net.HttpURLConnection connection = (java.net.HttpURLConnection) url.openConnection(java.net.Proxy.NO_PROXY);
            connection.setRequestMethod("DELETE");
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);
            
            if (username != null && !username.isEmpty() && password != null && !password.isEmpty()) {
                String auth = username + ":" + password;
                String encodedAuth = java.util.Base64.getEncoder().encodeToString(auth.getBytes());
                connection.setRequestProperty("Authorization", "Basic " + encodedAuth);
            }
            
            int responseCode = connection.getResponseCode();
            
            if (responseCode == 200) {
                return ApiResponse.success("Index deleted", "Successfully deleted index: " + indexName);
            } else if (responseCode == 404) {
                return ApiResponse.error(-1, "Index not found: " + indexName);
            } else {
                return ApiResponse.error(-1, "Failed to delete index: HTTP " + responseCode);
            }
        } catch (Exception e) {
            System.err.println("Failed to delete index: " + e.getMessage());
            e.printStackTrace();
            return ApiResponse.error(-1, "Failed to delete index: " + e.getMessage());
        }
    }

    /**
     * Rename an index (using reindex + delete)
     */
    @PostMapping("indices/{indexName}/rename/")
    public ApiResponse<String> renameIndex(
        @PathVariable String indexName,
        @RequestBody java.util.Map<String, String> request
    ) {
        try {
            String newName = request.get("newName");
            if (newName == null || newName.isEmpty()) {
                return ApiResponse.error(-1, "New name is required");
            }
            
            if (indexName.equals(newName)) {
                return ApiResponse.error(-1, "New name must be different from current name");
            }
            
            ElasticSearchConfig config = configService.getCurrentConfig();
            
            if (config.getUris() == null || config.getUris().isEmpty()) {
                return ApiResponse.error(-1, "Elasticsearch URIs not configured");
            }
            
            String uris = config.getUris();
            String username = config.getUsername();
            String password = config.getPassword();
            
            String baseUri = uris.split(",")[0].trim();
            if (!baseUri.endsWith("/")) {
                baseUri += "/";
            }
            
            // Step 1: Reindex to new name
            String reindexUri = baseUri + "_reindex";
            String reindexBody = String.format(
                "{\"source\":{\"index\":\"%s\"},\"dest\":{\"index\":\"%s\"}}",
                indexName, newName
            );
            
            java.net.URL reindexUrl = new java.net.URL(reindexUri);
            java.net.HttpURLConnection reindexConn = (java.net.HttpURLConnection) reindexUrl.openConnection(java.net.Proxy.NO_PROXY);
            reindexConn.setRequestMethod("POST");
            reindexConn.setConnectTimeout(30000);
            reindexConn.setReadTimeout(30000);
            reindexConn.setDoOutput(true);
            reindexConn.setRequestProperty("Content-Type", "application/json");
            
            if (username != null && !username.isEmpty() && password != null && !password.isEmpty()) {
                String auth = username + ":" + password;
                String encodedAuth = java.util.Base64.getEncoder().encodeToString(auth.getBytes());
                reindexConn.setRequestProperty("Authorization", "Basic " + encodedAuth);
            }
            
            java.io.OutputStream os = reindexConn.getOutputStream();
            os.write(reindexBody.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            os.close();
            
            int reindexResponseCode = reindexConn.getResponseCode();
            
            if (reindexResponseCode != 200) {
                java.io.BufferedReader errorReader = new java.io.BufferedReader(
                    new java.io.InputStreamReader(reindexConn.getErrorStream())
                );
                StringBuilder errorResponse = new StringBuilder();
                String line;
                while ((line = errorReader.readLine()) != null) {
                    errorResponse.append(line);
                }
                errorReader.close();
                return ApiResponse.error(-1, "Failed to reindex: " + errorResponse.toString());
            }
            
            // Step 2: Delete old index
            String deleteUri = baseUri + indexName;
            java.net.URL deleteUrl = new java.net.URL(deleteUri);
            java.net.HttpURLConnection deleteConn = (java.net.HttpURLConnection) deleteUrl.openConnection(java.net.Proxy.NO_PROXY);
            deleteConn.setRequestMethod("DELETE");
            deleteConn.setConnectTimeout(5000);
            deleteConn.setReadTimeout(5000);
            
            if (username != null && !username.isEmpty() && password != null && !password.isEmpty()) {
                String auth = username + ":" + password;
                String encodedAuth = java.util.Base64.getEncoder().encodeToString(auth.getBytes());
                deleteConn.setRequestProperty("Authorization", "Basic " + encodedAuth);
            }
            
            int deleteResponseCode = deleteConn.getResponseCode();
            
            if (deleteResponseCode != 200) {
                return ApiResponse.error(-1, "Reindex succeeded but failed to delete old index");
            }
            
            return ApiResponse.success("Index renamed", "Successfully renamed index from " + indexName + " to " + newName);
        } catch (Exception e) {
            System.err.println("Failed to rename index: " + e.getMessage());
            e.printStackTrace();
            return ApiResponse.error(-1, "Failed to rename index: " + e.getMessage());
        }
    }

    /**
     * Get documents from an index with pagination
     */
    @GetMapping("indices/{indexName}/docs/")
    public ApiResponse<java.util.Map<String, Object>> getDocuments(
        @PathVariable String indexName,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int pageSize
    ) {
        try {
            ElasticSearchConfig config = configService.getCurrentConfig();
            
            if (config.getUris() == null || config.getUris().isEmpty()) {
                return ApiResponse.error(-1, "Elasticsearch URIs not configured");
            }
            
            String uris = config.getUris();
            String username = config.getUsername();
            String password = config.getPassword();
            
            String baseUri = uris.split(",")[0].trim();
            if (!baseUri.endsWith("/")) {
                baseUri += "/";
            }
            
            // Calculate from parameter for ES
            int from = (page - 1) * pageSize;
            String searchUri = baseUri + indexName + "/_search?from=" + from + "&size=" + pageSize;
            
            java.net.URL url = new java.net.URL(searchUri);
            java.net.HttpURLConnection connection = (java.net.HttpURLConnection) url.openConnection(java.net.Proxy.NO_PROXY);
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);
            
            if (username != null && !username.isEmpty() && password != null && !password.isEmpty()) {
                String auth = username + ":" + password;
                String encodedAuth = java.util.Base64.getEncoder().encodeToString(auth.getBytes());
                connection.setRequestProperty("Authorization", "Basic " + encodedAuth);
            }
            
            int responseCode = connection.getResponseCode();
            
            if (responseCode == 200) {
                java.io.BufferedReader in = new java.io.BufferedReader(
                    new java.io.InputStreamReader(connection.getInputStream())
                );
                StringBuilder response = new StringBuilder();
                String inputLine;
                while ((inputLine = in.readLine()) != null) {
                    response.append(inputLine);
                }
                in.close();
                
                // Parse JSON response
                com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                java.util.Map<String, Object> searchResult = mapper.readValue(
                    response.toString(),
                    new com.fasterxml.jackson.core.type.TypeReference<java.util.Map<String, Object>>(){}
                );
                
                // Extract documents
                @SuppressWarnings("unchecked")
                java.util.Map<String, Object> hits = (java.util.Map<String, Object>) searchResult.get("hits");
                @SuppressWarnings("unchecked")
                java.util.List<java.util.Map<String, Object>> hitsList = (java.util.List<java.util.Map<String, Object>>) hits.get("hits");
                
                java.util.List<java.util.Map<String, Object>> documents = new java.util.ArrayList<>();
                for (java.util.Map<String, Object> hit : hitsList) {
                    @SuppressWarnings("unchecked")
                    java.util.Map<String, Object> source = (java.util.Map<String, Object>) hit.get("_source");
                    java.util.Map<String, Object> doc = new java.util.HashMap<>(source);
                    doc.put("_id", hit.get("_id"));
                    documents.add(doc);
                }
                
                // Get total count
                @SuppressWarnings("unchecked")
                java.util.Map<String, Object> totalObj = (java.util.Map<String, Object>) hits.get("total");
                int total = 0;
                if (totalObj != null) {
                    Object value = totalObj.get("value");
                    if (value instanceof Integer) {
                        total = (Integer) value;
                    }
                }
                
                java.util.Map<String, Object> result = new java.util.HashMap<>();
                result.put("documents", documents);
                result.put("total", total);
                result.put("page", page);
                result.put("pageSize", pageSize);
                
                return ApiResponse.success(result, "Retrieved " + documents.size() + " documents");
            } else {
                return ApiResponse.error(-1, "Failed to get documents: HTTP " + responseCode);
            }
        } catch (Exception e) {
            System.err.println("Failed to get documents: " + e.getMessage());
            e.printStackTrace();
            return ApiResponse.error(-1, "Failed to get documents: " + e.getMessage());
        }
    }

    /**
     * Create a document in an index
     */
    @PostMapping("indices/{indexName}/docs/")
    public ApiResponse<java.util.Map<String, Object>> createDocument(
        @PathVariable String indexName,
        @RequestBody java.util.Map<String, Object> request
    ) {
        try {
            @SuppressWarnings("unchecked")
            java.util.Map<String, Object> body = (java.util.Map<String, Object>) request.get("body");
            if (body == null) {
                body = new java.util.HashMap<>();
            }
            
            ElasticSearchConfig config = configService.getCurrentConfig();
            
            if (config.getUris() == null || config.getUris().isEmpty()) {
                return ApiResponse.error(-1, "Elasticsearch URIs not configured");
            }
            
            String uris = config.getUris();
            String username = config.getUsername();
            String password = config.getPassword();
            
            String baseUri = uris.split(",")[0].trim();
            if (!baseUri.endsWith("/")) {
                baseUri += "/";
            }
            String createUri = baseUri + indexName + "/_doc";
            
            java.net.URL url = new java.net.URL(createUri);
            java.net.HttpURLConnection connection = (java.net.HttpURLConnection) url.openConnection(java.net.Proxy.NO_PROXY);
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");
            
            if (username != null && !username.isEmpty() && password != null && !password.isEmpty()) {
                String auth = username + ":" + password;
                String encodedAuth = java.util.Base64.getEncoder().encodeToString(auth.getBytes());
                connection.setRequestProperty("Authorization", "Basic " + encodedAuth);
            }
            
            // Send the body
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            String jsonBody = mapper.writeValueAsString(body);
            java.io.OutputStream os = connection.getOutputStream();
            os.write(jsonBody.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            os.close();
            
            int responseCode = connection.getResponseCode();
            
            if (responseCode == 200 || responseCode == 201) {
                java.io.BufferedReader in = new java.io.BufferedReader(
                    new java.io.InputStreamReader(connection.getInputStream())
                );
                StringBuilder response = new StringBuilder();
                String inputLine;
                while ((inputLine = in.readLine()) != null) {
                    response.append(inputLine);
                }
                in.close();
                
                // Parse response to get document ID
                java.util.Map<String, Object> createResult = mapper.readValue(
                    response.toString(),
                    new com.fasterxml.jackson.core.type.TypeReference<java.util.Map<String, Object>>(){}
                );
                
                String docId = (String) createResult.get("_id");
                
                // Fetch the created document to return its content
                String getUri = baseUri + indexName + "/_doc/" + docId;
                java.net.URL getUrl = new java.net.URL(getUri);
                java.net.HttpURLConnection getConn = (java.net.HttpURLConnection) getUrl.openConnection(java.net.Proxy.NO_PROXY);
                getConn.setRequestMethod("GET");
                getConn.setConnectTimeout(5000);
                getConn.setReadTimeout(5000);
                
                if (username != null && !username.isEmpty() && password != null && !password.isEmpty()) {
                    String auth = username + ":" + password;
                    String encodedAuth = java.util.Base64.getEncoder().encodeToString(auth.getBytes());
                    getConn.setRequestProperty("Authorization", "Basic " + encodedAuth);
                }
                
                int getResponseCode = getConn.getResponseCode();
                if (getResponseCode == 200) {
                    java.io.BufferedReader getIn = new java.io.BufferedReader(
                        new java.io.InputStreamReader(getConn.getInputStream())
                    );
                    StringBuilder getResponse = new StringBuilder();
                    String getLine;
                    while ((getLine = getIn.readLine()) != null) {
                        getResponse.append(getLine);
                    }
                    getIn.close();
                    
                    java.util.Map<String, Object> getDoc = mapper.readValue(
                        getResponse.toString(),
                        new com.fasterxml.jackson.core.type.TypeReference<java.util.Map<String, Object>>(){}
                    );
                    
                    @SuppressWarnings("unchecked")
                    java.util.Map<String, Object> source = (java.util.Map<String, Object>) getDoc.get("_source");
                    java.util.Map<String, Object> doc = new java.util.HashMap<>(source);
                    doc.put("_id", docId);
                    
                    return ApiResponse.success(doc, "Document created successfully");
                }
                
                // Fallback if we can't fetch the created document
                java.util.Map<String, Object> doc = new java.util.HashMap<>();
                doc.put("_id", docId);
                return ApiResponse.success(doc, "Document created successfully");
            } else {
                return ApiResponse.error(-1, "Failed to create document: HTTP " + responseCode);
            }
        } catch (Exception e) {
            System.err.println("Failed to create document: " + e.getMessage());
            e.printStackTrace();
            return ApiResponse.error(-1, "Failed to create document: " + e.getMessage());
        }
    }

    /**
     * Update a document in an index (full rewrite)
     */
    @PutMapping("indices/{indexName}/docs/{docId}")
    public ApiResponse<java.util.Map<String, Object>> updateDocument(
        @PathVariable String indexName,
        @PathVariable String docId,
        @RequestBody java.util.Map<String, Object> request
    ) {
        try {
            @SuppressWarnings("unchecked")
            java.util.Map<String, Object> body = (java.util.Map<String, Object>) request.get("body");
            if (body == null) {
                return ApiResponse.error(-1, "Document body is required");
            }
            
            ElasticSearchConfig config = configService.getCurrentConfig();
            
            if (config.getUris() == null || config.getUris().isEmpty()) {
                return ApiResponse.error(-1, "Elasticsearch URIs not configured");
            }
            
            String uris = config.getUris();
            String username = config.getUsername();
            String password = config.getPassword();
            
            String baseUri = uris.split(",")[0].trim();
            if (!baseUri.endsWith("/")) {
                baseUri += "/";
            }
            String updateUri = baseUri + indexName + "/_doc/" + docId;
            
            java.net.URL url = new java.net.URL(updateUri);
            java.net.HttpURLConnection connection = (java.net.HttpURLConnection) url.openConnection(java.net.Proxy.NO_PROXY);
            connection.setRequestMethod("PUT");
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");
            
            if (username != null && !username.isEmpty() && password != null && !password.isEmpty()) {
                String auth = username + ":" + password;
                String encodedAuth = java.util.Base64.getEncoder().encodeToString(auth.getBytes());
                connection.setRequestProperty("Authorization", "Basic " + encodedAuth);
            }
            
            // Send the body
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            String jsonBody = mapper.writeValueAsString(body);
            java.io.OutputStream os = connection.getOutputStream();
            os.write(jsonBody.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            os.close();
            
            int responseCode = connection.getResponseCode();
            
            if (responseCode == 200 || responseCode == 201) {
                // Fetch the updated document to return its content
                String getUri = baseUri + indexName + "/_doc/" + docId;
                java.net.URL getUrl = new java.net.URL(getUri);
                java.net.HttpURLConnection getConn = (java.net.HttpURLConnection) getUrl.openConnection(java.net.Proxy.NO_PROXY);
                getConn.setRequestMethod("GET");
                getConn.setConnectTimeout(5000);
                getConn.setReadTimeout(5000);
                
                if (username != null && !username.isEmpty() && password != null && !password.isEmpty()) {
                    String auth = username + ":" + password;
                    String encodedAuth = java.util.Base64.getEncoder().encodeToString(auth.getBytes());
                    getConn.setRequestProperty("Authorization", "Basic " + encodedAuth);
                }
                
                int getResponseCode = getConn.getResponseCode();
                if (getResponseCode == 200) {
                    java.io.BufferedReader getIn = new java.io.BufferedReader(
                        new java.io.InputStreamReader(getConn.getInputStream())
                    );
                    StringBuilder getResponse = new StringBuilder();
                    String getLine;
                    while ((getLine = getIn.readLine()) != null) {
                        getResponse.append(getLine);
                    }
                    getIn.close();
                    
                    java.util.Map<String, Object> getDoc = mapper.readValue(
                        getResponse.toString(),
                        new com.fasterxml.jackson.core.type.TypeReference<java.util.Map<String, Object>>(){}
                    );
                    
                    // Merge _id and _source
                    @SuppressWarnings("unchecked")
                    java.util.Map<String, Object> source = (java.util.Map<String, Object>) getDoc.get("_source");
                    if (source != null) {
                        source.put("_id", getDoc.get("_id"));
                        return ApiResponse.success(source, "Document updated successfully");
                    }
                }
                
                return ApiResponse.success(body, "Document updated successfully");
            } else if (responseCode == 404) {
                return ApiResponse.error(-1, "Document not found: " + docId);
            } else {
                return ApiResponse.error(-1, "Failed to update document: HTTP " + responseCode);
            }
        } catch (Exception e) {
            System.err.println("Failed to update document: " + e.getMessage());
            e.printStackTrace();
            return ApiResponse.error(-1, "Failed to update document: " + e.getMessage());
        }
    }

    /**
     * Delete a document from an index
     */
    @DeleteMapping("indices/{indexName}/docs/{docId}")
    public ApiResponse<String> deleteDocument(
        @PathVariable String indexName,
        @PathVariable String docId
    ) {
        try {
            ElasticSearchConfig config = configService.getCurrentConfig();
            
            if (config.getUris() == null || config.getUris().isEmpty()) {
                return ApiResponse.error(-1, "Elasticsearch URIs not configured");
            }
            
            String uris = config.getUris();
            String username = config.getUsername();
            String password = config.getPassword();
            
            String baseUri = uris.split(",")[0].trim();
            if (!baseUri.endsWith("/")) {
                baseUri += "/";
            }
            String deleteUri = baseUri + indexName + "/_doc/" + docId;
            
            java.net.URL url = new java.net.URL(deleteUri);
            java.net.HttpURLConnection connection = (java.net.HttpURLConnection) url.openConnection(java.net.Proxy.NO_PROXY);
            connection.setRequestMethod("DELETE");
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);
            
            if (username != null && !username.isEmpty() && password != null && !password.isEmpty()) {
                String auth = username + ":" + password;
                String encodedAuth = java.util.Base64.getEncoder().encodeToString(auth.getBytes());
                connection.setRequestProperty("Authorization", "Basic " + encodedAuth);
            }
            
            int responseCode = connection.getResponseCode();
            
            if (responseCode == 200) {
                return ApiResponse.success("Document deleted", "Successfully deleted document: " + docId);
            } else if (responseCode == 404) {
                return ApiResponse.error(-1, "Document not found: " + docId);
            } else {
                return ApiResponse.error(-1, "Failed to delete document: HTTP " + responseCode);
            }
        } catch (Exception e) {
            System.err.println("Failed to delete document: " + e.getMessage());
            e.printStackTrace();
            return ApiResponse.error(-1, "Failed to delete document: " + e.getMessage());
        }
    }

    /**
     * Search documents in a character-level index
     */
    @PostMapping("indices/{indexName}/search/")
    public ApiResponse<java.util.List<java.util.Map<String, Object>>> searchDocuments(
        @PathVariable String indexName,
        @RequestBody java.util.Map<String, Object> searchParams
    ) {
        try {
            String query = (String) searchParams.get("query");
            Boolean searchInPaths = (Boolean) searchParams.get("search_in_paths");
            Boolean searchInValues = (Boolean) searchParams.get("search_in_values");
            
            if (query == null || query.trim().isEmpty()) {
                return ApiResponse.error(-1, "Query parameter is required");
            }
            
            if (searchInPaths == null) searchInPaths = false;
            if (searchInValues == null) searchInValues = true;
            
            ElasticSearchConfig config = configService.getCurrentConfig();
            
            if (config.getUris() == null || config.getUris().isEmpty()) {
                return ApiResponse.error(-1, "Elasticsearch URIs not configured");
            }
            
            String uris = config.getUris();
            String username = config.getUsername();
            String password = config.getPassword();
            
            String baseUri = uris.split(",")[0].trim();
            if (!baseUri.endsWith("/")) {
                baseUri += "/";
            }
            
            // First, check if this is a character-level index by getting its mapping
            String mappingUri = baseUri + indexName + "/_mapping";
            java.net.URL mappingUrl = new java.net.URL(mappingUri);
            java.net.HttpURLConnection mappingConn = (java.net.HttpURLConnection) mappingUrl.openConnection(java.net.Proxy.NO_PROXY);
            mappingConn.setRequestMethod("GET");
            mappingConn.setConnectTimeout(5000);
            mappingConn.setReadTimeout(5000);
            
            if (username != null && !username.isEmpty() && password != null && !password.isEmpty()) {
                String auth = username + ":" + password;
                String encodedAuth = java.util.Base64.getEncoder().encodeToString(auth.getBytes());
                mappingConn.setRequestProperty("Authorization", "Basic " + encodedAuth);
            }
            
            int mappingResponseCode = mappingConn.getResponseCode();
            if (mappingResponseCode != 200) {
                return ApiResponse.error(-1, "Failed to get index mapping");
            }
            
            java.io.BufferedReader mappingIn = new java.io.BufferedReader(
                new java.io.InputStreamReader(mappingConn.getInputStream())
            );
            StringBuilder mappingResponse = new StringBuilder();
            String mappingLine;
            while ((mappingLine = mappingIn.readLine()) != null) {
                mappingResponse.append(mappingLine);
            }
            mappingIn.close();
            
            // Check if the mapping contains the character-level structure (flat.path and flat.value)
            String mappingStr = mappingResponse.toString();
            if (!mappingStr.contains("\"flat\"") || !mappingStr.contains("\"path\"") || !mappingStr.contains("\"value\"")) {
                return ApiResponse.error(-1, "Index '" + indexName + "' is not a character-level index. " +
                    "It must have a 'flat' nested field with 'path' and 'value' subfields.");
            }
            
            // Build the search query
            java.util.List<java.util.Map<String, Object>> shouldConditions = new java.util.ArrayList<>();
            
            if (searchInValues) {
                java.util.Map<String, Object> valueMatch = new java.util.HashMap<>();
                java.util.Map<String, Object> matchPhrase = new java.util.HashMap<>();
                matchPhrase.put("flat.value", query);
                valueMatch.put("match_phrase", matchPhrase);
                shouldConditions.add(valueMatch);
            }
            
            if (searchInPaths) {
                java.util.Map<String, Object> pathMatch = new java.util.HashMap<>();
                java.util.Map<String, Object> matchPhrase = new java.util.HashMap<>();
                matchPhrase.put("flat.path", query);
                pathMatch.put("match_phrase", matchPhrase);
                shouldConditions.add(pathMatch);
            }
            
            // Build highlight fields
            java.util.Map<String, Object> highlightFields = new java.util.HashMap<>();
            java.util.Map<String, Object> highlightConfig = new java.util.HashMap<>();
            highlightConfig.put("type", "fvh");
            highlightConfig.put("pre_tags", new String[]{"[[HIGHLIGHT_START]]"});
            highlightConfig.put("post_tags", new String[]{"[[HIGHLIGHT_END]]"});
            highlightConfig.put("fragment_size", 999999);
            highlightConfig.put("number_of_fragments", 0);
            
            if (searchInValues) {
                highlightFields.put("flat.value", highlightConfig);
            }
            if (searchInPaths) {
                highlightFields.put("flat.path", highlightConfig);
            }
            
            // Build the complete search query
            java.util.Map<String, Object> innerHits = new java.util.HashMap<>();
            innerHits.put("_source", true);
            innerHits.put("size", 100);
            java.util.Map<String, Object> innerHighlight = new java.util.HashMap<>();
            innerHighlight.put("fields", highlightFields);
            innerHits.put("highlight", innerHighlight);
            
            java.util.Map<String, Object> boolQuery = new java.util.HashMap<>();
            boolQuery.put("should", shouldConditions);
            
            java.util.Map<String, Object> nestedQuery = new java.util.HashMap<>();
            nestedQuery.put("path", "flat");
            nestedQuery.put("query", java.util.Map.of("bool", boolQuery));
            nestedQuery.put("inner_hits", innerHits);
            
            java.util.Map<String, Object> searchQuery = new java.util.HashMap<>();
            searchQuery.put("query", java.util.Map.of("nested", nestedQuery));
            searchQuery.put("size", 100);
            
            // Execute the search
            String searchUri = baseUri + indexName + "/_search";
            java.net.URL searchUrl = new java.net.URL(searchUri);
            java.net.HttpURLConnection searchConn = (java.net.HttpURLConnection) searchUrl.openConnection(java.net.Proxy.NO_PROXY);
            searchConn.setRequestMethod("POST");
            searchConn.setConnectTimeout(5000);
            searchConn.setReadTimeout(5000);
            searchConn.setDoOutput(true);
            searchConn.setRequestProperty("Content-Type", "application/json");
            
            if (username != null && !username.isEmpty() && password != null && !password.isEmpty()) {
                String auth = username + ":" + password;
                String encodedAuth = java.util.Base64.getEncoder().encodeToString(auth.getBytes());
                searchConn.setRequestProperty("Authorization", "Basic " + encodedAuth);
            }
            
            // Send the search query
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            String jsonQuery = mapper.writeValueAsString(searchQuery);
            java.io.OutputStream os = searchConn.getOutputStream();
            os.write(jsonQuery.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            os.close();
            
            int searchResponseCode = searchConn.getResponseCode();
            
            if (searchResponseCode != 200) {
                java.io.BufferedReader errorIn = new java.io.BufferedReader(
                    new java.io.InputStreamReader(searchConn.getErrorStream())
                );
                StringBuilder errorResponse = new StringBuilder();
                String errorLine;
                while ((errorLine = errorIn.readLine()) != null) {
                    errorResponse.append(errorLine);
                }
                errorIn.close();
                return ApiResponse.error(-1, "Search failed: " + errorResponse.toString());
            }
            
            java.io.BufferedReader searchIn = new java.io.BufferedReader(
                new java.io.InputStreamReader(searchConn.getInputStream())
            );
            StringBuilder searchResponse = new StringBuilder();
            String searchLine;
            while ((searchLine = searchIn.readLine()) != null) {
                searchResponse.append(searchLine);
            }
            searchIn.close();
            
            // Parse the search results
            java.util.Map<String, Object> searchResult = mapper.readValue(
                searchResponse.toString(),
                new com.fasterxml.jackson.core.type.TypeReference<java.util.Map<String, Object>>(){}
            );
            
            // Structure the results
            java.util.List<java.util.Map<String, Object>> structuredResults = new java.util.ArrayList<>();
            
            @SuppressWarnings("unchecked")
            java.util.Map<String, Object> hits = (java.util.Map<String, Object>) searchResult.get("hits");
            if (hits != null) {
                @SuppressWarnings("unchecked")
                java.util.List<java.util.Map<String, Object>> hitsList = 
                    (java.util.List<java.util.Map<String, Object>>) hits.get("hits");
                
                if (hitsList != null) {
                    for (java.util.Map<String, Object> hit : hitsList) {
                        java.util.Map<String, Object> docResult = new java.util.HashMap<>();
                        docResult.put("id", hit.get("_id"));
                        
                        java.util.List<java.util.Map<String, Object>> matchedKeys = new java.util.ArrayList<>();
                        
                        @SuppressWarnings("unchecked")
                        java.util.Map<String, Object> innerHitsMap = 
                            (java.util.Map<String, Object>) hit.get("inner_hits");
                        
                        if (innerHitsMap != null) {
                            @SuppressWarnings("unchecked")
                            java.util.Map<String, Object> flatInnerHits = 
                                (java.util.Map<String, Object>) innerHitsMap.get("flat");
                            
                            if (flatInnerHits != null) {
                                @SuppressWarnings("unchecked")
                                java.util.Map<String, Object> flatHits = 
                                    (java.util.Map<String, Object>) flatInnerHits.get("hits");
                                
                                if (flatHits != null) {
                                    @SuppressWarnings("unchecked")
                                    java.util.List<java.util.Map<String, Object>> flatHitsList = 
                                        (java.util.List<java.util.Map<String, Object>>) flatHits.get("hits");
                                    
                                    if (flatHitsList != null) {
                                        for (java.util.Map<String, Object> innerHit : flatHitsList) {
                                            @SuppressWarnings("unchecked")
                                            java.util.Map<String, Object> source = 
                                                (java.util.Map<String, Object>) innerHit.get("_source");
                                            
                                            String path = (String) source.get("path");
                                            String value = (String) source.get("value");
                                            
                                            @SuppressWarnings("unchecked")
                                            java.util.Map<String, Object> highlight = 
                                                (java.util.Map<String, Object>) innerHit.get("highlight");
                                            
                                            if (highlight != null) {
                                                // Check if match is in path
                                                @SuppressWarnings("unchecked")
                                                java.util.List<String> pathHighlights = 
                                                    (java.util.List<String>) highlight.get("flat.path");
                                                if (pathHighlights != null && !pathHighlights.isEmpty()) {
                                                    String highlighted = pathHighlights.get(0);
                                                    int startIdx = highlighted.indexOf("[[HIGHLIGHT_START]]");
                                                    int endIdx = highlighted.indexOf("[[HIGHLIGHT_END]]");
                                                    
                                                    if (startIdx >= 0 && endIdx > startIdx) {
                                                        java.util.Map<String, Object> match = new java.util.HashMap<>();
                                                        match.put("key", path);
                                                        match.put("value", value);
                                                        match.put("match_in", "key");
                                                        match.put("start_index", startIdx);
                                                        match.put("end_index", endIdx - "[[HIGHLIGHT_START]]".length());
                                                        matchedKeys.add(match);
                                                    }
                                                }
                                                
                                                // Check if match is in value
                                                @SuppressWarnings("unchecked")
                                                java.util.List<String> valueHighlights = 
                                                    (java.util.List<String>) highlight.get("flat.value");
                                                if (valueHighlights != null && !valueHighlights.isEmpty()) {
                                                    String highlighted = valueHighlights.get(0);
                                                    int startIdx = highlighted.indexOf("[[HIGHLIGHT_START]]");
                                                    int endIdx = highlighted.indexOf("[[HIGHLIGHT_END]]");
                                                    
                                                    if (startIdx >= 0 && endIdx > startIdx) {
                                                        java.util.Map<String, Object> match = new java.util.HashMap<>();
                                                        match.put("key", path);
                                                        match.put("value", value);
                                                        match.put("match_in", "value");
                                                        match.put("start_index", startIdx);
                                                        match.put("end_index", endIdx - "[[HIGHLIGHT_START]]".length());
                                                        matchedKeys.add(match);
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        
                        docResult.put("matched_keys", matchedKeys);
                        structuredResults.add(docResult);
                    }
                }
            }
            
            return ApiResponse.success(structuredResults, "Search completed successfully");
            
        } catch (Exception e) {
            e.printStackTrace();
            return ApiResponse.error(-1, "Failed to search documents: " + e.getMessage());
        }
    }
}

