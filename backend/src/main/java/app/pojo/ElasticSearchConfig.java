package app.pojo;

public class ElasticSearchConfig {
    private String uris;
    private String username;
    private String password;

    public ElasticSearchConfig() {
    }

    public ElasticSearchConfig(String uris, String username, String password) {
        this.uris = uris;
        this.username = username;
        this.password = password;
    }

    public String getUris() {
        return uris;
    }

    public void setUris(String uris) {
        this.uris = uris;
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
        return "ElasticSearchConfig{" +
                "uris='" + uris + '\'' +
                ", username='" + username + '\'' +
                ", password='" + (password != null && !password.isEmpty() ? "***" : "") + '\'' +
                '}';
    }
}

