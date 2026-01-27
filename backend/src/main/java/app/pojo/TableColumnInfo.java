package app.pojo;

public class TableColumnInfo {
    private String columnName;
    private String dataType;
    private String columnType;
    private Boolean isNullable;
    private String columnKey;
    private String columnDefault;

    public TableColumnInfo() {
    }

    public TableColumnInfo(String columnName, String dataType, String columnType, 
                          Boolean isNullable, String columnKey, String columnDefault) {
        this.columnName = columnName;
        this.dataType = dataType;
        this.columnType = columnType;
        this.isNullable = isNullable;
        this.columnKey = columnKey;
        this.columnDefault = columnDefault;
    }

    public String getColumnName() {
        return columnName;
    }

    public void setColumnName(String columnName) {
        this.columnName = columnName;
    }

    public String getDataType() {
        return dataType;
    }

    public void setDataType(String dataType) {
        this.dataType = dataType;
    }

    public String getColumnType() {
        return columnType;
    }

    public void setColumnType(String columnType) {
        this.columnType = columnType;
    }

    public Boolean getIsNullable() {
        return isNullable;
    }

    public void setIsNullable(Boolean isNullable) {
        this.isNullable = isNullable;
    }

    public String getColumnKey() {
        return columnKey;
    }

    public void setColumnKey(String columnKey) {
        this.columnKey = columnKey;
    }

    public String getColumnDefault() {
        return columnDefault;
    }

    public void setColumnDefault(String columnDefault) {
        this.columnDefault = columnDefault;
    }
}
