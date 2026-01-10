package app.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import app.service.HelloService;

@RestController
public class HelloController {

    // Dependency Injection - Spring automatically injects the HelloService bean
    private final HelloService helloService;
    
    @Autowired
    public HelloController(HelloService helloService) {
        this.helloService = helloService;
    }
    
    @GetMapping("/")
    public String home() {
        // Now using the bean to get the message
        return helloService.getGreeting();
    }
    
    @GetMapping("/hello")
    public String hello() {
        // Also using the bean here
        return helloService.getWelcomeMessage();
    }
}

