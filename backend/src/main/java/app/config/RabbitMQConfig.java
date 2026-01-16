package app.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.CachingConnectionFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;

@Configuration
public class RabbitMQConfig {
    
    public static final String TASK_QUEUE = "task-queue";
    public static final String TASK_EXCHANGE = "task-exchange";
    public static final String TASK_ROUTING_KEY = "task-routing-key";

    @Value("${spring.rabbitmq.host:localhost}")
    private String host;
    
    @Value("${spring.rabbitmq.port:5672}")
    private int port;
    
    @Value("${spring.rabbitmq.username:}")
    private String username;
    
    @Value("${spring.rabbitmq.password:}")
    private String password;
    
    @Value("${spring.rabbitmq.virtual-host:/}")
    private String virtualHost;
    
    @Value("${spring.rabbitmq.connection-timeout:5000}")
    private int connectionTimeout;

    @Bean
    @Lazy
    public ConnectionFactory connectionFactory() {
        try {
            CachingConnectionFactory factory = new CachingConnectionFactory();
            factory.setHost(host);
            factory.setPort(port);
            factory.setVirtualHost(virtualHost);
            factory.setConnectionTimeout(connectionTimeout);
            
            if (username != null && !username.isEmpty()) {
                factory.setUsername(username);
            }
            if (password != null && !password.isEmpty()) {
                factory.setPassword(password);
            }
            
            System.out.println("Creating RabbitMQ ConnectionFactory for " + host + ":" + port);
            return factory;
        } catch (Exception e) {
            System.err.println("WARNING: Failed to create RabbitMQ ConnectionFactory. RabbitMQ server may be unavailable. Error: " + e.getMessage());
            return null;
        }
    }

    @Bean
    public Queue taskQueue() {
        // durable=true ensures messages survive broker restart
        return new Queue(TASK_QUEUE, true);
    }

    @Bean
    public DirectExchange taskExchange() {
        return new DirectExchange(TASK_EXCHANGE);
    }

    @Bean
    public Binding taskBinding(Queue taskQueue, DirectExchange taskExchange) {
        return BindingBuilder.bind(taskQueue).to(taskExchange).with(TASK_ROUTING_KEY);
    }

    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    @Lazy
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory, MessageConverter messageConverter) {
        if (connectionFactory == null) {
            System.err.println("WARNING: ConnectionFactory is null, cannot create RabbitTemplate");
            return null;
        }
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(messageConverter);
        return template;
    }
}
