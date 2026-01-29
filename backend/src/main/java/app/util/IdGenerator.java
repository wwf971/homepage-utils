package app.util;

import java.security.SecureRandom;
import java.util.concurrent.atomic.AtomicInteger;

public class IdGenerator {
    
    private static final SecureRandom random = new SecureRandom();
    private static final AtomicInteger offsetCounter = new AtomicInteger(0);
    
    /**
     * Generate a random 64-bit unsigned ID
     * Note: Java long is signed, but we treat it as unsigned
     */
    public static long generateRandomId() {
        // Generate a random positive 64-bit ID
        byte[] bytes = new byte[8];
        random.nextBytes(bytes);
        
        long result = 0;
        for (int i = 0; i < 8; i++) {
            result = (result << 8) | (bytes[i] & 0xFF);
        }
        
        // Clear the sign bit to ensure positive value (63-bit positive range)
        return result & 0x7FFFFFFFFFFFFFFFL;
    }
    
    /**
     * Generate a timestamp-based ID using ms_48 scheme
     * High 48 bits: milliseconds since epoch
     * Low 16 bits: offset counter (0-65535)
     * 
     * Scheme:
     * high |-------48bit------|---16bit---| low
     * high |---unix_stamp_ms--|---offset--| low
     */
    public static long generateMs48Id() {
        long currentTimeMs = System.currentTimeMillis();
        int offset = offsetCounter.getAndIncrement() & 0xFFFF; // Keep in 16-bit range
        
        // Ensure timestamp fits in 48 bits
        if (currentTimeMs > 0xFFFFFFFFFFFFL) {
            throw new IllegalStateException("Timestamp exceeds 48-bit limit");
        }
        
        // Combine: high 48 bits = timestamp, low 16 bits = offset
        long id = (currentTimeMs << 16) | offset;
        
        // Clear the sign bit to ensure positive value
        return id & 0x7FFFFFFFFFFFFFFFL;
    }
    
    /**
     * Extract timestamp from ms_48 ID
     */
    public static long extractTimestampMs(long ms48Id) {
        return ms48Id >>> 16; // Unsigned right shift to get high 48 bits
    }
    
    /**
     * Extract offset from ms_48 ID
     */
    public static int extractOffset(long ms48Id) {
        return (int) (ms48Id & 0xFFFF); // Mask low 16 bits
    }
}
