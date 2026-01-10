package app.event;

import app.pojo.MongoConfig;

public class MongoConfigChangeEvent {
    private final MongoConfig oldConfig;
    private final MongoConfig newConfig;
    private final long timestamp;

    public MongoConfigChangeEvent(MongoConfig oldConfig, MongoConfig newConfig) {
        this.oldConfig = oldConfig;
        this.newConfig = newConfig;
        this.timestamp = System.currentTimeMillis();
    }

    public MongoConfig getOldConfig() {
        return oldConfig;
    }

    public MongoConfig getNewConfig() {
        return newConfig;
    }

    public long getTimestamp() {
        return timestamp;
    }

    @Override
    public String toString() {
        return "MongoConfigChangeEvent{" +
                "oldConfig=" + oldConfig +
                ", newConfig=" + newConfig +
                ", timestamp=" + timestamp +
                '}';
    }
}

