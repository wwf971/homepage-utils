package app.service;

import app.event.JdbcConfigChangeEvent;
import app.pojo.JdbcConfig;
import app.pojo.JdbcConnectionStatus;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import com.zaxxer.hikari.HikariPoolMXBean;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

import java.sql.Connection;
import java.sql.SQLException;

@Service
public class JdbcConnectionService {

    private HikariDataSource dataSource;
    private JdbcConfig configCurrent;

    private final JdbcConfigService configService;

    public JdbcConnectionService(JdbcConfigService configService) {
        this.configService = configService;
        this.configCurrent = configService.getConfigCurrent();
        System.out.println("JdbcConnectionService initialized with config from JdbcConfigService (lazy connection): " + configCurrent);
        System.out.println("JDBC will connect on first use or manual start");
    }

    @EventListener
    public void onConfigChange(JdbcConfigChangeEvent event) {
        System.out.println("Config change event received in JdbcConnectionService");
        System.out.println("Old config: " + event.getOldConfig());
        System.out.println("New config: " + event.getNewConfig());
        
        // Only close existing connection, don't automatically restart
        // User must manually start connection or test it
        closeDataSource();
        this.configCurrent = event.getNewConfig();
        System.out.println("Connection closed due to config change. Use 'Start Connection' or 'Test' to connect with new config.");
    }

    private void initializeDataSource(JdbcConfig config) {
        HikariConfig hikariConfig = new HikariConfig();
        hikariConfig.setJdbcUrl(config.getUrl());
        hikariConfig.setUsername(config.getUsername());
        hikariConfig.setPassword(config.getPassword());
        hikariConfig.setDriverClassName(config.getDriverClassName());
        
        hikariConfig.setMaximumPoolSize(10);
        hikariConfig.setMinimumIdle(2);
        hikariConfig.setConnectionTimeout(30000);
        hikariConfig.setIdleTimeout(600000);
        hikariConfig.setMaxLifetime(1800000);
        
        this.dataSource = new HikariDataSource(hikariConfig);
        System.out.println("HikariCP DataSource initialized successfully");
    }

    private void closeDataSource() {
        if (this.dataSource != null && !this.dataSource.isClosed()) {
            this.dataSource.close();
            System.out.println("Previous HikariCP DataSource closed");
        }
    }

    public JdbcConnectionStatus getStatus() {
        JdbcConnectionStatus status = new JdbcConnectionStatus();
        status.setCurrentUrl(configCurrent != null ? configCurrent.getUrl() : null);

        // If dataSource is null, try lazy initialization
        if (dataSource == null && configCurrent != null) {
            try {
                initializeDataSource(configCurrent);
            } catch (Exception e) {
                System.err.println("Failed to initialize connection for status check: " + e.getMessage());
                status.setConnected(false);
                status.setActiveConnections(0);
                status.setIdleConnections(0);
                status.setTotalConnections(0);
                status.setMaxPoolSize(0);
                status.setMinIdle(0);
                return status;
            }
        }

        if (dataSource == null || dataSource.isClosed()) {
            status.setConnected(false);
            status.setActiveConnections(0);
            status.setIdleConnections(0);
            status.setTotalConnections(0);
            status.setMaxPoolSize(0);
            status.setMinIdle(0);
            return status;
        }

        try {
            try (Connection conn = dataSource.getConnection()) {
                status.setConnected(conn.isValid(1));
            } catch (SQLException e) {
                status.setConnected(false);
            }

            HikariPoolMXBean poolMXBean = dataSource.getHikariPoolMXBean();
            if (poolMXBean != null) {
                status.setActiveConnections(poolMXBean.getActiveConnections());
                status.setIdleConnections(poolMXBean.getIdleConnections());
                status.setTotalConnections(poolMXBean.getTotalConnections());
            }
            // Get pool size config from HikariDataSource directly
            status.setMaxPoolSize(dataSource.getMaximumPoolSize());
            status.setMinIdle(dataSource.getMinimumIdle());
        } catch (Exception e) {
            System.err.println("Error retrieving JDBC connection status: " + e.getMessage());
            status.setConnected(false);
        }
        return status;
    }

    public void stopConnection() {
        closeDataSource();
        System.out.println("JDBC connection stopped manually");
    }

    public void startConnection(JdbcConfig config) {
        if (dataSource != null && !dataSource.isClosed()) {
            throw new IllegalStateException("Connection is already active. Stop it first.");
        }
        this.configCurrent = config;
        initializeDataSource(config);
        System.out.println("JDBC connection started manually with config: " + config);
    }

    public HikariDataSource getDataSource() {
        if (this.dataSource == null && this.configCurrent != null) {
            try {
                initializeDataSource(this.configCurrent);
            } catch (Exception e) {
                System.err.println("Failed to lazily connect to database: " + e.getMessage());
                return null;
            }
        }
        return dataSource;
    }

    public String testConnection() throws SQLException {
        // If not initialized, try with a test datasource with timeouts
        if (dataSource == null || dataSource.isClosed()) {
            if (configCurrent != null) {
                HikariConfig testConfig = new HikariConfig();
                testConfig.setJdbcUrl(configCurrent.getUrl());
                testConfig.setUsername(configCurrent.getUsername());
                testConfig.setPassword(configCurrent.getPassword());
                testConfig.setDriverClassName(configCurrent.getDriverClassName());
                
                // Set timeouts for testing (120 seconds)
                testConfig.setConnectionTimeout(120000);
                testConfig.setValidationTimeout(120000);
                testConfig.setMaximumPoolSize(1);
                testConfig.setMinimumIdle(0);
                
                try (HikariDataSource testDataSource = new HikariDataSource(testConfig)) {
                    try (Connection conn = testDataSource.getConnection()) {
                        if (!conn.isValid(120)) {
                            throw new SQLException("Connection is not valid");
                        }
                        
                        // Execute a simple query
                        try (var stmt = conn.createStatement()) {
                            stmt.setQueryTimeout(120);
                            try (var rs = stmt.executeQuery("SELECT 1")) {
                                if (rs.next()) {
                                    int result = rs.getInt(1);
                                    return "Connection successful! Test query returned: " + result;
                                }
                            }
                        }
                    }
                } catch (Exception e) {
                    throw new SQLException("Connection test failed: " + e.getMessage());
                }
            } else {
                throw new SQLException("No configuration available");
            }
        }
        
        // If already initialized, use existing datasource
        try (Connection conn = dataSource.getConnection()) {
            if (!conn.isValid(120)) {
                throw new SQLException("Connection is not valid");
            }
            
            // Execute a simple query to test the connection
            try (var stmt = conn.createStatement()) {
                stmt.setQueryTimeout(120);
                try (var rs = stmt.executeQuery("SELECT 1")) {
                    if (rs.next()) {
                        int result = rs.getInt(1);
                        return "Connection successful! Test query returned: " + result;
                    }
                }
            }
        }
        
        throw new SQLException("Test query did not return expected result");
    }
}
