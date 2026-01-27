package app.pojo;

public class IdConfigUpdateRequest {
    private String path;
    private Object value;

    public IdConfigUpdateRequest() {
    }

    public IdConfigUpdateRequest(String path, Object value) {
        this.path = path;
        this.value = value;
    }

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }

    public Object getValue() {
        return value;
    }

    public void setValue(Object value) {
        this.value = value;
    }
}
