package app.util;

import java.time.ZoneId;
import java.time.ZonedDateTime;

public class TimeUtils {
    
    /**
     * Get current timestamp in milliseconds
     */
    public static long getCurrentTimestamp() {
        return System.currentTimeMillis();
    }

    /**
     * Get current timezone offset (-12 to +12)
     */
    public static int getCurrentTimezoneOffset() {
        ZonedDateTime now = ZonedDateTime.now(ZoneId.systemDefault());
        return now.getOffset().getTotalSeconds() / 3600;
    }
}
