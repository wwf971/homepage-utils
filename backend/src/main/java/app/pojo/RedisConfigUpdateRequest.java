package app.pojo;

public class RedisConfigUpdateRequest {
    private String path;
    private Object value;

    public RedisConfigUpdateRequest() {
    }

    public RedisConfigUpdateRequest(String path, Object value) {
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

    @Override
    public String toString() {
        return "RedisConfigUpdateRequest{" +
                "path='" + path + '\'' +
                ", value=" + value +
                '}';
    }
}
