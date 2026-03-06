// Example script that returns an error response
def action = requestParams.action ?: params.action

if (action == "success") {
    return [
        code: 0,
        data: [message: "Operation successful"],
        message: "Success"
    ]
} else if (action == "error") {
    // Return error in standard format
    return [
        code: -1,
        data: null,
        message: "Something went wrong"
    ]
} else if (action == "exception") {
    // Throw exception - will be caught and wrapped
    throw new Exception("Intentional exception for testing")
} else {
    return [
        code: -2,
        data: null,
        message: "Unknown action: ${action}".toString()
    ]
}