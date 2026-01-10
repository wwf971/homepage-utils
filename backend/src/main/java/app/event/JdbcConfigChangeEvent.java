package app.event;

import app.pojo.JdbcConfig;

public class JdbcConfigChangeEvent {
    private final JdbcConfig oldConfig;
    private final JdbcConfig newConfig;
    private final long timestamp;

    public JdbcConfigChangeEvent(JdbcConfig oldConfig, JdbcConfig newConfig) {
        this.oldConfig = oldConfig;
        this.newConfig = newConfig;
        this.timestamp = System.currentTimeMillis();
    }

    public JdbcConfig getOldConfig() {
        return oldConfig;
    }

    public JdbcConfig getNewConfig() {
        return newConfig;
    }

    public long getTimestamp() {
        return timestamp;
    }

    @Override
    public String toString() {
        return "JdbcConfigChangeEvent{" +
                "oldConfig=" + oldConfig +
                ", newConfig=" + newConfig +
                ", timestamp=" + timestamp +
                '}';
    }
}

