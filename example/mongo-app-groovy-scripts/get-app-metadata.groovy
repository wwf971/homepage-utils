// Get the current app's metadata
def result = backendApis.getAppInfo()

if (result.code == 0) {
    return [
        code: 0,
        data: result.data,
        message: "App metadata retrieved successfully"
    ]
} else {
    return [
        code: result.code,
        data: null,
        message: "Failed to get app metadata: ${result.message}".toString()
    ]
}
