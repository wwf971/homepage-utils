package app.service;

import org.springframework.beans.factory.annotation.Autowired;
// import org.springframework.stereotype.Service;

import app.pojo.User;
import app.pojo.UserDto;

// @Service - Disabled: JPA auto-configuration is disabled for dynamic connection management
// Re-enable this if you want to use Spring Data JPA
public class UserService {
    
    private final IUserService iUserService;
    
    @Autowired
    public UserService(IUserService iUserService) {
        this.iUserService = iUserService;
    }
    
    /**
     * Get all users
     */
    public Iterable<User> getAllUsers() {
        return iUserService.findAll();
    }
    
    /**
     * Get user by ID
     */
    public User getUserById(Integer id) {
        return iUserService.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found with id: " + id));
    }
    
    /**
     * Create a new user from DTO
     */
    public User createUser(UserDto userDto) {
        // Convert DTO to Entity
        User user = userDto.toEntity();
        
        // 自动判断user是否存在, 
        // 如果存在，则update
        // 如果不存在，则create
        return iUserService.save(user);
    }
    
    /**
     * Update an existing user
     */
    public User updateUser(Integer id, UserDto userDto) {
        User user = userDto.toEntity();
        user.setUserId(id);
        return iUserService.save(user);
    }
    
    /**
     * Delete user by ID
     */
    public void deleteUser(Integer id) {
        iUserService.deleteById(id);
    }
}

