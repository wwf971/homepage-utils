package app.service;

import app.pojo.*;
import app.util.IdFormatConverter;
import app.util.IdGenerator;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.TimeZone;

@Service
public class IdService {

    private final IdConfigService idConfigService;
    private final JdbcConnectionService jdbcConnectionService;

    @Autowired
    public IdService(IdConfigService idConfigService, JdbcConnectionService jdbcConnectionService) {
        this.idConfigService = idConfigService;
        this.jdbcConnectionService = jdbcConnectionService;
    }

    private JdbcTemplate getJdbcTemplate() throws Exception {
        DataSource dataSource = jdbcConnectionService.getDataSource();
        if (dataSource == null) {
            throw new Exception("JDBC connection not configured");
        }
        return new JdbcTemplate(dataSource);
    }

    private String getFullTableName() {
        IdConfig config = idConfigService.getConfigCurrent();
        String dbName = config.getDatabaseName();
        String tableName = config.getTableName();
        
        if (dbName == null || dbName.isEmpty() || tableName == null || tableName.isEmpty()) {
            throw new IllegalStateException("Database name or table name not configured");
        }
        
        return "`" + dbName + "`.`" + tableName + "`";
    }

    private int getCurrentTimezoneOffset() {
        TimeZone tz = TimeZone.getDefault();
        int offsetMs = tz.getRawOffset();
        return offsetMs / (1000 * 60 * 60); // Convert to hours
    }

    /**
     * Issue a new random ID
     */
    public IdEntity issueRandomId(IdIssueRequest request) throws Exception {
        try {
            long idValue = IdGenerator.generateRandomId();
            long createAt = System.currentTimeMillis();
            int timezone = request.getTimezoneOffset() != null ? request.getTimezoneOffset() : getCurrentTimezoneOffset();

            IdEntity entity = new IdEntity(idValue, 0, request.getType(), request.getMetadata(), createAt, timezone);
            
            System.out.println("Issuing random ID: " + idValue + " (base36: " + 
                IdFormatConverter.longToBase36(idValue) + ")");
            
            saveId(entity);
            return entity;
        } catch (Exception e) {
            System.err.println("Failed to issue random ID: " + e.getMessage());
            e.printStackTrace();
            throw e;
        }
    }

    /**
     * Issue a new ms_48 timestamp-based ID
     */
    public IdEntity issueMs48Id(IdIssueRequest request) throws Exception {
        try {
            long idValue = IdGenerator.generateMs48Id();
            long createAt = System.currentTimeMillis();
            int timezone = request.getTimezoneOffset() != null ? request.getTimezoneOffset() : getCurrentTimezoneOffset();

            IdEntity entity = new IdEntity(idValue, 1, request.getType(), request.getMetadata(), createAt, timezone);
            
            System.out.println("Issuing ms_48 ID: " + idValue + " (base36: " + 
                IdFormatConverter.longToBase36(idValue) + ")");
            
            saveId(entity);
            return entity;
        } catch (Exception e) {
            System.err.println("Failed to issue ms_48 ID: " + e.getMessage());
            e.printStackTrace();
            throw e;
        }
    }

    /**
     * Save ID to database
     */
    private void saveId(IdEntity entity) throws Exception {
        JdbcTemplate jdbcTemplate = getJdbcTemplate();
        String tableName = getFullTableName();

        String sql = "INSERT INTO " + tableName + " (value, selfType, type, metadata, createAt, createAtTimezone) " +
                     "VALUES (?, ?, ?, ?, ?, ?)";

        try {
            int rowsAffected = jdbcTemplate.update(sql,
                entity.getValue(),
                entity.getSelfType(),
                entity.getType(),
                entity.getMetadata(),
                entity.getCreateAt(),
                entity.getCreateAtTimezone()
            );
            
            if (rowsAffected == 0) {
                throw new Exception("Failed to insert ID: no rows affected");
            }
            
            System.out.println("Successfully saved ID: " + entity.getValue() + " (base36: " + 
                IdFormatConverter.longToBase36(entity.getValue()) + ")");
        } catch (Exception e) {
            System.err.println("Failed to save ID to database: " + e.getMessage());
            e.printStackTrace();
            throw new Exception("Failed to save ID to database: " + e.getMessage(), e);
        }
    }

    /**
     * Get ID by value (supports integer or string format)
     */
    public IdEntity getById(String valueStr) throws Exception {
        long value;
        try {
            value = IdFormatConverter.parseIdString(valueStr);
        } catch (IllegalArgumentException e) {
            throw new Exception("Invalid ID format: " + e.getMessage());
        }

        JdbcTemplate jdbcTemplate = getJdbcTemplate();
        String tableName = getFullTableName();

        String sql = "SELECT * FROM " + tableName + " WHERE value = ?";
        List<IdEntity> results = jdbcTemplate.query(sql, new IdRowMapper(), value);

        if (results.isEmpty()) {
            throw new Exception("ID not found: " + valueStr);
        }

        return results.get(0);
    }

    /**
     * List all IDs with pagination
     */
    public IdListResult listIds(int page, int pageSize) throws Exception {
        if (page < 0) page = 0;
        if (pageSize <= 0) pageSize = 20;
        if (pageSize > 1000) pageSize = 1000; // Max limit

        JdbcTemplate jdbcTemplate = getJdbcTemplate();
        String tableName = getFullTableName();

        // Get total count
        String countSql = "SELECT COUNT(*) FROM " + tableName;
        Long totalCount = jdbcTemplate.queryForObject(countSql, Long.class);

        // Get paginated results
        int offset = page * pageSize;
        String sql = "SELECT * FROM " + tableName + " ORDER BY createAt DESC LIMIT ? OFFSET ?";
        List<IdEntity> ids = jdbcTemplate.query(sql, new IdRowMapper(), pageSize, offset);

        return new IdListResult(ids, page, pageSize, totalCount != null ? totalCount : 0);
    }

    /**
     * Search IDs by filters
     */
    public IdListResult searchIds(IdSearchRequest request) throws Exception {
        int page = request.getPage() != null ? request.getPage() : 0;
        int pageSize = request.getPageSize() != null ? request.getPageSize() : 20;
        if (page < 0) page = 0;
        if (pageSize <= 0) pageSize = 20;
        if (pageSize > 1000) pageSize = 1000;

        JdbcTemplate jdbcTemplate = getJdbcTemplate();
        String tableName = getFullTableName();

        // Build WHERE clause
        List<String> conditions = new ArrayList<>();
        List<Object> params = new ArrayList<>();

        if (request.getSelfType() != null) {
            conditions.add("selfType = ?");
            params.add(request.getSelfType());
        }

        if (request.getType() != null && !request.getType().isEmpty()) {
            conditions.add("type = ?");
            params.add(request.getType());
        }

        if (request.getCreateAtStart() != null) {
            conditions.add("createAt >= ?");
            params.add(request.getCreateAtStart());
        }

        if (request.getCreateAtEnd() != null) {
            conditions.add("createAt <= ?");
            params.add(request.getCreateAtEnd());
        }

        String whereClause = conditions.isEmpty() ? "" : " WHERE " + String.join(" AND ", conditions);

        // Get total count
        String countSql = "SELECT COUNT(*) FROM " + tableName + whereClause;
        Long totalCount = jdbcTemplate.queryForObject(countSql, Long.class, params.toArray());

        // Get paginated results
        int offset = page * pageSize;
        List<Object> queryParams = new ArrayList<>(params);
        queryParams.add(pageSize);
        queryParams.add(offset);

        String sql = "SELECT * FROM " + tableName + whereClause + " ORDER BY createAt DESC LIMIT ? OFFSET ?";
        List<IdEntity> ids = jdbcTemplate.query(sql, new IdRowMapper(), queryParams.toArray());

        return new IdListResult(ids, page, pageSize, totalCount != null ? totalCount : 0);
    }

    /**
     * Update ID metadata
     */
    public void updateMetadata(String valueStr, String metadata) throws Exception {
        long value;
        try {
            value = IdFormatConverter.parseIdString(valueStr);
        } catch (IllegalArgumentException e) {
            throw new Exception("Invalid ID format: " + e.getMessage());
        }

        JdbcTemplate jdbcTemplate = getJdbcTemplate();
        String tableName = getFullTableName();

        String sql = "UPDATE " + tableName + " SET metadata = ? WHERE value = ?";
        int rowsAffected = jdbcTemplate.update(sql, metadata, value);

        if (rowsAffected == 0) {
            throw new Exception("ID not found: " + valueStr);
        }
    }

    /**
     * Delete ID
     */
    public void deleteId(String valueStr) throws Exception {
        long value;
        try {
            value = IdFormatConverter.parseIdString(valueStr);
        } catch (IllegalArgumentException e) {
            throw new Exception("Invalid ID format: " + e.getMessage());
        }

        JdbcTemplate jdbcTemplate = getJdbcTemplate();
        String tableName = getFullTableName();

        String sql = "DELETE FROM " + tableName + " WHERE value = ?";
        int rowsAffected = jdbcTemplate.update(sql, value);

        if (rowsAffected == 0) {
            throw new Exception("ID not found: " + valueStr);
        }
    }

    /**
     * Convert ID to all formats
     */
    public IdConvertResult convertId(String valueStr, String targetFormat) throws Exception {
        long value;
        try {
            value = IdFormatConverter.parseIdString(valueStr);
        } catch (IllegalArgumentException e) {
            throw new Exception("Invalid ID format: " + e.getMessage());
        }

        return IdFormatConverter.convertAll(value);
    }

    /**
     * Search IDs by base36 substring
     */
    public IdListResult searchBySubstring(IdSubstringSearchRequest request) throws Exception {
        int page = request.getPage() != null ? request.getPage() : 0;
        int pageSize = request.getPageSize() != null ? request.getPageSize() : 20;
        if (page < 0) page = 0;
        if (pageSize <= 0) pageSize = 20;
        if (pageSize > 1000) pageSize = 1000;

        String substring = request.getSubstring();
        if (substring == null || substring.isEmpty()) {
            throw new Exception("Substring cannot be empty");
        }

        substring = substring.toLowerCase().trim();

        JdbcTemplate jdbcTemplate = getJdbcTemplate();
        String tableName = getFullTableName();

        // Get all IDs and filter by base36 substring
        String sql = "SELECT * FROM " + tableName + " ORDER BY createAt DESC";
        List<IdEntity> allIds = jdbcTemplate.query(sql, new IdRowMapper());

        // Filter by base36 substring
        List<IdEntity> matchedIds = new ArrayList<>();
        for (IdEntity id : allIds) {
            String base36 = IdFormatConverter.longToBase36(id.getValue());
            if (base36.contains(substring)) {
                matchedIds.add(id);
            }
        }

        // Apply pagination
        int totalCount = matchedIds.size();
        int offset = page * pageSize;
        int endIndex = Math.min(offset + pageSize, totalCount);

        List<IdEntity> paginatedIds = new ArrayList<>();
        if (offset < totalCount) {
            paginatedIds = matchedIds.subList(offset, endIndex);
        }

        return new IdListResult(paginatedIds, page, pageSize, totalCount);
    }

    /**
     * RowMapper for IdEntity
     */
    private static class IdRowMapper implements RowMapper<IdEntity> {
        @Override
        public IdEntity mapRow(ResultSet rs, int rowNum) throws SQLException {
            return new IdEntity(
                rs.getLong("value"),
                rs.getInt("selfType"),
                rs.getString("type"),
                rs.getString("metadata"),
                rs.getLong("createAt"),
                rs.getInt("createAtTimezone")
            );
        }
    }
}
