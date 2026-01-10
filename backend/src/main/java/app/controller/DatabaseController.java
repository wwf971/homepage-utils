package app.controller;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import app.service.SqlService;

@RestController
@RequestMapping("/sql")
public class DatabaseController {
    
    private final SqlService sqlService;
    
    @Autowired
    public DatabaseController(SqlService sqlService) {
        this.sqlService = sqlService;
    }
    
    /**
     * Get MySQL version
     */
    @GetMapping("/info")
    public String getDatabaseInfo() {
        return "MySQL Version: " + sqlService.getDatabaseInfo();
    }
    
    /**
     * List all databases
     */
    @GetMapping("/list_db")
    public List<String> getAllDatabases() {
        return sqlService.listAllDatabases();
    }
    
    /**
     * List tables in a specific database
     */
    @GetMapping("/list_table")
    public List<String> getTablesInDatabase(@RequestParam("db") String dbName) {
        return sqlService.listTablesInDatabase(dbName);
    }
    
    /**
     * Get all databases with their tables
     */
    @GetMapping("/all")
    public Map<String, List<String>> getAllDatabasesWithTables() {
        return sqlService.getAllDatabasesWithTables();
    }
}

