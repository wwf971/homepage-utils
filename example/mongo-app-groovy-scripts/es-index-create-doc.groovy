// Create a document and update ES index for searchable fields.
def collName = requestParams.collName
def docId = requestParams.docId
def content = requestParams.content

if (!collName || !docId || !(content instanceof Map)) {
    return [
        code: -1,
        data: null,
        message: "Required params: collName (String), docId (String), content (Map)"
    ]
}

def createResult = backendApis.createDoc(collName, docId, content, true)
if (createResult.code != 0) {
    return [
        code: createResult.code,
        data: createResult.data,
        message: "Failed to create doc: ${createResult.message}".toString()
    ]
}

def indicesResult = backendApis.listAllEsIndices()
return [
    code: 0,
    data: [
        createResult: createResult.data,
        esIndices: indicesResult.code == 0 ? indicesResult.data : []
    ],
    message: "Created doc ${docId} and requested ES index update".toString()
]
