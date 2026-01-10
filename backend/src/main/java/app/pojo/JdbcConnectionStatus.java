package app.pojo;

public class JdbcConnectionStatus {
    private boolean connected;
    private int activeConnections;
    private int idleConnections;
    private int totalConnections;
    private int maxPoolSize;
    private int minIdle;
    private String currentUrl;

    public JdbcConnectionStatus() {
    }

    public boolean isConnected() {
        return connected;
    }

    public void setConnected(boolean connected) {
        this.connected = connected;
    }

    public int getActiveConnections() {
        return activeConnections;
    }

    public void setActiveConnections(int activeConnections) {
        this.activeConnections = activeConnections;
    }

    public int getIdleConnections() {
        return idleConnections;
    }

    public void setIdleConnections(int idleConnections) {
        this.idleConnections = idleConnections;
    }

    public int getTotalConnections() {
        return totalConnections;
    }

    public void setTotalConnections(int totalConnections) {
        this.totalConnections = totalConnections;
    }

    public int getMaxPoolSize() {
        return maxPoolSize;
    }

    public void setMaxPoolSize(int maxPoolSize) {
        this.maxPoolSize = maxPoolSize;
    }

    public int getMinIdle() {
        return minIdle;
    }

    public void setMinIdle(int minIdle) {
        this.minIdle = minIdle;
    }

    public String getCurrentUrl() {
        return currentUrl;
    }

    public void setCurrentUrl(String currentUrl) {
        this.currentUrl = currentUrl;
    }

    @Override
    public String toString() {
        return "JdbcConnectionStatus{" +
                "connected=" + connected +
                ", activeConnections=" + activeConnections +
                ", idleConnections=" + idleConnections +
                ", totalConnections=" + totalConnections +
                ", maxPoolSize=" + maxPoolSize +
                ", minIdle=" + minIdle +
                ", currentUrl='" + currentUrl + '\'' +
                '}';
    }
}

