// List Elasticsearch indices available to the current app.
def result = backendApis.listAllEsIndices()

if (result.code == 0) {
    def indices = result.data ?: []
    return [
        code: 0,
        data: [
            count: indices.size(),
            indices: indices
        ],
        message: "Successfully listed ${indices.size()} ES index(es)".toString()
    ]
}

return [
    code: result.code,
    data: null,
    message: "Failed to list ES indices: ${result.message}".toString()
]
