// Create one document in an app collection.
def collName = requestParams.collName
def docId = requestParams.docId
def content = requestParams.content
def shouldUpdateIndex = requestParams.shouldUpdateIndex

if (!collName || !docId || !(content instanceof Map)) {
    return [
        code: -1,
        data: null,
        message: "Required params: collName (String), docId (String), content (Map)"
    ]
}

def result
if (shouldUpdateIndex == null) {
    result = backendApis.createDoc(collName, docId, content)
} else {
    result = backendApis.createDoc(collName, docId, content, shouldUpdateIndex as Boolean)
}

if (result.code == 0) {
    return [
        code: 0,
        data: result.data,
        message: "Created doc ${docId} in ${collName}".toString()
    ]
}

return [
    code: result.code,
    data: result.data,
    message: "Failed to create doc: ${result.message}".toString()
]
