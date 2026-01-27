package app.service;

import app.pojo.IdConfig;
import app.pojo.IdTableCheckResult;
import app.pojo.IdTableStructureResult;
import app.pojo.TableColumnInfo;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import com.zaxxer.hikari.HikariDataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;

@Service
public class IdConfigService {

    private IdConfig configCurrent;
    private IdConfig appConfig;
    private final LocalConfigService localConfigService;
    private final JdbcConnectionService jdbcConnectionService;

    public IdConfigService(
            LocalConfigService localConfigService,
            JdbcConnectionService jdbcConnectionService,
            @Value("${id.database-name:data}") String databaseName,
            @Value("${id.table-name:id}") String tableName) {

        this.localConfigService = localConfigService;
        this.jdbcConnectionService = jdbcConnectionService;

        // Store application.properties config
        this.appConfig = new IdConfig(databaseName, tableName);
        
        // Initialize with merged config
        this.configCurrent = mergeAllLayers(databaseName, tableName);
        System.out.println("IdConfigService initialized with merged config: " + configCurrent);
    }
    
    /**
     * Merge all config layers: application.properties -> local -> computed
     */
    private IdConfig mergeAllLayers(String databaseName, String tableName) {
        // Layer 1: application.properties (base)
        // Already provided as parameters
        
        // Layer 2: Local overrides
        String localDatabaseName = localConfigService.getConfig("id.databaseName");
        String localTableName = localConfigService.getConfig("id.tableName");
        
        if (localDatabaseName != null) databaseName = localDatabaseName;
        if (localTableName != null) tableName = localTableName;
        
        return new IdConfig(databaseName, tableName);
    }

    /**
     * Get application.properties config only (first layer, no overrides)
     */
    public IdConfig getAppConfig() {
        return appConfig;
    }

    /**
     * Get current merged config (all layers applied)
     */
    public IdConfig getConfigCurrent() {
        return configCurrent;
    }

    public void updateConfig(String path, Object value) throws Exception {
        setNestedProperty(this.configCurrent, path, value);

        // Save to local config
        localConfigService.saveConfig("id." + path, String.valueOf(value), "id");

        System.out.println("IdConfigService: Config updated: path=" + path + ", value=" + value);
    }

    private void setNestedProperty(Object obj, String path, Object value) throws Exception {
        String[] parts = path.split("\\.");
        Object current = obj;

        for (int i = 0; i < parts.length - 1; i++) {
            String fieldName = parts[i];
            var field = current.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            current = field.get(current);
            if (current == null) {
                throw new IllegalArgumentException("Path segment '" + fieldName + "' is null");
            }
        }

        String finalField = parts[parts.length - 1];
        var field = current.getClass().getDeclaredField(finalField);
        field.setAccessible(true);

        Object convertedValue = convertValue(value, field.getType());
        field.set(current, convertedValue);
    }

    private Object convertValue(Object value, Class<?> targetType) {
        if (value == null) {
            return null;
        }
        if (targetType.isInstance(value)) {
            return value;
        }
        String strValue = value.toString();
        if (targetType == String.class) {
            return strValue;
        } else if (targetType == int.class || targetType == Integer.class) {
            return Integer.parseInt(strValue);
        } else if (targetType == long.class || targetType == Long.class) {
            return Long.parseLong(strValue);
        } else if (targetType == boolean.class || targetType == Boolean.class) {
            return Boolean.parseBoolean(strValue);
        } else if (targetType == double.class || targetType == Double.class) {
            return Double.parseDouble(strValue);
        }
        return value;
    }

    /**
     * Check if the ID table exists in the database
     */
    public IdTableCheckResult checkTableExists() {
        String databaseName = configCurrent.getDatabaseName();
        String tableName = configCurrent.getTableName();
        
        // Get datasource from JDBC connection service
        HikariDataSource dataSource = jdbcConnectionService.getDataSource();
        
        if (dataSource == null) {
            return new IdTableCheckResult(
                false,
                databaseName,
                tableName,
                "SQL database connection could not be established. Please check JDBC configuration and start the connection."
            );
        }
        
        try (Connection conn = dataSource.getConnection()) {
            // Check if table exists using INFORMATION_SCHEMA
            String sql = "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES " +
                        "WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?";
            
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, databaseName);
                stmt.setString(2, tableName);
                
                try (ResultSet rs = stmt.executeQuery()) {
                    if (rs.next() && rs.getInt(1) > 0) {
                        return new IdTableCheckResult(
                            true,
                            databaseName,
                            tableName,
                            "Table exists"
                        );
                    } else {
                        return new IdTableCheckResult(
                            false,
                            databaseName,
                            tableName,
                            "Table does not exist in database"
                        );
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("Failed to check table existence: " + e.getMessage());
            e.printStackTrace();
            
            String errorMsg;
            String exMsg = e.getMessage() != null ? e.getMessage() : e.toString();
            
            if (exMsg.contains("Communications link failure") || 
                exMsg.contains("Connection refused")) {
                errorMsg = "SQL database connection could not be established: " + exMsg;
            } else if (exMsg.contains("Access denied")) {
                errorMsg = "Access denied: Check database credentials in JDBC config";
            } else if (exMsg.contains("Unknown database")) {
                errorMsg = "Database '" + databaseName + "' does not exist";
            } else {
                errorMsg = "Error checking table: " + exMsg;
            }
            
            return new IdTableCheckResult(
                false,
                databaseName,
                tableName,
                errorMsg
            );
        }
    }

    /**
     * Check table structure including columns, data types, and row count
     */
    public IdTableStructureResult checkTableStructure() {
        String databaseName = configCurrent.getDatabaseName();
        String tableName = configCurrent.getTableName();
        
        IdTableStructureResult result = new IdTableStructureResult();
        result.setDatabaseName(databaseName);
        result.setTableName(tableName);
        
        // Get datasource
        HikariDataSource dataSource = jdbcConnectionService.getDataSource();
        
        if (dataSource == null) {
            result.setExists(false);
            result.setMessage("SQL database connection could not be established");
            return result;
        }
        
        try (Connection conn = dataSource.getConnection()) {
            // Check if table exists
            String checkSql = "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES " +
                            "WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?";
            
            try (PreparedStatement stmt = conn.prepareStatement(checkSql)) {
                stmt.setString(1, databaseName);
                stmt.setString(2, tableName);
                
                try (ResultSet rs = stmt.executeQuery()) {
                    if (!rs.next() || rs.getInt(1) == 0) {
                        result.setExists(false);
                        result.setMessage("Table does not exist");
                        return result;
                    }
                }
            }
            
            result.setExists(true);
            
            // Get column information
            String columnsSql = "SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, " +
                              "COLUMN_KEY, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS " +
                              "WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION";
            
            List<TableColumnInfo> columns = new ArrayList<>();
            try (PreparedStatement stmt = conn.prepareStatement(columnsSql)) {
                stmt.setString(1, databaseName);
                stmt.setString(2, tableName);
                
                try (ResultSet rs = stmt.executeQuery()) {
                    while (rs.next()) {
                        TableColumnInfo column = new TableColumnInfo();
                        column.setColumnName(rs.getString("COLUMN_NAME"));
                        column.setDataType(rs.getString("DATA_TYPE"));
                        column.setColumnType(rs.getString("COLUMN_TYPE"));
                        column.setIsNullable("YES".equals(rs.getString("IS_NULLABLE")));
                        column.setColumnKey(rs.getString("COLUMN_KEY"));
                        column.setColumnDefault(rs.getString("COLUMN_DEFAULT"));
                        columns.add(column);
                    }
                }
            }
            result.setColumns(columns);
            
            // Get row count
            String countSql = "SELECT COUNT(*) FROM `" + databaseName + "`.`" + tableName + "`";
            try (PreparedStatement stmt = conn.prepareStatement(countSql)) {
                try (ResultSet rs = stmt.executeQuery()) {
                    if (rs.next()) {
                        result.setRowCount(rs.getLong(1));
                    }
                }
            }
            
            // Validate structure
            List<String> issues = validateTableStructure(columns);
            result.setHasValidStructure(issues.isEmpty());
            result.setStructureIssues(issues);
            
            if (issues.isEmpty()) {
                result.setMessage("Table structure is valid");
            } else {
                result.setMessage("Table structure has issues");
            }
            
            return result;
            
        } catch (Exception e) {
            System.err.println("Failed to check table structure: " + e.getMessage());
            e.printStackTrace();
            
            result.setExists(false);
            result.setMessage("Error checking table structure: " + e.getMessage());
            return result;
        }
    }
    
    /**
     * Validate if table has required structure for ID service
     * Required columns:
     * - value: BIGINT
     * - selfType: TINYINT
     * - type: VARCHAR
     * - metadata: VARCHAR or TEXT
     * - createAt: BIGINT
     * - createAtTimezone: INT
     */
    private List<String> validateTableStructure(List<TableColumnInfo> columns) {
        List<String> issues = new ArrayList<>();
        
        // Check for required columns
        boolean hasValue = false;
        boolean hasSelfType = false;
        boolean hasType = false;
        boolean hasMetadata = false;
        boolean hasCreateAt = false;
        boolean hasCreateAtTimezone = false;
        
        for (TableColumnInfo col : columns) {
            String name = col.getColumnName().toLowerCase();
            String dataType = col.getDataType().toLowerCase();
            
            if ("value".equals(name)) {
                hasValue = true;
                if (!dataType.equals("bigint")) {
                    issues.add("Column 'value' should be BIGINT, found: " + col.getDataType());
                }
            } else if ("selftype".equals(name)) {
                hasSelfType = true;
                if (!dataType.equals("tinyint")) {
                    issues.add("Column 'selfType' should be TINYINT, found: " + col.getDataType());
                }
            } else if ("type".equals(name)) {
                hasType = true;
                if (!dataType.equals("varchar")) {
                    issues.add("Column 'type' should be VARCHAR, found: " + col.getDataType());
                }
            } else if ("metadata".equals(name)) {
                hasMetadata = true;
                if (!dataType.equals("varchar") && !dataType.equals("text")) {
                    issues.add("Column 'metadata' should be VARCHAR or TEXT, found: " + col.getDataType());
                }
            } else if ("createat".equals(name)) {
                hasCreateAt = true;
                if (!dataType.equals("bigint")) {
                    issues.add("Column 'createAt' should be BIGINT, found: " + col.getDataType());
                }
            } else if ("createattimezone".equals(name)) {
                hasCreateAtTimezone = true;
                if (!dataType.equals("int")) {
                    issues.add("Column 'createAtTimezone' should be INT, found: " + col.getDataType());
                }
            }
        }
        
        if (!hasValue) {
            issues.add("Missing required column: 'value' (BIGINT)");
        }
        if (!hasSelfType) {
            issues.add("Missing required column: 'selfType' (TINYINT)");
        }
        if (!hasType) {
            issues.add("Missing required column: 'type' (VARCHAR)");
        }
        if (!hasMetadata) {
            issues.add("Missing required column: 'metadata' (VARCHAR or TEXT)");
        }
        if (!hasCreateAt) {
            issues.add("Missing required column: 'createAt' (BIGINT)");
        }
        if (!hasCreateAtTimezone) {
            issues.add("Missing required column: 'createAtTimezone' (INT)");
        }
        
        return issues;
    }

    /**
     * Create ID table with standard structure
     */
    public IdTableCheckResult createTable() {
        String databaseName = configCurrent.getDatabaseName();
        String tableName = configCurrent.getTableName();
        
        // Get datasource
        HikariDataSource dataSource = jdbcConnectionService.getDataSource();
        
        if (dataSource == null) {
            return new IdTableCheckResult(
                false,
                databaseName,
                tableName,
                "SQL database connection could not be established"
            );
        }
        
        try (Connection conn = dataSource.getConnection()) {
            // Check if table already exists
            String checkSql = "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES " +
                            "WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?";
            
            try (PreparedStatement stmt = conn.prepareStatement(checkSql)) {
                stmt.setString(1, databaseName);
                stmt.setString(2, tableName);
                
                try (ResultSet rs = stmt.executeQuery()) {
                    if (rs.next() && rs.getInt(1) > 0) {
                        return new IdTableCheckResult(
                            false,
                            databaseName,
                            tableName,
                            "Table already exists"
                        );
                    }
                }
            }
            
            // Create table with standard structure
            String createSql = String.format(
                "CREATE TABLE `%s`.`%s` (" +
                "  `value` BIGINT NOT NULL, " +
                "  `selfType` TINYINT NOT NULL, " +
                "  `type` VARCHAR(256), " +
                "  `metadata` VARCHAR(1024), " +
                "  `createAt` BIGINT, " +
                "  `createAtTimezone` INT, " +
                "  PRIMARY KEY (`value`)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
                databaseName, tableName
            );
            
            try (PreparedStatement stmt = conn.prepareStatement(createSql)) {
                stmt.execute();
            }
            
            return new IdTableCheckResult(
                true,
                databaseName,
                tableName,
                "Table created successfully"
            );
            
        } catch (Exception e) {
            System.err.println("Failed to create table: " + e.getMessage());
            e.printStackTrace();
            
            String errorMsg;
            String exMsg = e.getMessage() != null ? e.getMessage() : e.toString();
            
            if (exMsg.contains("Access denied")) {
                errorMsg = "Access denied: User does not have CREATE privilege";
            } else if (exMsg.contains("Unknown database")) {
                errorMsg = "Database '" + databaseName + "' does not exist";
            } else if (exMsg.contains("already exists")) {
                errorMsg = "Table already exists";
            } else {
                errorMsg = "Failed to create table: " + exMsg;
            }
            
            return new IdTableCheckResult(
                false,
                databaseName,
                tableName,
                errorMsg
            );
        }
    }

    /**
     * Delete ID table
     */
    public IdTableCheckResult deleteTable() {
        String databaseName = configCurrent.getDatabaseName();
        String tableName = configCurrent.getTableName();
        
        // Get datasource
        HikariDataSource dataSource = jdbcConnectionService.getDataSource();
        
        if (dataSource == null) {
            return new IdTableCheckResult(
                false,
                databaseName,
                tableName,
                "SQL database connection could not be established"
            );
        }
        
        try (Connection conn = dataSource.getConnection()) {
            // Check if table exists
            String checkSql = "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES " +
                            "WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?";
            
            try (PreparedStatement stmt = conn.prepareStatement(checkSql)) {
                stmt.setString(1, databaseName);
                stmt.setString(2, tableName);
                
                try (ResultSet rs = stmt.executeQuery()) {
                    if (!rs.next() || rs.getInt(1) == 0) {
                        return new IdTableCheckResult(
                            false,
                            databaseName,
                            tableName,
                            "Table does not exist, nothing to delete"
                        );
                    }
                }
            }
            
            // Drop table
            String dropSql = String.format("DROP TABLE `%s`.`%s`", databaseName, tableName);
            
            try (PreparedStatement stmt = conn.prepareStatement(dropSql)) {
                stmt.execute();
            }
            
            return new IdTableCheckResult(
                true,
                databaseName,
                tableName,
                "Table deleted successfully"
            );
            
        } catch (Exception e) {
            System.err.println("Failed to delete table: " + e.getMessage());
            e.printStackTrace();
            
            String errorMsg;
            String exMsg = e.getMessage() != null ? e.getMessage() : e.toString();
            
            if (exMsg.contains("Access denied")) {
                errorMsg = "Access denied: User does not have DROP privilege";
            } else if (exMsg.contains("Unknown database")) {
                errorMsg = "Database '" + databaseName + "' does not exist";
            } else {
                errorMsg = "Failed to delete table: " + exMsg;
            }
            
            return new IdTableCheckResult(
                false,
                databaseName,
                tableName,
                errorMsg
            );
        }
    }

    /**
     * Recreate ID table (delete if exists, then create)
     */
    public IdTableCheckResult recreateTable() {
        String databaseName = configCurrent.getDatabaseName();
        String tableName = configCurrent.getTableName();
        
        // Get datasource
        HikariDataSource dataSource = jdbcConnectionService.getDataSource();
        
        if (dataSource == null) {
            return new IdTableCheckResult(
                false,
                databaseName,
                tableName,
                "SQL database connection could not be established"
            );
        }
        
        try (Connection conn = dataSource.getConnection()) {
            // Drop table if exists
            String dropSql = String.format("DROP TABLE IF EXISTS `%s`.`%s`", databaseName, tableName);
            
            try (PreparedStatement stmt = conn.prepareStatement(dropSql)) {
                stmt.execute();
            }
            
            // Create table with standard structure
            String createSql = String.format(
                "CREATE TABLE `%s`.`%s` (" +
                "  `value` BIGINT NOT NULL, " +
                "  `selfType` TINYINT NOT NULL, " +
                "  `type` VARCHAR(256), " +
                "  `metadata` VARCHAR(1024), " +
                "  `createAt` BIGINT, " +
                "  `createAtTimezone` INT, " +
                "  PRIMARY KEY (`value`)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
                databaseName, tableName
            );
            
            try (PreparedStatement stmt = conn.prepareStatement(createSql)) {
                stmt.execute();
            }
            
            return new IdTableCheckResult(
                true,
                databaseName,
                tableName,
                "Table recreated successfully"
            );
            
        } catch (Exception e) {
            System.err.println("Failed to recreate table: " + e.getMessage());
            e.printStackTrace();
            
            String errorMsg;
            String exMsg = e.getMessage() != null ? e.getMessage() : e.toString();
            
            if (exMsg.contains("Access denied")) {
                errorMsg = "Access denied: User does not have DROP/CREATE privilege";
            } else if (exMsg.contains("Unknown database")) {
                errorMsg = "Database '" + databaseName + "' does not exist";
            } else {
                errorMsg = "Failed to recreate table: " + exMsg;
            }
            
            return new IdTableCheckResult(
                false,
                databaseName,
                tableName,
                errorMsg
            );
        }
    }
}
