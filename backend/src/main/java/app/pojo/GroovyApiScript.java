package app.pojo;

/**
 * Represents a Groovy API script stored in MongoDB
 */
public class GroovyApiScript {
    private String id;
    private String endpoint;
    private Object scriptSource; // Can be String (legacy) or Map/Document (new object format)
    private Long createdAt;
    private Long updatedAt;
    private String description;
    private String owner;
    private String source;

    public GroovyApiScript() {
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getEndpoint() {
        return endpoint;
    }

    public void setEndpoint(String endpoint) {
        this.endpoint = endpoint;
    }

    public Object getScriptSource() {
        return scriptSource;
    }

    public void setScriptSource(Object scriptSource) {
        this.scriptSource = scriptSource;
    }

    public Long getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Long createdAt) {
        this.createdAt = createdAt;
    }

    public Long getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Long updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getOwner() {
        return owner;
    }

    public void setOwner(String owner) {
        this.owner = owner;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }
}
