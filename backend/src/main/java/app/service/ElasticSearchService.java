package app.service;

import app.pojo.ElasticSearchConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class ElasticSearchService {

    private final ElasticSearchConfigService configService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ElasticSearchService(ElasticSearchConfigService configService) {
        this.configService = configService;
        System.out.println("ElasticSearchService initialized (using HTTP client)");
    }

    /**
     * Get base URI for Elasticsearch
     */
    private String getBaseUri() {
        ElasticSearchConfig config = configService.getConfigCurrent();
        String uris = config.getUris();
        String baseUri = uris.split(",")[0].trim();
        if (!baseUri.endsWith("/")) {
            baseUri += "/";
        }
        return baseUri;
    }

    /**
     * Setup HTTP connection with auth
     */
    private HttpURLConnection setupConnection(String urlString, String method) throws Exception {
        ElasticSearchConfig config = configService.getConfigCurrent();
        URL url = new URL(urlString);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod(method);
        connection.setConnectTimeout(5000);
        connection.setReadTimeout(10000);
        connection.setRequestProperty("Content-Type", "application/json");

        String username = config.getUsername();
        String password = config.getPassword();
        if (username != null && !username.isEmpty() && password != null && !password.isEmpty()) {
            String auth = username + ":" + password;
            String encodedAuth = Base64.getEncoder().encodeToString(auth.getBytes());
            connection.setRequestProperty("Authorization", "Basic " + encodedAuth);
        }

        return connection;
    }

    /**
     * Count documents by source (database and collection)
     */
    public long countDocNumBySource(String indexName, String dbName, String collName) throws Exception {
        indexName = indexName.toLowerCase();
        String baseUri = getBaseUri();
        String countUri = baseUri + indexName + "/_count";
        
        // Build query to filter by source.dbName and source.collName
        Map<String, Object> query = new HashMap<>();
        Map<String, Object> bool = new HashMap<>();
        List<Map<String, Object>> must = new ArrayList<>();
        
        Map<String, Object> dbMatch = new HashMap<>();
        Map<String, Object> dbTerm = new HashMap<>();
        dbTerm.put("source.dbName.keyword", dbName);
        dbMatch.put("term", dbTerm);
        must.add(dbMatch);
        
        Map<String, Object> collMatch = new HashMap<>();
        Map<String, Object> collTerm = new HashMap<>();
        collTerm.put("source.collName.keyword", collName);
        collMatch.put("term", collTerm);
        must.add(collMatch);
        
        bool.put("must", must);
        query.put("bool", bool);
        
        Map<String, Object> body = new HashMap<>();
        body.put("query", query);
        
        HttpURLConnection connection = setupConnection(countUri, "POST");
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "application/json");
        
        String jsonBody = objectMapper.writeValueAsString(body);
        System.out.println("ES Count Query for " + dbName + "." + collName + ": " + jsonBody);
        
        try (OutputStream os = connection.getOutputStream()) {
            byte[] input = jsonBody.getBytes("utf-8");
            os.write(input, 0, input.length);
        }
        
        int respCode = connection.getResponseCode();
        if (respCode != 200) {
            String errorResponse = readResponse(connection);
            throw new Exception("Failed to count documents: HTTP " + respCode + " - " + errorResponse);
        }
        
        String response = readResponse(connection);
        System.out.println("ES Count Response: " + response);
        
        @SuppressWarnings("unchecked")
        Map<String, Object> result = objectMapper.readValue(response, Map.class);
        
        long count = ((Number) result.get("count")).longValue();
        System.out.println("Found " + count + " documents for " + dbName + "." + collName);
        
        return count;
    }

    /**
     * Read response from connection
     */
    private String readResponse(HttpURLConnection connection) throws Exception {
        BufferedReader in = new BufferedReader(new InputStreamReader(connection.getInputStream()));
        StringBuilder response = new StringBuilder();
        String inputLine;
        while ((inputLine = in.readLine()) != null) {
            response.append(inputLine);
        }
        in.close();
        return response.toString();
    }

    /**
     * Create or clear an index
     */
    public void createOrClearIndex(String indexName, boolean clearIfExists) throws Exception {
        indexName = indexName.toLowerCase();
        String baseUri = getBaseUri();
        String indexUri = baseUri + indexName;

        // Check if index exists
        boolean exists = indexExists(indexName);

        if (exists) {
            if (clearIfExists) {
                // Delete the index
                HttpURLConnection deleteConn = setupConnection(indexUri, "DELETE");
                int respCode = deleteConn.getResponseCode();
                if (respCode == 200) {
                    System.out.println("Deleted existing ES index: " + indexName);
                } else {
                    throw new Exception("Failed to delete index: HTTP " + respCode);
                }
            } else {
                System.out.println("ES index already exists: " + indexName);
                return;
            }
        }

        // Create the index with char-level indexing using raw JSON
        String jsonBody = """
            {
              "settings": {
                "number_of_shards": 1,
                "analysis": {
                  "analyzer": {
                    "char_analyzer": {
                      "type": "custom",
                      "tokenizer": "char_tokenizer",
                      "filter": []
                    }
                  },
                  "tokenizer": {
                    "char_tokenizer": {
                      "type": "pattern",
                      "pattern": ""
                    }
                  }
                }
              },
              "mappings": {
                "properties": {

                  "flat": {
                    "type": "nested",
                    "properties": {
                      "path": {
                        "type": "text",
                        "analyzer": "char_analyzer",
                        "term_vector": "with_positions_offsets"
                      },
                      "value": {
                        "type": "text",
                        "analyzer": "char_analyzer",
                        "term_vector": "with_positions_offsets"
                      }
                    }
                  }
                }
              }
            }
            """;

        HttpURLConnection createConn = setupConnection(indexUri, "PUT");
        createConn.setDoOutput(true);
        try (OutputStream os = createConn.getOutputStream()) {
            byte[] input = jsonBody.getBytes("utf-8");
            os.write(input, 0, input.length);
        }

        int respCode = createConn.getResponseCode();
        if (respCode == 200 || respCode == 201) {
            System.out.println("Created ES index: " + indexName);
        } else {
            String errorResponse = readResponse(createConn);
            throw new Exception("Failed to create index: HTTP " + respCode + " - " + errorResponse);
        }
    }

    /**
     * Index a flattened document (list of path/value pairs)
     * Uses nested structure with "flat" field containing all path/value pairs
     * Uses optimistic concurrency control with if_seq_no and if_primary_term
     */
    public void indexDoc(String indexName, String docId, String database, String collection,
                             List<Map<String, String>> flattenedPairs, long updateVersion, 
                             long updateAt, Integer updateAtTimeZone, boolean forceReindex) throws Exception {
        indexName = indexName.toLowerCase();
        String baseUri = getBaseUri();
        
        // First, try to get existing document to check version and get seq_no/primary_term
        Long seqNo = null;
        Long primaryTerm = null;
        
        if (!forceReindex) {
            // Only do version checking if not forcing reindex
            try {
                String getUri = baseUri + indexName + "/_doc/" + docId;
                HttpURLConnection getConn = setupConnection(getUri, "GET");
                int getResponseCode = getConn.getResponseCode();
                
                if (getResponseCode == 200) {
                    // Document exists, check its version
                    String response = readResponse(getConn);
                    @SuppressWarnings("unchecked")
                    Map<String, Object> result = objectMapper.readValue(response, Map.class);
                    
                    // Get seq_no and primary_term for optimistic concurrency control
                    seqNo = ((Number) result.get("_seq_no")).longValue();
                    primaryTerm = ((Number) result.get("_primary_term")).longValue();
                    
                    // Get the existing updateVersion
                    @SuppressWarnings("unchecked")
                    Map<String, Object> source = (Map<String, Object>) result.get("_source");
                    if (source != null && source.containsKey("updateVersion")) {
                        Long existingVersion = ((Number) source.get("updateVersion")).longValue();
                        
                        // Only update if our version is greater than or equal to existing
                        if (updateVersion < existingVersion) {
                            System.err.println("WARNING: Aborting ES index update for doc " + docId + 
                                ". Existing ES version " + existingVersion + " is higher than attempted version " + updateVersion + 
                                ". This prevents overwriting newer data with older data.");
                            return;
                        }
                        
                        if (updateVersion == existingVersion) {
                            System.out.println("Info: Skipping ES index update for doc " + docId + 
                                ". Version " + updateVersion + " is already indexed (no change needed).");
                            return;
                        }
                    }
                }
                // If 404, document doesn't exist - proceed with creation
            } catch (Exception e) {
                // If we can't read, proceed anyway (might be first creation)
                System.err.println("Warning: Could not read existing document for version check: " + e.getMessage());
            }
        }
        
        // Create document with nested flat field and metadata
        Map<String, Object> doc = new HashMap<>();
        doc.put("flat", flattenedPairs);
        doc.put("updateVersion", updateVersion);
        doc.put("updateAt", updateAt);
        if (updateAtTimeZone != null) {
            doc.put("updateAtTimeZone", updateAtTimeZone);
        }
        Map<String, Object> source = new HashMap<>();
        source.put("dbName", database);
        source.put("collName", collection);
        doc.put("source", source);

        // Build URI with if_seq_no and if_primary_term if we have them
        String indexUri = baseUri + indexName + "/_doc/" + docId;
        if (seqNo != null && primaryTerm != null) {
            indexUri += "?if_seq_no=" + seqNo + "&if_primary_term=" + primaryTerm;
        }

        HttpURLConnection connection = setupConnection(indexUri, "PUT");
        connection.setDoOutput(true);

        String jsonBody = objectMapper.writeValueAsString(doc);
        try (OutputStream os = connection.getOutputStream()) {
            byte[] input = jsonBody.getBytes("utf-8");
            os.write(input, 0, input.length);
        }

        int respCode = connection.getResponseCode();
        if (respCode == 409) {
            // Version conflict - document was modified by someone else
            throw new Exception("Version conflict: document " + docId + " was modified concurrently. Retry may be needed.");
        } else if (respCode != 200 && respCode != 201) {
            String errorResponse = readResponse(connection);
            throw new Exception("Failed to index document: HTTP " + respCode + " - " + errorResponse);
        }

        System.out.println("Indexed " + flattenedPairs.size() + " path/value pairs for doc " + docId + " (version " + updateVersion + ") to ES index " + indexName);
    }

    /**
     * Delete document by ES document ID (which is the MongoDB docId)
     * WITHOUT version control - use deleteDocumentWithVersion for version-controlled deletes
     */
    public void deleteDocument(String indexName, String docId) throws Exception {
        indexName = indexName.toLowerCase();
        String baseUri = getBaseUri();
        String deleteUri = baseUri + indexName + "/_doc/" + docId;

        HttpURLConnection connection = setupConnection(deleteUri, "DELETE");
        int respCode = connection.getResponseCode();
        
        if (respCode == 200 || respCode == 404) {
            // 404 is OK - document may not exist
            System.out.println("Deleted doc " + docId + " from ES index " + indexName);
        } else {
            String errorResponse = readResponse(connection);
            throw new Exception("Failed to delete document: HTTP " + respCode + " - " + errorResponse);
        }
    }

    /**
     * Delete document with optimistic concurrency control using MongoDB updateVersion
     * 
     * @param indexName ES index name
     * @param docId Document ID
     * @param deleteVersion The MongoDB updateVersion at time of deletion
     */
    public void deleteDocumentWithVersion(String indexName, String docId, long deleteVersion) throws Exception {
        indexName = indexName.toLowerCase();
        String baseUri = getBaseUri();
        
        // First, try to get existing document to check version and get seq_no/primary_term
        Long seqNo = null;
        Long primaryTerm = null;
        
        try {
            String getUri = baseUri + indexName + "/_doc/" + docId;
            HttpURLConnection getConn = setupConnection(getUri, "GET");
            int getResponseCode = getConn.getResponseCode();
            
            if (getResponseCode == 200) {
                // Document exists, check its version
                String response = readResponse(getConn);
                @SuppressWarnings("unchecked")
                Map<String, Object> result = objectMapper.readValue(response, Map.class);
                
                // Get seq_no and primary_term for optimistic concurrency control
                seqNo = ((Number) result.get("_seq_no")).longValue();
                primaryTerm = ((Number) result.get("_primary_term")).longValue();
                
                // Get the existing updateVersion
                @SuppressWarnings("unchecked")
                Map<String, Object> source = (Map<String, Object>) result.get("_source");
                if (source != null && source.containsKey("updateVersion")) {
                    Long existingVersion = ((Number) source.get("updateVersion")).longValue();
                    
                    // Only delete if ES version is < deleteVersion
                    // If ES version >= deleteVersion, a newer update has already been indexed
                    if (existingVersion > deleteVersion) {
                        System.err.println("WARNING: Aborting ES delete for doc " + docId + 
                            ". Existing ES version " + existingVersion + " is higher than delete version " + deleteVersion + 
                            ". A late-arriving update has already indexed newer data.");
                        return;
                    }
                    
                    if (existingVersion < deleteVersion) {
                        System.out.println("Info: Proceeding with ES delete for doc " + docId + 
                            ". ES version " + existingVersion + " < delete version " + deleteVersion);
                    }
                }
            } else if (getResponseCode == 404) {
                // Document doesn't exist in ES - nothing to delete
                System.out.println("Info: Document " + docId + " not found in ES (already deleted or never indexed)");
                return;
            }
        } catch (Exception e) {
            // If we can't read, proceed with delete anyway (might not exist)
            System.err.println("Warning: Could not read existing document for version check before delete: " + e.getMessage());
        }
        
        // Build delete URI with if_seq_no and if_primary_term if we have them
        String deleteUri = baseUri + indexName + "/_doc/" + docId;
        if (seqNo != null && primaryTerm != null) {
            deleteUri += "?if_seq_no=" + seqNo + "&if_primary_term=" + primaryTerm;
        }

        HttpURLConnection connection = setupConnection(deleteUri, "DELETE");
        int respCode = connection.getResponseCode();
        
        if (respCode == 409) {
            // Version conflict - document was modified by someone else
            System.err.println("Version conflict during delete: document " + docId + " was modified concurrently. Delete aborted.");
            // Don't throw - this is expected behavior with concurrent operations
        } else if (respCode == 200 || respCode == 404) {
            // 200 = deleted, 404 = already gone
            System.out.println("Deleted doc " + docId + " from ES index " + indexName + " (version " + deleteVersion + ")");
        } else {
            String errorResponse = readResponse(connection);
            throw new Exception("Failed to delete document: HTTP " + respCode + " - " + errorResponse);
        }
    }

    /**
     * Get document count for an index
     */
    public long getDocumentCount(String indexName) throws Exception {
        indexName = indexName.toLowerCase();
        String baseUri = getBaseUri();
        String countUri = baseUri + indexName + "/_count";

        HttpURLConnection connection = setupConnection(countUri, "GET");
        int respCode = connection.getResponseCode();

        if (respCode == 200) {
            String response = readResponse(connection);
            @SuppressWarnings("unchecked")
            Map<String, Object> result = objectMapper.readValue(response, Map.class);
            return ((Number) result.get("count")).longValue();
        } else if (respCode == 404) {
            // Index doesn't exist
            return 0;
        } else {
            throw new Exception("Failed to get document count: HTTP " + respCode);
        }
    }

    /**
     * Check if index exists
     */
    public boolean indexExists(String indexName) throws Exception {
        indexName = indexName.toLowerCase();
        String baseUri = getBaseUri();
        String indexUri = baseUri + indexName;

        HttpURLConnection connection = setupConnection(indexUri, "HEAD");
        int respCode = connection.getResponseCode();
        return respCode == 200;
    }

    /**
     * Test Elasticsearch connection
     */
    public String testConnection() throws Exception {
        String baseUri = getBaseUri();
        String testUri = baseUri + "_cluster/health";

        HttpURLConnection connection = setupConnection(testUri, "GET");
        int respCode = connection.getResponseCode();

        if (respCode == 200) {
            String response = readResponse(connection);
            return response;
        } else {
            throw new Exception("Connection test failed with HTTP " + respCode);
        }
    }

    /**
     * List all indices
     */
    public List<String> listIndices() throws Exception {
        String baseUri = getBaseUri();
        String listUri = baseUri + "_cat/indices?format=json&expand_wildcards=all";

        HttpURLConnection connection = setupConnection(listUri, "GET");
        int respCode = connection.getResponseCode();

        if (respCode == 200) {
            String response = readResponse(connection);
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> indices = objectMapper.readValue(response, List.class);

            List<String> indexNames = new ArrayList<>();
            for (Map<String, Object> index : indices) {
                String indexName = (String) index.get("index");
                if (indexName != null && !indexName.startsWith(".")) {
                    indexNames.add(indexName);
                }
            }
            return indexNames;
        } else {
            throw new Exception("Failed to list indices: HTTP " + respCode);
        }
    }

    /**
     * Get index information
     */
    public Map<String, Object> getIndexInfo(String indexName) throws Exception {
        indexName = indexName.toLowerCase();
        String baseUri = getBaseUri();
        String infoUri = baseUri + indexName;

        HttpURLConnection connection = setupConnection(infoUri, "GET");
        int respCode = connection.getResponseCode();

        if (respCode == 200) {
            String response = readResponse(connection);
            @SuppressWarnings("unchecked")
            Map<String, Object> indexInfo = objectMapper.readValue(response, Map.class);
            return indexInfo;
        } else if (respCode == 404) {
            throw new Exception("Index not found: " + indexName);
        } else {
            throw new Exception("Failed to get index info: HTTP " + respCode);
        }
    }

    /**
     * Create an index with optional settings/mappings
     */
    public void createIndex(String indexName, Map<String, Object> body) throws Exception {
        indexName = indexName.toLowerCase();
        String baseUri = getBaseUri();
        String createUri = baseUri + indexName;

        HttpURLConnection connection = setupConnection(createUri, "PUT");
        connection.setDoOutput(true);

        if (body != null && !body.isEmpty()) {
            String jsonBody = objectMapper.writeValueAsString(body);
            try (OutputStream os = connection.getOutputStream()) {
                os.write(jsonBody.getBytes("utf-8"));
            }
        }

        int respCode = connection.getResponseCode();
        if (respCode == 200 || respCode == 201) {
            System.out.println("Created index: " + indexName);
        } else {
            String errorResponse = readResponse(connection);
            throw new Exception("Failed to create index: HTTP " + respCode + " - " + errorResponse);
        }
    }

    /**
     * Delete an index
     */
    public void deleteIndex(String indexName) throws Exception {
        indexName = indexName.toLowerCase();
        String baseUri = getBaseUri();
        String deleteUri = baseUri + indexName;

        HttpURLConnection connection = setupConnection(deleteUri, "DELETE");
        int respCode = connection.getResponseCode();

        if (respCode == 200) {
            System.out.println("Deleted index: " + indexName);
        } else if (respCode == 404) {
            throw new Exception("Index not found: " + indexName);
        } else {
            throw new Exception("Failed to delete index: HTTP " + respCode);
        }
    }

    /**
     * Rename an index using reindex + delete
     */
    public void renameIndex(String oldName, String newName) throws Exception {
        oldName = oldName.toLowerCase();
        newName = newName.toLowerCase();
        String baseUri = getBaseUri();

        // Step 1: Reindex
        String reindexUri = baseUri + "_reindex";
        Map<String, Object> reindexBody = new HashMap<>();
        reindexBody.put("source", Map.of("index", oldName));
        reindexBody.put("dest", Map.of("index", newName));

        HttpURLConnection reindexConn = setupConnection(reindexUri, "POST");
        reindexConn.setConnectTimeout(30000);
        reindexConn.setReadTimeout(30000);
        reindexConn.setDoOutput(true);

        String jsonBody = objectMapper.writeValueAsString(reindexBody);
        try (OutputStream os = reindexConn.getOutputStream()) {
            os.write(jsonBody.getBytes("utf-8"));
        }

        int reindexRespCode = reindexConn.getResponseCode();
        if (reindexRespCode != 200) {
            String errorResponse = readResponse(reindexConn);
            throw new Exception("Failed to reindex: HTTP " + reindexRespCode + " - " + errorResponse);
        }

        // Step 2: Delete old index
        deleteIndex(oldName);
        System.out.println("Renamed index from " + oldName + " to " + newName);
    }

    /**
     * Get documents from an index with pagination
     */
    public Map<String, Object> getDocuments(String indexName, int page, int pageSize) throws Exception {
        indexName = indexName.toLowerCase();
        String baseUri = getBaseUri();
        int from = (page - 1) * pageSize;
        String searchUri = baseUri + indexName + "/_search?from=" + from + "&size=" + pageSize;

        HttpURLConnection connection = setupConnection(searchUri, "GET");
        int respCode = connection.getResponseCode();

        if (respCode == 200) {
            String response = readResponse(connection);
            @SuppressWarnings("unchecked")
            Map<String, Object> searchResult = objectMapper.readValue(response, Map.class);

            // Extract documents
            @SuppressWarnings("unchecked")
            Map<String, Object> hits = (Map<String, Object>) searchResult.get("hits");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> hitsList = (List<Map<String, Object>>) hits.get("hits");

            List<Map<String, Object>> documents = new ArrayList<>();
            for (Map<String, Object> hit : hitsList) {
                @SuppressWarnings("unchecked")
                Map<String, Object> source = (Map<String, Object>) hit.get("_source");
                Map<String, Object> doc = new HashMap<>(source);
                doc.put("_id", hit.get("_id"));
                documents.add(doc);
            }

            // Get total count
            @SuppressWarnings("unchecked")
            Map<String, Object> totalObj = (Map<String, Object>) hits.get("total");
            int total = 0;
            if (totalObj != null) {
                Object value = totalObj.get("value");
                if (value instanceof Integer) {
                    total = (Integer) value;
                }
            }

            Map<String, Object> result = new HashMap<>();
            result.put("documents", documents);
            result.put("total", total);
            result.put("page", page);
            result.put("pageSize", pageSize);

            return result;
        } else {
            throw new Exception("Failed to get documents: HTTP " + respCode);
        }
    }

    /**
     * Create a document in an index
     */
    public String createDocument(String indexName, Map<String, Object> body) throws Exception {
        indexName = indexName.toLowerCase();
        String baseUri = getBaseUri();
        String createUri = baseUri + indexName + "/_doc";

        HttpURLConnection connection = setupConnection(createUri, "POST");
        connection.setDoOutput(true);

        String jsonBody = objectMapper.writeValueAsString(body);
        try (OutputStream os = connection.getOutputStream()) {
            os.write(jsonBody.getBytes("utf-8"));
        }

        int respCode = connection.getResponseCode();
        if (respCode == 200 || respCode == 201) {
            String response = readResponse(connection);
            @SuppressWarnings("unchecked")
            Map<String, Object> createResult = objectMapper.readValue(response, Map.class);
            String docId = (String) createResult.get("_id");
            System.out.println("Created document: " + docId);
            return docId;
        } else {
            throw new Exception("Failed to create document: HTTP " + respCode);
        }
    }

    /**
     * Update a document in an index
     */
    public void updateDocument(String indexName, String docId, Map<String, Object> body) throws Exception {
        indexName = indexName.toLowerCase();
        String baseUri = getBaseUri();
        String updateUri = baseUri + indexName + "/_doc/" + docId;

        HttpURLConnection connection = setupConnection(updateUri, "PUT");
        connection.setDoOutput(true);

        String jsonBody = objectMapper.writeValueAsString(body);
        try (OutputStream os = connection.getOutputStream()) {
            os.write(jsonBody.getBytes("utf-8"));
        }

        int respCode = connection.getResponseCode();
        if (respCode == 200 || respCode == 201) {
            System.out.println("Updated document: " + docId);
        } else if (respCode == 404) {
            throw new Exception("Document not found: " + docId);
        } else {
            throw new Exception("Failed to update document: HTTP " + respCode);
        }
    }

    /**
     * Get a single document by ID
     */
    public Map<String, Object> getDocument(String indexName, String docId) throws Exception {
        indexName = indexName.toLowerCase();
        String baseUri = getBaseUri();
        String getUri = baseUri + indexName + "/_doc/" + docId;

        HttpURLConnection connection = setupConnection(getUri, "GET");
        int respCode = connection.getResponseCode();

        if (respCode == 200) {
            String response = readResponse(connection);
            @SuppressWarnings("unchecked")
            Map<String, Object> getDoc = objectMapper.readValue(response, Map.class);

            @SuppressWarnings("unchecked")
            Map<String, Object> source = (Map<String, Object>) getDoc.get("_source");
            Map<String, Object> doc = new HashMap<>(source);
            doc.put("_id", getDoc.get("_id"));
            return doc;
        } else if (respCode == 404) {
            throw new Exception("Document not found: " + docId);
        } else {
            throw new Exception("Failed to get document: HTTP " + respCode);
        }
    }

    /**
     * Update index metadata settings
     * Adds or updates a key-value pair under index.meta
     */
    public void updateIndexMeta(String indexName, String key, String value) throws Exception {
        indexName = indexName.toLowerCase();
        String baseUri = getBaseUri();
        String settingsUri = baseUri + indexName + "/_settings";

        // Build settings update with index.meta.key = value
        Map<String, Object> settings = new HashMap<>();
        settings.put("index.meta." + key, value);

        HttpURLConnection connection = setupConnection(settingsUri, "PUT");
        connection.setDoOutput(true);

        String jsonBody = objectMapper.writeValueAsString(settings);
        try (OutputStream os = connection.getOutputStream()) {
            byte[] input = jsonBody.getBytes("utf-8");
            os.write(input, 0, input.length);
        }

        int respCode = connection.getResponseCode();
        if (respCode == 200) {
            System.out.println("Updated index meta for " + indexName + ": " + key + " = " + value);
        } else {
            String errorResponse = readResponse(connection);
            throw new Exception("Failed to update index meta: HTTP " + respCode + " - " + errorResponse);
        }
    }

    /**
     * Get index settings including metadata
     */
    public Map<String, Object> getIndexSettings(String indexName) throws Exception {
        indexName = indexName.toLowerCase();
        String baseUri = getBaseUri();
        String settingsUri = baseUri + indexName + "/_settings";

        HttpURLConnection connection = setupConnection(settingsUri, "GET");
        int respCode = connection.getResponseCode();

        if (respCode == 200) {
            String response = readResponse(connection);
            @SuppressWarnings("unchecked")
            Map<String, Object> result = objectMapper.readValue(response, Map.class);
            return result;
        } else if (respCode == 404) {
            throw new Exception("Index not found: " + indexName);
        } else {
            String errorResponse = readResponse(connection);
            throw new Exception("Failed to get index settings: HTTP " + respCode + " - " + errorResponse);
        }
    }

    /**
     * Search documents with pagination and validation for character-level indices
     */
    public Map<String, Object> searchDocsWithPagination(String indexName, String query,
                                                              boolean searchInPaths, boolean searchInValues,
                                                              int page, int pageSize) throws Exception {
        indexName = indexName.toLowerCase();
        String baseUri = getBaseUri();

        // First, check if this is a character-level index by getting its mapping
        String mappingUri = baseUri + indexName + "/_mapping";
        HttpURLConnection mappingConn = setupConnection(mappingUri, "GET");
        int mappingResponseCode = mappingConn.getResponseCode();

        if (mappingResponseCode != 200) {
            throw new Exception("Failed to get index mapping");
        }

        String mappingResponse = readResponse(mappingConn);
        if (!mappingResponse.contains("\"flat\"") || !mappingResponse.contains("\"path\"") || !mappingResponse.contains("\"value\"")) {
            throw new Exception("Index '" + indexName + "' is not a character-level index. " +
                "It must have a 'flat' nested field with 'path' and 'value' subfields.");
        }

        // Use existing searchCharIndex method but with pagination
        List<Map<String, Object>> results = searchCharIndexWithPagination(indexName, query, searchInPaths, searchInValues, page, pageSize);

        // Get total count (approximate - we use page results)
        long totalHits = results.size(); // This is a simplification; real impl would query ES for total

        Map<String, Object> responseData = new HashMap<>();
        responseData.put("results", results);
        responseData.put("total", totalHits);
        responseData.put("page", page);
        responseData.put("page_size", pageSize);
        responseData.put("total_pages", (int) Math.ceil((double) totalHits / pageSize));

        return responseData;
    }

    /**
     * Search a character-level index with pagination
     */
    private List<Map<String, Object>> searchCharIndexWithPagination(String indexName, String query,
                                                                      boolean searchInPaths, boolean searchInValues,
                                                                      int page, int pageSize) throws Exception {
        indexName = indexName.toLowerCase();
        String baseUri = getBaseUri();
        String searchUri = baseUri + indexName + "/_search";

        // Build should conditions
        List<Map<String, Object>> shouldConditions = new ArrayList<>();

        if (searchInValues) {
            Map<String, Object> valueMatch = new HashMap<>();
            valueMatch.put("match_phrase", Map.of("flat.value", query));
            shouldConditions.add(valueMatch);
        }

        if (searchInPaths) {
            Map<String, Object> pathMatch = new HashMap<>();
            pathMatch.put("match_phrase", Map.of("flat.path", query));
            shouldConditions.add(pathMatch);
        }

        // Build highlight fields
        Map<String, Object> highlightConfig = new HashMap<>();
        highlightConfig.put("type", "fvh");
        highlightConfig.put("pre_tags", new String[]{"[[HIGHLIGHT_START]]"});
        highlightConfig.put("post_tags", new String[]{"[[HIGHLIGHT_END]]"});
        highlightConfig.put("fragment_size", 999999);
        highlightConfig.put("number_of_fragments", 0);

        Map<String, Object> highlightFields = new HashMap<>();
        if (searchInValues) {
            highlightFields.put("flat.value", highlightConfig);
        }
        if (searchInPaths) {
            highlightFields.put("flat.path", highlightConfig);
        }

        // Build search query with pagination
        int from = (page - 1) * pageSize;
        Map<String, Object> searchQuery = new HashMap<>();
        searchQuery.put("query", Map.of(
            "nested", Map.of(
                "path", "flat",
                "query", Map.of("bool", Map.of("should", shouldConditions)),
                "inner_hits", Map.of(
                    "_source", true,
                    "size", 100,
                    "highlight", Map.of("fields", highlightFields)
                )
            )
        ));
        searchQuery.put("from", from);
        searchQuery.put("size", pageSize);
        searchQuery.put("track_total_hits", true);

        // Execute search
        HttpURLConnection connection = setupConnection(searchUri, "POST");
        connection.setDoOutput(true);
        String jsonQuery = objectMapper.writeValueAsString(searchQuery);

        try (OutputStream os = connection.getOutputStream()) {
            os.write(jsonQuery.getBytes("utf-8"));
        }

        int respCode = connection.getResponseCode();
        if (respCode != 200) {
            String errorResponse = readResponse(connection);
            throw new Exception("Search failed: HTTP " + respCode + " - " + errorResponse);
        }

        String response = readResponse(connection);
        @SuppressWarnings("unchecked")
        Map<String, Object> result = objectMapper.readValue(response, Map.class);

        // Parse results
        List<Map<String, Object>> structuredResults = new ArrayList<>();
        @SuppressWarnings("unchecked")
        Map<String, Object> hits = (Map<String, Object>) result.get("hits");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> hitsList = (List<Map<String, Object>>) hits.get("hits");

        for (Map<String, Object> hit : hitsList) {
            Map<String, Object> docResult = new HashMap<>();
            docResult.put("id", hit.get("_id"));
            List<Map<String, Object>> matchedKeys = new ArrayList<>();

            @SuppressWarnings("unchecked")
            Map<String, Object> innerHitsMap = (Map<String, Object>) hit.get("inner_hits");
            if (innerHitsMap != null) {
                @SuppressWarnings("unchecked")
                Map<String, Object> flatInnerHits = (Map<String, Object>) innerHitsMap.get("flat");
                @SuppressWarnings("unchecked")
                Map<String, Object> innerHitsData = (Map<String, Object>) flatInnerHits.get("hits");
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> innerHitsList = (List<Map<String, Object>>) innerHitsData.get("hits");

                for (Map<String, Object> innerHit : innerHitsList) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> source = (Map<String, Object>) innerHit.get("_source");
                    String path = (String) source.get("path");
                    String value = (String) source.get("value");

                    @SuppressWarnings("unchecked")
                    Map<String, Object> highlight = (Map<String, Object>) innerHit.get("highlight");
                    if (highlight != null) {
                        // Process highlighted values
                        if (highlight.containsKey("flat.value") && searchInValues) {
                            @SuppressWarnings("unchecked")
                            List<String> highlightedTexts = (List<String>) highlight.get("flat.value");
                            for (String highlightedText : highlightedTexts) {
                                List<int[]> positions = extractPositionsFromHighlight(highlightedText, value);
                                for (int[] pos : positions) {
                                    Map<String, Object> match = new HashMap<>();
                                    match.put("key", path);
                                    match.put("value", value);
                                    match.put("match_in", "value");
                                    match.put("start_index", pos[0]);
                                    match.put("end_index", pos[1]);
                                    matchedKeys.add(match);
                                }
                            }
                        }

                        // Process highlighted paths
                        if (highlight.containsKey("flat.path") && searchInPaths) {
                            @SuppressWarnings("unchecked")
                            List<String> highlightedTexts = (List<String>) highlight.get("flat.path");
                            for (String highlightedText : highlightedTexts) {
                                List<int[]> positions = extractPositionsFromHighlight(highlightedText, path);
                                for (int[] pos : positions) {
                                    Map<String, Object> match = new HashMap<>();
                                    match.put("key", path);
                                    match.put("value", value);
                                    match.put("match_in", "key");
                                    match.put("start_index", pos[0]);
                                    match.put("end_index", pos[1]);
                                    matchedKeys.add(match);
                                }
                            }
                        }
                    }
                }
            }

            if (!matchedKeys.isEmpty()) {
                docResult.put("matched_keys", matchedKeys);
                structuredResults.add(docResult);
            }
        }

        return structuredResults;
    }

    /**
     * Search a character-level index and return structured results with highlights
     * Based on Python _3b_es_highlight.py implementation
     */
    public List<Map<String, Object>> searchCharIndex(String indexName, String query, 
                                                      boolean searchInPaths, boolean searchInValues) throws Exception {
        indexName = indexName.toLowerCase();
        String baseUri = getBaseUri();
        String searchUri = baseUri + indexName + "/_search";

        // Build should conditions
        List<Map<String, Object>> shouldConditions = new ArrayList<>();
        
        if (searchInValues) {
            Map<String, Object> valueMatch = new HashMap<>();
            valueMatch.put("match_phrase", Map.of("flat.value", query));
            shouldConditions.add(valueMatch);
        }
        
        if (searchInPaths) {
            Map<String, Object> pathMatch = new HashMap<>();
            pathMatch.put("match_phrase", Map.of("flat.path", query));
            shouldConditions.add(pathMatch);
        }

        // Build highlight fields (using FVH highlighter for match_phrase)
        Map<String, Object> highlightConfig = new HashMap<>();
        highlightConfig.put("type", "fvh");
        highlightConfig.put("pre_tags", new String[]{"[[HIGHLIGHT_START]]"});
        highlightConfig.put("post_tags", new String[]{"[[HIGHLIGHT_END]]"});
        highlightConfig.put("fragment_size", 999999);
        highlightConfig.put("number_of_fragments", 0);
        
        Map<String, Object> highlightFields = new HashMap<>();
        if (searchInValues) {
            highlightFields.put("flat.value", highlightConfig);
        }
        if (searchInPaths) {
            highlightFields.put("flat.path", highlightConfig);
        }

        // Build search query
        Map<String, Object> searchQuery = new HashMap<>();
        searchQuery.put("query", Map.of(
            "nested", Map.of(
                "path", "flat",
                "query", Map.of("bool", Map.of("should", shouldConditions)),
                "inner_hits", Map.of(
                    "_source", true,
                    "size", 100,
                    "highlight", Map.of("fields", highlightFields)
                )
            )
        ));
        searchQuery.put("size", 100);

        // Execute search
        HttpURLConnection connection = setupConnection(searchUri, "POST");
        connection.setDoOutput(true);
        String jsonQuery = objectMapper.writeValueAsString(searchQuery);
        
        try (OutputStream os = connection.getOutputStream()) {
            os.write(jsonQuery.getBytes("utf-8"));
        }

        int respCode = connection.getResponseCode();
        if (respCode != 200) {
            String errorResponse = readResponse(connection);
            throw new Exception("Search failed: HTTP " + respCode + " - " + errorResponse);
        }

        String response = readResponse(connection);
        @SuppressWarnings("unchecked")
        Map<String, Object> result = objectMapper.readValue(response, Map.class);

        // Parse results
        List<Map<String, Object>> structuredResults = new ArrayList<>();
        @SuppressWarnings("unchecked")
        Map<String, Object> hits = (Map<String, Object>) result.get("hits");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> hitsList = (List<Map<String, Object>>) hits.get("hits");

        for (Map<String, Object> hit : hitsList) {
            Map<String, Object> docResult = new HashMap<>();
            docResult.put("id", hit.get("_id"));
            List<Map<String, Object>> matchedKeys = new ArrayList<>();

            @SuppressWarnings("unchecked")
            Map<String, Object> innerHitsMap = (Map<String, Object>) hit.get("inner_hits");
            if (innerHitsMap != null) {
                @SuppressWarnings("unchecked")
                Map<String, Object> flatInnerHits = (Map<String, Object>) innerHitsMap.get("flat");
                @SuppressWarnings("unchecked")
                Map<String, Object> innerHitsData = (Map<String, Object>) flatInnerHits.get("hits");
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> innerHitsList = (List<Map<String, Object>>) innerHitsData.get("hits");

                for (Map<String, Object> innerHit : innerHitsList) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> source = (Map<String, Object>) innerHit.get("_source");
                    String path = (String) source.get("path");
                    String value = (String) source.get("value");

                    @SuppressWarnings("unchecked")
                    Map<String, Object> highlight = (Map<String, Object>) innerHit.get("highlight");
                    if (highlight != null) {
                        // Process highlighted values
                        if (highlight.containsKey("flat.value") && searchInValues) {
                            @SuppressWarnings("unchecked")
                            List<String> highlightedTexts = (List<String>) highlight.get("flat.value");
                            for (String highlightedText : highlightedTexts) {
                                List<int[]> positions = extractPositionsFromHighlight(highlightedText, value);
                                for (int[] pos : positions) {
                                    Map<String, Object> match = new HashMap<>();
                                    match.put("key", path);
                                    match.put("value", value);
                                    match.put("match_in", "value");
                                    match.put("start_index", pos[0]);
                                    match.put("end_index", pos[1]);
                                    matchedKeys.add(match);
                                }
                            }
                        }

                        // Process highlighted paths
                        if (highlight.containsKey("flat.path") && searchInPaths) {
                            @SuppressWarnings("unchecked")
                            List<String> highlightedTexts = (List<String>) highlight.get("flat.path");
                            for (String highlightedText : highlightedTexts) {
                                List<int[]> positions = extractPositionsFromHighlight(highlightedText, path);
                                for (int[] pos : positions) {
                                    Map<String, Object> match = new HashMap<>();
                                    match.put("key", path);
                                    match.put("value", value);
                                    match.put("match_in", "key");
                                    match.put("start_index", pos[0]);
                                    match.put("end_index", pos[1]);
                                    matchedKeys.add(match);
                                }
                            }
                        }
                    }
                }
            }

            if (!matchedKeys.isEmpty()) {
                docResult.put("matched_keys", matchedKeys);
                structuredResults.add(docResult);
            }
        }

        return structuredResults;
    }

    /**
     * Extract match positions from ES highlighted text
     * Based on Python extract_positions_from_highlight function
     */
    private List<int[]> extractPositionsFromHighlight(String highlightedText, String originalText) {
        List<int[]> positions = new ArrayList<>();
        String startTag = "[[HIGHLIGHT_START]]";
        String endTag = "[[HIGHLIGHT_END]]";
        
        int currentPos = 0;
        while (true) {
            int startIdx = highlightedText.indexOf(startTag, currentPos);
            if (startIdx == -1) break;
            
            // Calculate position in original text (accounting for previous tags)
            String beforeStart = highlightedText.substring(0, startIdx);
            int tagsBefore = (beforeStart.length() - beforeStart.replace(startTag, "").length()) / startTag.length();
            int endTagsBefore = (beforeStart.length() - beforeStart.replace(endTag, "").length()) / endTag.length();
            int originalPos = startIdx - (tagsBefore * startTag.length()) - (endTagsBefore * endTag.length());
            
            int endIdx = highlightedText.indexOf(endTag, startIdx);
            if (endIdx == -1) break;
            
            String matchText = highlightedText.substring(startIdx + startTag.length(), endIdx);
            int matchStart = originalPos;
            int matchEnd = matchStart + matchText.length();
            
            positions.add(new int[]{matchStart, matchEnd});
            currentPos = endIdx + endTag.length();
        }
        
        return positions;
    }
}
