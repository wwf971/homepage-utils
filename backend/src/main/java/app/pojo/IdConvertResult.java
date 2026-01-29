package app.pojo;

public class IdConvertResult {
    private long valueInt;
    private String valueBase36;
    private String valueBase64;
    private String valueHex;

    public IdConvertResult(long valueInt, String valueBase36, String valueBase64, String valueHex) {
        this.valueInt = valueInt;
        this.valueBase36 = valueBase36;
        this.valueBase64 = valueBase64;
        this.valueHex = valueHex;
    }

    public long getValueInt() {
        return valueInt;
    }

    public void setValueInt(long valueInt) {
        this.valueInt = valueInt;
    }

    public String getValueBase36() {
        return valueBase36;
    }

    public void setValueBase36(String valueBase36) {
        this.valueBase36 = valueBase36;
    }

    public String getValueBase64() {
        return valueBase64;
    }

    public void setValueBase64(String valueBase64) {
        this.valueBase64 = valueBase64;
    }

    public String getValueHex() {
        return valueHex;
    }

    public void setValueHex(String valueHex) {
        this.valueHex = valueHex;
    }
}
