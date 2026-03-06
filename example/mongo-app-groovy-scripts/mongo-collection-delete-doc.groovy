// Delete one document from an app collection.
def collName = requestParams.collName
def docId = requestParams.docId

if (!collName || !docId) {
    return [
        code: -1,
        data: null,
        message: "Required params: collName, docId"
    ]
}

def result = backendApis.deleteDoc(collName, docId)

if (result.code == 0) {
    return [
        code: 0,
        data: result.data,
        message: "Deleted doc ${docId} from ${collName}".toString()
    ]
}

return [
    code: result.code,
    data: result.data,
    message: "Failed to delete doc: ${result.message}".toString()
]
