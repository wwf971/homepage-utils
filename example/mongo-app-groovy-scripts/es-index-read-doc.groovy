// Read a document and include current app ES index info.
def collName = requestParams.collName
def docId = requestParams.docId

if (!collName || !docId) {
    return [
        code: -1,
        data: null,
        message: "Required params: collName, docId"
    ]
}

def getResult = backendApis.getDoc(collName, docId)
if (getResult.code != 0) {
    return [
        code: getResult.code,
        data: null,
        message: "Failed to read doc: ${getResult.message}".toString()
    ]
}

def indicesResult = backendApis.listAllEsIndices()
return [
    code: 0,
    data: [
        doc: getResult.data,
        esIndices: indicesResult.code == 0 ? indicesResult.data : []
    ],
    message: "Fetched doc ${docId} with ES index context".toString()
]
