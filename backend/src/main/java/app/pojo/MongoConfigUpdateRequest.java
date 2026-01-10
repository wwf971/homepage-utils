package app.pojo;

public class MongoConfigUpdateRequest {
    private String path;
    private Object value;

    public MongoConfigUpdateRequest() {
    }

    public MongoConfigUpdateRequest(String path, Object value) {
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
        return "MongoConfigUpdateRequest{" +
                "path='" + path + '\'' +
                ", value=" + value +
                '}';
    }
}

