package app.pojo;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;

public class IdEntity {
    @JsonSerialize(using = ToStringSerializer.class)
    private long value;
    private int selfType;
    private String type;
    private String metadata;
    @JsonSerialize(using = ToStringSerializer.class)
    private long createAt;
    private int createAtTimezone;

    public IdEntity() {
    }

    public IdEntity(long value, int selfType, String type, String metadata, long createAt, int createAtTimezone) {
        this.value = value;
        this.selfType = selfType;
        this.type = type;
        this.metadata = metadata;
        this.createAt = createAt;
        this.createAtTimezone = createAtTimezone;
    }

    public long getValue() {
        return value;
    }

    public void setValue(long value) {
        this.value = value;
    }

    public int getSelfType() {
        return selfType;
    }

    public void setSelfType(int selfType) {
        this.selfType = selfType;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getMetadata() {
        return metadata;
    }

    public void setMetadata(String metadata) {
        this.metadata = metadata;
    }

    public long getCreateAt() {
        return createAt;
    }

    public void setCreateAt(long createAt) {
        this.createAt = createAt;
    }

    public int getCreateAtTimezone() {
        return createAtTimezone;
    }

    public void setCreateAtTimezone(int createAtTimezone) {
        this.createAtTimezone = createAtTimezone;
    }

    @Override
    public String toString() {
        return "IdEntity{" +
                "value=" + value +
                ", selfType=" + selfType +
                ", type='" + type + '\'' +
                ", metadata='" + metadata + '\'' +
                ", createAt=" + createAt +
                ", createAtTimezone=" + createAtTimezone +
                '}';
    }
}
