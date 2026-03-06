// List all collections for the current app.
// Optional: pass collName to also run collectionExists(collName).
def collName = requestParams.collName
def listResult = backendApis.listAllCollections()

if (listResult.code != 0) {
    return [
        code: listResult.code,
        data: null,
        message: "Failed to list collections: ${listResult.message}".toString()
    ]
}

def collections = listResult.data ?: []
def data = [
    count: collections.size(),
    collections: collections
]

if (collName) {
    def existsResult = backendApis.collectionExists(collName)
    if (existsResult.code == 0) {
        data.requestedCollection = collName
        data.existsResult = existsResult.data
    } else {
        data.requestedCollection = collName
        data.existsCheckError = existsResult.message
    }
}

return [
    code: 0,
    data: data,
    message: "Successfully listed ${collections.size()} collection(s)".toString()
]
