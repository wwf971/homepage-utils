// Check whether a specific ES index exists.
// Note: backend implementation currently returns a placeholder response.
def indexName = requestParams.indexName

if (!indexName) {
    return [
        code: -1,
        data: null,
        message: "Missing required parameter: indexName"
    ]
}

def result = backendApis.indexExists(indexName)

if (result.code == 0) {
    return [
        code: 0,
        data: result.data,
        message: "Checked index: ${indexName}".toString()
    ]
}

return [
    code: result.code,
    data: null,
    message: "Failed to check index: ${result.message}".toString()
]
