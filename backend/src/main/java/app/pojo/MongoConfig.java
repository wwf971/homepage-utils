package app.pojo;

public class MongoConfig {
    private String uri;
    private String database;
    private String username;
    private String password;

    public MongoConfig() {
    }

    public MongoConfig(String uri, String database, String username, String password) {
        this.uri = uri;
        this.database = database;
        this.username = username;
        this.password = password;
    }

    public String getUri() {
        return uri;
    }

    public void setUri(String uri) {
        this.uri = uri;
    }

    public String getDatabase() {
        return database;
    }

    public void setDatabase(String database) {
        this.database = database;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    @Override
    public String toString() {
        return "MongoConfig{" +
                "uri='" + uri + '\'' +
                ", database='" + database + '\'' +
                ", username='" + username + '\'' +
                ", password='" + (password != null && !password.isEmpty() ? "***" : "") + '\'' +
                '}';
    }
}

