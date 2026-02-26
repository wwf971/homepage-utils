




┌─────────────────────────────────────────────────────┐
│                  mongoDocStore                      │
│  ┌────────────────────────────────────────────┐     │
│  │ docs: Map<docId, observableDocument>       │     │
│  │ - All MongoDB documents live here          │     │
│  │ - File access points included              │     │
│  └────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────┘
                         ▲
                         │ stores documents
                         │
┌─────────────────────────────────────────────────────┐
│                    fileStore                        │
│  ┌────────────────────────────────────────────┐     │
│  │ fileAccessPointIds: ['id1', 'id2', ...]    │     │
│  │ fileCache: { 'apId:fileId': fileData }     │     │
│  └────────────────────────────────────────────┘     │
│  get fileAccessPoints() {                           │
│    return ids.map(id => mongoDocStore.getDoc(id))   │
│  }                                                  │
└─────────────────────────────────────────────────────┘