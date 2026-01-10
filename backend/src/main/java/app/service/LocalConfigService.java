package app.service;

import app.pojo.LocalConfig;
import org.springframework.stereotype.Service;

import java.sql.*;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class LocalConfigService {

    private final LocalConfigPathService pathService;
    private final String jdbcUrl;

    public LocalConfigService(LocalConfigPathService pathService) {
        this.pathService = pathService;
        this.jdbcUrl = "jdbc:sqlite:" + pathService.getConfigFilePath();
        initializeDatabase();
        System.out.println("LocalConfigService initialized with SQLite at: " + pathService.getConfigFilePath());
    }

    private void initializeDatabase() {
        String createTableSql = """
            CREATE TABLE IF NOT EXISTS config (
                config_key TEXT PRIMARY KEY,
                config_value TEXT NOT NULL,
                category TEXT NOT NULL,
                time_updated INTEGER NOT NULL
            )
        """;

        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement()) {
            stmt.execute(createTableSql);
            System.out.println("LocalConfig database initialized");
        } catch (SQLException e) {
            System.err.println("Failed to initialize database: " + e.getMessage());
            throw new RuntimeException("Failed to initialize LocalConfig database", e);
        }
    }

    private Connection getConnection() throws SQLException {
        return DriverManager.getConnection(jdbcUrl);
    }

    public void saveConfig(String key, String value, String category) {
        String sql = """
            INSERT INTO config (config_key, config_value, category, time_updated)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(config_key) DO UPDATE SET
                config_value = excluded.config_value,
                time_updated = excluded.time_updated
        """;

        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setString(1, key);
            pstmt.setString(2, value);
            pstmt.setString(3, category);
            pstmt.setLong(4, System.currentTimeMillis());
            pstmt.executeUpdate();
            System.out.println("Saved config: " + key + " = " + value + " [" + category + "]");
        } catch (SQLException e) {
            System.err.println("Failed to save config: " + e.getMessage());
            throw new RuntimeException("Failed to save config", e);
        }
    }

    public String getConfig(String key) {
        String sql = "SELECT config_value FROM config WHERE config_key = ?";

        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setString(1, key);
            ResultSet rs = pstmt.executeQuery();
            if (rs.next()) {
                return rs.getString("config_value");
            }
            return null;
        } catch (SQLException e) {
            System.err.println("Failed to get config: " + e.getMessage());
            return null;
        }
    }

    public LocalConfig getConfigFull(String key) {
        String sql = "SELECT * FROM config WHERE config_key = ?";

        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setString(1, key);
            ResultSet rs = pstmt.executeQuery();
            if (rs.next()) {
                LocalConfig config = new LocalConfig();
                config.setConfigKey(rs.getString("config_key"));
                config.setConfigValue(rs.getString("config_value"));
                config.setCategory(rs.getString("category"));
                config.setTimeUpdated(rs.getLong("time_updated"));
                return config;
            }
            return null;
        } catch (SQLException e) {
            System.err.println("Failed to get config: " + e.getMessage());
            return null;
        }
    }

    public Map<String, String> getConfigsByCategory(String category) {
        String sql = "SELECT config_key, config_value FROM config WHERE category = ?";
        Map<String, String> configs = new HashMap<>();

        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setString(1, category);
            ResultSet rs = pstmt.executeQuery();
            while (rs.next()) {
                configs.put(rs.getString("config_key"), rs.getString("config_value"));
            }
        } catch (SQLException e) {
            System.err.println("Failed to get configs by category: " + e.getMessage());
        }

        return configs;
    }

    public List<LocalConfig> getAllConfigs() {
        String sql = "SELECT * FROM config ORDER BY category, config_key";
        List<LocalConfig> configs = new ArrayList<>();

        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) {
                LocalConfig config = new LocalConfig();
                config.setConfigKey(rs.getString("config_key"));
                config.setConfigValue(rs.getString("config_value"));
                config.setCategory(rs.getString("category"));
                config.setTimeUpdated(rs.getLong("time_updated"));
                configs.add(config);
            }
        } catch (SQLException e) {
            System.err.println("Failed to get all configs: " + e.getMessage());
        }

        return configs;
    }

    public void deleteConfig(String key) {
        String sql = "DELETE FROM config WHERE config_key = ?";

        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setString(1, key);
            pstmt.executeUpdate();
            System.out.println("Deleted config: " + key);
        } catch (SQLException e) {
            System.err.println("Failed to delete config: " + e.getMessage());
        }
    }
}

