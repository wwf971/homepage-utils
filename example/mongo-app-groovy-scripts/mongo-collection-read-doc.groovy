// Read one document from an app collection by docId.
def collName = requestParams.collName
def docId = requestParams.docId

if (!collName || !docId) {
    return [
        code: -1,
        data: null,
        message: "Required params: collName, docId"
    ]
}

def result = backendApis.getDoc(collName, docId)

if (result.code == 0) {
    return [
        code: 0,
        data: result.data,
        message: "Fetched doc ${docId} from ${collName}".toString()
    ]
}

return [
    code: result.code,
    data: null,
    message: "Failed to read doc: ${result.message}".toString()
]
