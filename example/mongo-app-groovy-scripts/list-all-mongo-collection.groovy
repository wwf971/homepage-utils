// List all MongoDB collections for this app
def result = backendApis.listAllCollections()

if (result.code == 0) {
    def collections = result.data
    return [
        code: 0,
        data: [
            count: collections.size(),
            collections: collections
        ],
        message: "Successfully listed ${collections.size()} MongoDB collection(s)".toString()
    ]
} else {
    return [
        code: result.code,
        data: null,
        message: "Failed to list collections: ${result.message}".toString()
    ]
}
