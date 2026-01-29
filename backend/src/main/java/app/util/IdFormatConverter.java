package app.util;

import java.math.BigInteger;

public class IdFormatConverter {
    
    private static final String BASE36_CHARS = "0123456789abcdefghijklmnopqrstuvwxyz";
    private static final String BASE64_CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-";
    
    /**
     * Parse a string ID value to long, auto-detecting format
     * Supports: integer string, base36, base64-like, hex
     */
    public static long parseIdString(String idStr) throws IllegalArgumentException {
        if (idStr == null || idStr.isEmpty()) {
            throw new IllegalArgumentException("ID string cannot be null or empty");
        }
        
        idStr = idStr.trim().toLowerCase();
        
        // Try hex format first (starts with 0x)
        if (idStr.startsWith("0x")) {
            try {
                return new BigInteger(idStr.substring(2), 16).longValue();
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("Invalid hex format: " + idStr);
            }
        }
        
        // Try pure decimal integer
        if (idStr.matches("\\d+")) {
            try {
                return Long.parseUnsignedLong(idStr);
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("Invalid decimal format: " + idStr);
            }
        }
        
        // Try base36 (only 0-9a-z)
        if (idStr.matches("[0-9a-z]+")) {
            try {
                return base36ToLong(idStr);
            } catch (Exception e) {
                throw new IllegalArgumentException("Invalid base36 format: " + idStr);
            }
        }
        
        // Try base64-like (0-9a-zA-Z_-)
        if (idStr.matches("[0-9a-zA-Z_-]+")) {
            try {
                return base64ToLong(idStr.toLowerCase());
            } catch (Exception e) {
                throw new IllegalArgumentException("Invalid base64 format: " + idStr);
            }
        }
        
        throw new IllegalArgumentException("Unknown ID format: " + idStr);
    }
    
    /**
     * Convert long to base36 string
     */
    public static String longToBase36(long value) {
        if (value == 0) {
            return "0";
        }
        
        StringBuilder sb = new StringBuilder();
        long remaining = value;
        
        while (remaining > 0) {
            int digit = (int) (remaining % 36);
            sb.insert(0, BASE36_CHARS.charAt(digit));
            remaining = Long.divideUnsigned(remaining, 36);
        }
        
        return sb.toString();
    }
    
    /**
     * Convert base36 string to long
     */
    public static long base36ToLong(String base36) {
        base36 = base36.toLowerCase();
        long result = 0;
        
        for (int i = 0; i < base36.length(); i++) {
            char c = base36.charAt(i);
            int digit = BASE36_CHARS.indexOf(c);
            if (digit < 0) {
                throw new IllegalArgumentException("Invalid base36 character: " + c);
            }
            result = result * 36 + digit;
        }
        
        return result;
    }
    
    /**
     * Convert long to base64-like string (URL-safe: 0-9a-zA-Z_-)
     */
    public static String longToBase64(long value) {
        if (value == 0) {
            return "0";
        }
        
        StringBuilder sb = new StringBuilder();
        long remaining = value;
        
        while (remaining > 0) {
            int digit = (int) (remaining % 64);
            sb.insert(0, BASE64_CHARS.charAt(digit));
            remaining = Long.divideUnsigned(remaining, 64);
        }
        
        return sb.toString();
    }
    
    /**
     * Convert base64-like string to long
     */
    public static long base64ToLong(String base64) {
        long result = 0;
        
        for (int i = 0; i < base64.length(); i++) {
            char c = base64.charAt(i);
            int digit = BASE64_CHARS.indexOf(c);
            if (digit < 0) {
                throw new IllegalArgumentException("Invalid base64 character: " + c);
            }
            result = result * 64 + digit;
        }
        
        return result;
    }
    
    /**
     * Convert long to hex string
     */
    public static String longToHex(long value) {
        return "0x" + Long.toUnsignedString(value, 16);
    }
    
    /**
     * Convert all formats for a given long value
     */
    public static app.pojo.IdConvertResult convertAll(long value) {
        return new app.pojo.IdConvertResult(
            value,
            longToBase36(value),
            longToBase64(value),
            longToHex(value)
        );
    }
}
