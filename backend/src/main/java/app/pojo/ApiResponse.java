package app.pojo;

public class ApiResponse<T> {
    
    private Integer code;
    private T data;
    private String message;
    
    // Constructors
    public ApiResponse() {
    }
    
    public ApiResponse(Integer code) {
        this.code = code;
    }
    
    public ApiResponse(Integer code, T data) {
        this.code = code;
        this.data = data;
    }
    
    public ApiResponse(Integer code, T data, String message) {
        this.code = code;
        this.data = data;
        this.message = message;
    }
    
    // Static factory methods for convenience
    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(0, data, "Success");
    }
    
    public static <T> ApiResponse<T> success(T data, String message) {
        return new ApiResponse<>(0, data, message);
    }
    
    public static <T> ApiResponse<T> error(Integer code, String message) {
        return new ApiResponse<>(code, null, message);
    }
    
    public static <T> ApiResponse<T> error(String message) {
        return new ApiResponse<>(-1, null, message);
    }
    
    // Getters and Setters
    public Integer getCode() {
        return code;
    }
    
    public ApiResponse<T> setCode(Integer code) {
        this.code = code;
        return this;
    }
    
    public T getData() {
        return data;
    }
    
    public ApiResponse<T> setData(T data) {
        this.data = data;
        return this;
    }
    
    public String getMessage() {
        return message;
    }
    
    public ApiResponse<T> setMessage(String message) {
        this.message = message;
        return this;
    }
}

