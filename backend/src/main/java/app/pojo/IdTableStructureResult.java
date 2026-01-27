package app.pojo;

import java.util.List;

public class IdTableStructureResult {
    private boolean exists;
    private String databaseName;
    private String tableName;
    private Long rowCount;
    private List<TableColumnInfo> columns;
    private boolean hasValidStructure;
    private List<String> structureIssues;
    private String message;

    public IdTableStructureResult() {
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

    public Long getRowCount() {
        return rowCount;
    }

    public void setRowCount(Long rowCount) {
        this.rowCount = rowCount;
    }

    public List<TableColumnInfo> getColumns() {
        return columns;
    }

    public void setColumns(List<TableColumnInfo> columns) {
        this.columns = columns;
    }

    public boolean isHasValidStructure() {
        return hasValidStructure;
    }

    public void setHasValidStructure(boolean hasValidStructure) {
        this.hasValidStructure = hasValidStructure;
    }

    public List<String> getStructureIssues() {
        return structureIssues;
    }

    public void setStructureIssues(List<String> structureIssues) {
        this.structureIssues = structureIssues;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
