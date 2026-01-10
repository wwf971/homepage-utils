package app.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
// import org.springframework.web.bind.annotation.RestController;

import app.pojo.User;
import app.pojo.UserDto;
import app.service.UserService;
import jakarta.validation.Valid;

// @RestController - Disabled: Depends on JPA which is disabled for dynamic connection management
// @RequestMapping("/user")
public class UserController {
    private final UserService userService;
    
    @Autowired
    public UserController(UserService userService) {
        this.userService = userService;
    }
    
    /**
     * Get all users
     * GET /user
     */
    @GetMapping
    public Iterable<User> getAllUsers() {
        return userService.getAllUsers();
    }
    
    /**
     * Get user by ID
     * GET /user/{id}
     */
    @GetMapping("/{id}")
    public User getUserById(@PathVariable Integer id) {
        return userService.getUserById(id);
    }
    
    /**
     * Create a new user
     * POST /user
     * Body: {"userName": "john", "password": "pass123", "email": "john@example.com"}
     */
    @PostMapping
    public User createUser(@Valid @RequestBody UserDto userDto) {
        return userService.createUser(userDto);
    }
    
    /**
     * Update an existing user
     * PUT /user/{id}
     * Body: {"userId": 1, "userName": "john_updated", "password": "newpass", "email": "newemail@example.com"}
     * Note: userId in body is optional, but if provided, must match the id in URL
     */
    @PutMapping("/{id}")
    public ResponseEntity<User> updateUser(@PathVariable Integer id, @Valid @RequestBody UserDto userDto) {
        // Check if userId in body exists and matches URL id
        if (userDto.getUserId() != null && !userDto.getUserId().equals(id)) {
            throw new IllegalArgumentException(
                "User ID in request body (" + userDto.getUserId() + 
                ") does not match URL path (" + id + ")"
            );
        }
        
        User updatedUser = userService.updateUser(id, userDto);
        return ResponseEntity.ok(updatedUser);
    }
    
    /**
     * Delete a user
     * DELETE /user/{id}
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable Integer id) {
        userService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }
}

