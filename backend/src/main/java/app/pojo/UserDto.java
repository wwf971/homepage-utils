package app.pojo;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class UserDto {
    
    // Optional - only for update operations
    private Integer userId;
    
    // Using @NotNull + @Length (demonstration)
    @NotNull(message = "Username cannot be null")
    @Size(min = 3, max = 50, message = "Username length must be between 3 and 50")
    private String userName;
    
    // Using @NotBlank + @Length (demonstration)
    @NotBlank(message = "Password is required and cannot be blank")
    @Size(min = 6, max = 100, message = "Password length must be at least 6 characters")
    private String password;
    
    // Using @NotNull + @Email (demonstration)
    @NotNull(message = "Email cannot be null")
    @Email(message = "Email should be valid")
    @Size(max = 100, message = "Email is too long")
    private String email;
    
    // Constructors
    public UserDto() {
    }
    
    public UserDto(String userName, String password, String email) {
        this.userName = userName;
        this.password = password;
        this.email = email;
    }
    
    // Convert DTO to Entity
    public User toEntity() {
        User user = new User(userName, password, email);
        if (userId != null) {
            user.setUserId(userId);
        }
        return user;
    }
    
    // Getters and Setters
    public Integer getUserId() {
        return userId;
    }
    
    public void setUserId(Integer userId) {
        this.userId = userId;
    }
    
    public String getUserName() {
        return userName;
    }
    
    public void setUserName(String userName) {
        this.userName = userName;
    }
    
    public String getPassword() {
        return password;
    }
    
    public void setPassword(String password) {
        this.password = password;
    }
    
    public String getEmail() {
        return email;
    }
    
    public void setEmail(String email) {
        this.email = email;
    }
}
