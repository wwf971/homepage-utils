// List all Elasticsearch indices for this app
def result = backendApis.listAllEsIndices()

if (result.code == 0) {
    def indices = result.data
    return [
        code: 0,
        data: [
            count: indices.size(),
            indices: indices
        ],
        message: "Successfully listed ${indices.size()} Elasticsearch index(es)".toString()
    ]
} else {
    return [
        code: result.code,
        data: null,
        message: "Failed to list ES indices: ${result.message}".toString()
    ]
}
