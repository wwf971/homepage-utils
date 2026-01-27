package app.pojo;

public class IdConfig {
    private String databaseName;
    private String tableName;

    public IdConfig() {
    }

    public IdConfig(String databaseName, String tableName) {
        this.databaseName = databaseName;
        this.tableName = tableName;
    }

    public String getDatabaseName() {
        return databaseName;
    }

    public void setDatabaseName(String databaseName) {
        this.databaseName = databaseName;
    }

    public String getTableName() {
        return tableName;
    }

    public void setTableName(String tableName) {
        this.tableName = tableName;
    }

    @Override
    public String toString() {
        return "IdConfig{" +
                "databaseName='" + databaseName + '\'' +
                ", tableName='" + tableName + '\'' +
                '}';
    }
}
