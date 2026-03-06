// Update a document and trigger ES reindexing.
def collName = requestParams.collName
def docId = requestParams.docId
def updates = requestParams.updates

if (!collName || !docId || !(updates instanceof Map)) {
    return [
        code: -1,
        data: null,
        message: "Required params: collName (String), docId (String), updates (Map)"
    ]
}

def updateResult = backendApis.updateDoc(collName, docId, updates, true)
if (updateResult.code != 0) {
    return [
        code: updateResult.code,
        data: updateResult.data,
        message: "Failed to update doc: ${updateResult.message}".toString()
    ]
}

def indicesResult = backendApis.listAllEsIndices()
return [
    code: 0,
    data: [
        updateResult: updateResult.data,
        esIndices: indicesResult.code == 0 ? indicesResult.data : []
    ],
    message: "Updated doc ${docId} and requested ES reindex".toString()
]
