package app.service;

import org.springframework.stereotype.Service;

@Service
public class HelloService {
    
    public String getGreeting() {
        return "Hello, Spring Boot! 🚀 (from a Bean!)";
    }
    
    public String getWelcomeMessage() {
        return "Welcome to Spring Boot learning! This message comes from a Service Bean.";
    }
}

