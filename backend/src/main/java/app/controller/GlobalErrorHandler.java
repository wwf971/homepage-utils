package app.controller;

import app.pojo.ApiResponse;
import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Global error handler that returns JSON error responses for API routes
 * This prevents the SPA frontend HTML from being served for non-existent API routes
 */
@Controller
public class GlobalErrorHandler implements ErrorController {

    @RequestMapping(value = "/error", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<Object>> handleError(HttpServletRequest request, HttpServletResponse response) {
        Object status = request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);
        Object message = request.getAttribute(RequestDispatcher.ERROR_MESSAGE);
        Object requestUri = request.getAttribute(RequestDispatcher.ERROR_REQUEST_URI);
        
        int statusCode = status != null ? Integer.parseInt(status.toString()) : 500;
        String errorMessage = message != null ? message.toString() : "Unknown error";
        String uri = requestUri != null ? requestUri.toString() : "unknown";
        
        // Log the error for debugging
        System.err.println("Error " + statusCode + " for URI: " + uri + " - " + errorMessage);
        
        // Determine appropriate error message based on status code
        String responseMessage;
        switch (statusCode) {
            case 404:
                responseMessage = "Endpoint not found: " + uri;
                break;
            case 403:
                responseMessage = "Access forbidden: " + uri;
                break;
            case 401:
                responseMessage = "Unauthorized: " + uri;
                break;
            case 500:
                responseMessage = "Internal server error: " + errorMessage;
                break;
            default:
                responseMessage = "Error " + statusCode + ": " + errorMessage;
        }
        
        // Return JSON error response with negative status code in the response body
        ApiResponse<Object> apiResponse = new ApiResponse<>(-statusCode, null, responseMessage);
        HttpStatus httpStatus = HttpStatus.valueOf(statusCode);
        
        return ResponseEntity
                .status(httpStatus)
                .contentType(MediaType.APPLICATION_JSON)
                .body(apiResponse);
    }
}

