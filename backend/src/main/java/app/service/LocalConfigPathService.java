package app.service;

import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Service
public class LocalConfigPathService {

    private final String configFilePath;
    private final boolean isDevelopmentMode;

    public LocalConfigPathService() {
        this.isDevelopmentMode = detectDevelopmentMode();
        this.configFilePath = determineConfigPath();
        ensureConfigDirectoryExists();
        System.out.println("LocalConfigPathService initialized: mode=" + 
            (isDevelopmentMode ? "development" : "docker") + ", path=" + configFilePath);
    }

    private boolean detectDevelopmentMode() {
        String dockerEnv = System.getenv("DOCKER_CONTAINER");
        if (dockerEnv != null && dockerEnv.equalsIgnoreCase("true")) {
            return false;
        }
        
        Path dockerEnvFile = Paths.get("/.dockerenv");
        if (Files.exists(dockerEnvFile)) {
            return false;
        }
        
        return true;
    }

    private String determineConfigPath() {
        if (isDevelopmentMode) {
            String userDir = System.getProperty("user.dir");
            return userDir + "/data/config.sqlite";
        } else {
            return "/data/config.sqlite";
        }
    }

    private void ensureConfigDirectoryExists() {
        try {
            Path configPath = Paths.get(configFilePath);
            Path parentDir = configPath.getParent();
            if (parentDir != null && !Files.exists(parentDir)) {
                Files.createDirectories(parentDir);
                System.out.println("Created config directory: " + parentDir);
            }
        } catch (Exception e) {
            System.err.println("Failed to create config directory: " + e.getMessage());
        }
    }

    public String getConfigFilePath() {
        return configFilePath;
    }

    public boolean isDevelopmentMode() {
        return isDevelopmentMode;
    }
}

