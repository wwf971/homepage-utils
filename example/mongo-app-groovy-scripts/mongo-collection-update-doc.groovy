// Update one document in an app collection.
def collName = requestParams.collName
def docId = requestParams.docId
def updates = requestParams.updates
def shouldUpdateIndex = requestParams.shouldUpdateIndex

if (!collName || !docId || !(updates instanceof Map)) {
    return [
        code: -1,
        data: null,
        message: "Required params: collName (String), docId (String), updates (Map)"
    ]
}

def result
if (shouldUpdateIndex == null) {
    result = backendApis.updateDoc(collName, docId, updates)
} else {
    result = backendApis.updateDoc(collName, docId, updates, shouldUpdateIndex as Boolean)
}

if (result.code == 0) {
    return [
        code: 0,
        data: result.data,
        message: "Updated doc ${docId} in ${collName}".toString()
    ]
}

return [
    code: result.code,
    data: result.data,
    message: "Failed to update doc: ${result.message}".toString()
]
