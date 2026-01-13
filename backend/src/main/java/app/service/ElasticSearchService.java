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
        ElasticSearchConfig config = configService.getCurrentConfig();
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
        ElasticSearchConfig config = configService.getCurrentConfig();
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
        String baseUri = getBaseUri();
        String indexUri = baseUri + indexName;

        // Check if index exists
        boolean exists = indexExists(indexName);

        if (exists) {
            if (clearIfExists) {
                // Delete the index
                HttpURLConnection deleteConn = setupConnection(indexUri, "DELETE");
                int responseCode = deleteConn.getResponseCode();
                if (responseCode == 200) {
                    System.out.println("Deleted existing ES index: " + indexName);
                } else {
                    throw new Exception("Failed to delete index: HTTP " + responseCode);
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

        int responseCode = createConn.getResponseCode();
        if (responseCode == 200 || responseCode == 201) {
            System.out.println("Created ES index: " + indexName);
        } else {
            String errorResponse = readResponse(createConn);
            throw new Exception("Failed to create index: HTTP " + responseCode + " - " + errorResponse);
        }
    }

    /**
     * Index a flattened document (list of path/value pairs)
     * Uses nested structure with "flat" field containing all path/value pairs
     */
    public void indexDocument(String indexName, String docId, String database, String collection,
                             List<Map<String, String>> flattenedPairs) throws Exception {
        String baseUri = getBaseUri();
        String indexUri = baseUri + indexName + "/_doc/" + docId;

        // Create document with nested flat field
        Map<String, Object> doc = new HashMap<>();
        doc.put("flat", flattenedPairs);

        HttpURLConnection connection = setupConnection(indexUri, "PUT");
        connection.setDoOutput(true);

        String jsonBody = objectMapper.writeValueAsString(doc);
        try (OutputStream os = connection.getOutputStream()) {
            byte[] input = jsonBody.getBytes("utf-8");
            os.write(input, 0, input.length);
        }

        int responseCode = connection.getResponseCode();
        if (responseCode != 200 && responseCode != 201) {
            String errorResponse = readResponse(connection);
            throw new Exception("Failed to index document: HTTP " + responseCode + " - " + errorResponse);
        }

        System.out.println("Indexed " + flattenedPairs.size() + " path/value pairs for doc " + docId + " to ES index " + indexName);
    }

    /**
     * Delete document by ES document ID (which is the MongoDB docId)
     */
    public void deleteDocument(String indexName, String docId) throws Exception {
        String baseUri = getBaseUri();
        String deleteUri = baseUri + indexName + "/_doc/" + docId;

        HttpURLConnection connection = setupConnection(deleteUri, "DELETE");
        int responseCode = connection.getResponseCode();
        
        if (responseCode == 200 || responseCode == 404) {
            // 404 is OK - document may not exist
            System.out.println("Deleted doc " + docId + " from ES index " + indexName);
        } else {
            String errorResponse = readResponse(connection);
            throw new Exception("Failed to delete document: HTTP " + responseCode + " - " + errorResponse);
        }
    }

    /**
     * Get document count for an index
     */
    public long getDocumentCount(String indexName) throws Exception {
        String baseUri = getBaseUri();
        String countUri = baseUri + indexName + "/_count";

        HttpURLConnection connection = setupConnection(countUri, "GET");
        int responseCode = connection.getResponseCode();

        if (responseCode == 200) {
            String response = readResponse(connection);
            @SuppressWarnings("unchecked")
            Map<String, Object> result = objectMapper.readValue(response, Map.class);
            return ((Number) result.get("count")).longValue();
        } else if (responseCode == 404) {
            // Index doesn't exist
            return 0;
        } else {
            throw new Exception("Failed to get document count: HTTP " + responseCode);
        }
    }

    /**
     * Check if index exists
     */
    public boolean indexExists(String indexName) throws Exception {
        String baseUri = getBaseUri();
        String indexUri = baseUri + indexName;

        HttpURLConnection connection = setupConnection(indexUri, "HEAD");
        int responseCode = connection.getResponseCode();
        return responseCode == 200;
    }

    /**
     * Search a character-level index and return structured results with highlights
     * Based on Python _3b_es_highlight.py implementation
     */
    public List<Map<String, Object>> searchCharIndex(String indexName, String query, 
                                                      boolean searchInPaths, boolean searchInValues) throws Exception {
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

        int responseCode = connection.getResponseCode();
        if (responseCode != 200) {
            String errorResponse = readResponse(connection);
            throw new Exception("Search failed: HTTP " + responseCode + " - " + errorResponse);
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
