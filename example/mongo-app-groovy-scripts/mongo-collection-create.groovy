// Create a new MongoDB collection for the current app.
def collName = requestParams.collName

if (!collName) {
    return [
        code: -1,
        data: null,
        message: "Missing required parameter: collName"
    ]
}

def result = backendApis.createCollection(collName)

if (result.code == 0) {
    return [
        code: 0,
        data: result.data,
        message: "Collection created: ${collName}".toString()
    ]
}

return [
    code: result.code,
    data: result.data,
    message: "Failed to create collection: ${result.message}".toString()
]
