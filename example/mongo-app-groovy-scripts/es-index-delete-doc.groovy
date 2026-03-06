// Delete a document. Backend handles index cleanup for indexed documents.
def collName = requestParams.collName
def docId = requestParams.docId

if (!collName || !docId) {
    return [
        code: -1,
        data: null,
        message: "Required params: collName, docId"
    ]
}

def deleteResult = backendApis.deleteDoc(collName, docId)
if (deleteResult.code != 0) {
    return [
        code: deleteResult.code,
        data: deleteResult.data,
        message: "Failed to delete doc: ${deleteResult.message}".toString()
    ]
}

def indicesResult = backendApis.listAllEsIndices()
return [
    code: 0,
    data: [
        deleteResult: deleteResult.data,
        esIndices: indicesResult.code == 0 ? indicesResult.data : []
    ],
    message: "Deleted doc ${docId}; index cleanup should be applied by backend".toString()
]
