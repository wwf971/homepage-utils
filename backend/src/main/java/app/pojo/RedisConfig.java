package app.pojo;

public class RedisConfig {
    private String host;
    private Integer port;
    private String username;
    private String password;
    private Integer timeout;

    public RedisConfig() {
    }

    public RedisConfig(String host, Integer port, String username, String password, Integer timeout) {
        this.host = host;
        this.port = port;
        this.username = username;
        this.password = password;
        this.timeout = timeout;
    }

    public String getHost() {
        return host;
    }

    public void setHost(String host) {
        this.host = host;
    }

    public Integer getPort() {
        return port;
    }

    public void setPort(Integer port) {
        this.port = port;
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

    public Integer getTimeout() {
        return timeout;
    }

    public void setTimeout(Integer timeout) {
        this.timeout = timeout;
    }

    @Override
    public String toString() {
        return "RedisConfig{" +
                "host='" + host + '\'' +
                ", port=" + port +
                ", username='" + username + '\'' +
                ", password='" + (password != null && !password.isEmpty() ? "***" : "") + '\'' +
                ", timeout=" + timeout +
                '}';
    }
}
