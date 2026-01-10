package app.pojo;

public class LocalConfig {
    private String configKey;
    private String configValue;
    private String category;
    private Long timeUpdated;

    public LocalConfig() {
    }

    public LocalConfig(String configKey, String configValue, String category) {
        this.configKey = configKey;
        this.configValue = configValue;
        this.category = category;
        this.timeUpdated = System.currentTimeMillis();
    }

    public String getConfigKey() {
        return configKey;
    }

    public void setConfigKey(String configKey) {
        this.configKey = configKey;
    }

    public String getConfigValue() {
        return configValue;
    }

    public void setConfigValue(String configValue) {
        this.configValue = configValue;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public Long getTimeUpdated() {
        return timeUpdated;
    }

    public void setTimeUpdated(Long timeUpdated) {
        this.timeUpdated = timeUpdated;
    }

    @Override
    public String toString() {
        return "LocalConfig{" +
                "configKey='" + configKey + '\'' +
                ", configValue='" + configValue + '\'' +
                ", category='" + category + '\'' +
                ", timeUpdated=" + timeUpdated +
                '}';
    }
}

