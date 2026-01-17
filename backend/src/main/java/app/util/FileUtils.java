package app.util;

public class FileUtils {
    
    /**
     * Determines content type based on file extension
     * @param fileName The file name
     * @param detectedContentType The content type detected by Files.probeContentType()
     * @return The appropriate content type
     */
    public static String determineContentType(String fileName, String detectedContentType) {
        if (fileName == null) {
            return detectedContentType != null ? detectedContentType : "application/octet-stream";
        }
        
        String lowerName = fileName.toLowerCase();
        
        // Text files that should be displayed inline (with UTF-8 charset)
        if (lowerName.endsWith(".txt")) return "text/plain; charset=utf-8";
        if (lowerName.endsWith(".md")) return "text/markdown; charset=utf-8";
        if (lowerName.endsWith(".yaml") || lowerName.endsWith(".yml")) return "text/yaml; charset=utf-8";
        if (lowerName.endsWith(".json")) return "application/json; charset=utf-8";
        if (lowerName.endsWith(".xml")) return "application/xml; charset=utf-8";
        if (lowerName.endsWith(".csv")) return "text/csv; charset=utf-8";
        if (lowerName.endsWith(".log")) return "text/plain; charset=utf-8";
        
        // Programming language files
        if (lowerName.endsWith(".java")) return "text/x-java-source; charset=utf-8";
        if (lowerName.endsWith(".js")) return "text/javascript; charset=utf-8";
        if (lowerName.endsWith(".ts")) return "text/typescript; charset=utf-8";
        if (lowerName.endsWith(".jsx")) return "text/javascript; charset=utf-8";
        if (lowerName.endsWith(".tsx")) return "text/typescript; charset=utf-8";
        if (lowerName.endsWith(".py")) return "text/x-python; charset=utf-8";
        if (lowerName.endsWith(".go")) return "text/x-go; charset=utf-8";
        if (lowerName.endsWith(".rs")) return "text/x-rust; charset=utf-8";
        if (lowerName.endsWith(".c") || lowerName.endsWith(".h")) return "text/x-c; charset=utf-8";
        if (lowerName.endsWith(".cpp") || lowerName.endsWith(".hpp")) return "text/x-c++; charset=utf-8";
        if (lowerName.endsWith(".sh")) return "text/x-shellscript; charset=utf-8";
        
        // Web files
        if (lowerName.endsWith(".html") || lowerName.endsWith(".htm")) return "text/html; charset=utf-8";
        if (lowerName.endsWith(".css")) return "text/css; charset=utf-8";
        
        // Images - browsers can display these
        if (lowerName.endsWith(".png")) return "image/png";
        if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return "image/jpeg";
        if (lowerName.endsWith(".gif")) return "image/gif";
        if (lowerName.endsWith(".svg")) return "image/svg+xml";
        if (lowerName.endsWith(".webp")) return "image/webp";
        if (lowerName.endsWith(".ico")) return "image/x-icon";
        
        // Documents - browsers can display these
        if (lowerName.endsWith(".pdf")) return "application/pdf";
        
        // Audio/Video - browsers can play these
        if (lowerName.endsWith(".mp3")) return "audio/mpeg";
        if (lowerName.endsWith(".mp4")) return "video/mp4";
        if (lowerName.endsWith(".webm")) return "video/webm";
        if (lowerName.endsWith(".ogg")) return "audio/ogg";
        if (lowerName.endsWith(".wav")) return "audio/wav";
        
        // Use detected content type if available
        if (detectedContentType != null) {
            return detectedContentType;
        }
        
        // Default to text/plain for unknown types to avoid download
        return "text/plain; charset=utf-8";
    }
}
