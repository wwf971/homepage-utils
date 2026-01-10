package app.service;

import org.springframework.data.repository.CrudRepository;
// import org.springframework.stereotype.Repository;

import app.pojo.User;

// JPA will crash the app, if database connection cannot be established at startup.
// so we can't use it for dynamic connection management.

// @Repository - Disabled: JPA auto-configuration is disabled for dynamic connection management
// Re-enable this if you want to use Spring Data JPA
public interface IUserService extends CrudRepository<User, Integer> {
    // Spring Data automatically provides:
    // save(), findById(), findAll(), deleteById(), count(), etc.
}
