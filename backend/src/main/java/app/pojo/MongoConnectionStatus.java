package app.pojo;

public class MongoConnectionStatus {
    private boolean connected;
    private String currentUri;
    private String currentDatabase;

    public MongoConnectionStatus() {
    }

    public boolean isConnected() {
        return connected;
    }

    public void setConnected(boolean connected) {
        this.connected = connected;
    }

    public String getCurrentUri() {
        return currentUri;
    }

    public void setCurrentUri(String currentUri) {
        this.currentUri = currentUri;
    }

    public String getCurrentDatabase() {
        return currentDatabase;
    }

    public void setCurrentDatabase(String currentDatabase) {
        this.currentDatabase = currentDatabase;
    }

    @Override
    public String toString() {
        return "MongoConnectionStatus{" +
                "connected=" + connected +
                ", currentUri='" + currentUri + '\'' +
                ", currentDatabase='" + currentDatabase + '\'' +
                '}';
    }
}

