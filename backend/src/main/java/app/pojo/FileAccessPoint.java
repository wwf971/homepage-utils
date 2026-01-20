package app.pojo;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.util.Map;

@Document(collection = "note")
public class FileAccessPoint {
    
    @Id
    private String mongoId;  // Maps to MongoDB's _id field
    
    @Field("id")
    private String id;  // Maps to your custom id field
    
    @Field("name")
    private String name;
    
    @Field("setting")
    private Map<String, Object> setting;
    
    @Field("type")
    private String type;
    
    @Field("time_create")
    private Long timeCreate;
    
    @Field("no_index")
    private Boolean noIndex;
    
    @Field("server_id")
    private String serverId;

    public FileAccessPoint() {
    }

    public String getMongoId() {
        return mongoId;
    }

    public void setMongoId(String mongoId) {
        this.mongoId = mongoId;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Map<String, Object> getSetting() {
        return setting;
    }

    public void setSetting(Map<String, Object> setting) {
        this.setting = setting;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public Long getTimeCreate() {
        return timeCreate;
    }

    public void setTimeCreate(Long timeCreate) {
        this.timeCreate = timeCreate;
    }

    public Boolean getNoIndex() {
        return noIndex;
    }

    public void setNoIndex(Boolean noIndex) {
        this.noIndex = noIndex;
    }

    public String getServerId() {
        return serverId;
    }

    public void setServerId(String serverId) {
        this.serverId = serverId;
    }

    public String getSettingType() {
        return setting != null ? (String) setting.get("type") : null;
    }

    public String getDirPathBase() {
        return setting != null ? (String) setting.get("dir_path_base") : null;
    }

    @SuppressWarnings("unchecked")
    public java.util.List<String> getDirsPathBase() {
        if (setting == null) return null;
        Object value = setting.get("dirs_path_base");
        if (value instanceof java.util.List) {
            return (java.util.List<String>) value;
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    public Map<String, String> getDirsPathBaseAsMap() {
        if (setting == null) return null;
        Object value = setting.get("dirs_path_base");
        if (value instanceof Map) {
            return (Map<String, String>) value;
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    public Map<String, String> getDirsPathBaseServer() {
        if (setting == null) return null;
        Object value = setting.get("dirs_path_base_server");
        if (value instanceof Map) {
            return (Map<String, String>) value;
        }
        return null;
    }

    public Object getDirPathBaseIndexRaw() {
        if (setting == null) return null;
        return setting.get("dir_path_base_index");
    }

    public Integer getDirPathBaseIndex() {
        if (setting == null) return null;
        Object value = setting.get("dir_path_base_index");
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        // Handle string values (e.g., "0" stored in MongoDB)
        if (value instanceof String) {
            try {
                return Integer.parseInt((String) value);
            } catch (NumberFormatException e) {
                // Not a valid integer, will be used as string key for map
                return null;
            }
        }
        return null;
    }

    public String getDirPathBaseIndexAsString() {
        if (setting == null) return null;
        Object value = setting.get("dir_path_base_index");
        if (value == null) return null;
        return value.toString();
    }

    /**
     * Resolves the effective base directory path.
     * Logic:
     * 1. Try: dirs_path_base_server[serverName] (if serverName provided)
     * 2. Try: dirs_path_base as array with numeric dir_path_base_index
     * 3. If fails, try: dirs_path_base as object/map with string/numeric key dir_path_base_index
     * 4. Fall back to dir_path_base
     * 
     * @param serverName Optional server name from local config (can be null)
     */
    public String resolveBaseDirPath(String serverName) {
        // Attempt 0: Try dirs_path_base_server[serverName] if serverName is provided
        if (serverName != null && !serverName.trim().isEmpty()) {
            Map<String, String> dirsPathBaseServer = getDirsPathBaseServer();
            if (dirsPathBaseServer != null) {
                String resolvedPath = dirsPathBaseServer.get(serverName);
                if (resolvedPath != null && !resolvedPath.trim().isEmpty()) {
                    System.out.println("Resolved base dir from server map with key '" + serverName + "': " + resolvedPath);
                    return resolvedPath;
                }
            }
        }
        
        Object indexRaw = getDirPathBaseIndexRaw();
        
        if (indexRaw != null) {
            // Attempt 1: Try dirs_path_base as array with numeric index
            Integer index = getDirPathBaseIndex();
            java.util.List<String> dirsList = getDirsPathBase();
            
            if (index != null && index >= 0 && dirsList != null && index < dirsList.size()) {
                String resolvedPath = dirsList.get(index);
                if (resolvedPath != null && !resolvedPath.trim().isEmpty()) {
                    System.out.println("Resolved base dir from array: " + resolvedPath);
                    return resolvedPath;
                }
            }
            
            // Attempt 2: Try dirs_path_base as object/map with string key
            Map<String, String> dirsMap = getDirsPathBaseAsMap();
            String indexAsString = getDirPathBaseIndexAsString();
            
            if (dirsMap != null && indexAsString != null) {
                String resolvedPath = dirsMap.get(indexAsString);
                if (resolvedPath != null && !resolvedPath.trim().isEmpty()) {
                    System.out.println("Resolved base dir from map with key '" + indexAsString + "': " + resolvedPath);
                    return resolvedPath;
                }
            }
        }
        
        // Fall back to dir_path_base
        String fallback = getDirPathBase();
        System.out.println("Using fallback base dir: " + fallback);
        return fallback;
    }

    /**
     * Resolves the effective base directory path without server name.
     * This is a convenience method that calls resolveBaseDirPath(null).
     */
    public String resolveBaseDirPath() {
        return resolveBaseDirPath(null);
    }

    @Override
    public String toString() {
        return "FileAccessPoint{" +
                "mongoId='" + mongoId + '\'' +
                ", id='" + id + '\'' +
                ", name='" + name + '\'' +
                ", setting=" + setting +
                ", type='" + type + '\'' +
                '}';
    }
}

