package app.service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class SqlService {
    
    private final JdbcConnectionService connectionService;
    
    @Autowired
    public SqlService(JdbcConnectionService connectionService) {
        this.connectionService = connectionService;
    }
    
    private JdbcTemplate getJdbcTemplate() {
        if (connectionService.getDataSource() == null) {
            throw new IllegalStateException("Database connection not initialized. Please configure and start the connection first.");
        }
        return new JdbcTemplate(connectionService.getDataSource());
    }
    
    /**
     * List all databases in the MySQL server
     */
    public List<String> listAllDatabases() {
        String sql = "SHOW DATABASES";
        return getJdbcTemplate().queryForList(sql, String.class);
    }
    
    /**
     * List all tables in a specific database
     */
    public List<String> listTablesInDatabase(String databaseName) {
        String sql = "SHOW TABLES FROM " + databaseName;
        return getJdbcTemplate().queryForList(sql, String.class);
    }
    
    /**
     * Get all databases with their tables
     */
    public Map<String, List<String>> getAllDatabasesWithTables() {
        Map<String, List<String>> result = new HashMap<>();
        
        List<String> databases = listAllDatabases();
        for (String database : databases) {
            try {
                List<String> tables = listTablesInDatabase(database);
                result.put(database, tables);
            } catch (Exception e) {
                // Skip databases we don't have access to
                result.put(database, List.of("No access or no tables"));
            }
        }
        
        return result;
    }
    
    /**
     * Get database connection info
     */
    public String getDatabaseInfo() {
        String sql = "SELECT VERSION() as version";
        return getJdbcTemplate().queryForObject(sql, String.class);
    }
}

