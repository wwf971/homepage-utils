package app.pojo;

public class IdTableCheckResult {
    private boolean exists;
    private String databaseName;
    private String tableName;
    private String message;

    public IdTableCheckResult() {
    }

    public IdTableCheckResult(boolean exists, String databaseName, String tableName, String message) {
        this.exists = exists;
        this.databaseName = databaseName;
        this.tableName = tableName;
        this.message = message;
    }

    public boolean isExists() {
        return exists;
    }

    public void setExists(boolean exists) {
        this.exists = exists;
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

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
