

1. App Registration:
  - Apps register with a name and receive a unique random app ID (16 chars: 0-9, a-z)
  - Each app gets a dedicated Elasticsearch index: {appId}_index_default
  - App metadata stored in mongo-app.__app__ collection

2. Collection Management:
  - Apps can create collections: {appId}_{collectionName} in mongo-app database
  - Collections are automatically added to the app's ES index
  - Apps can list their collections

3. Document Management:
  - Document IDs are auto-generated (16 chars: 0-9, a-z) if not provided
  - If docId is provided and already exists, creation is rejected with error
  - Documents include createdAt (Unix timestamp ms) and createdAtTimezone fields

mongo-app (database)
├── apps (collection)                    # App metadata
│   ├── appId (unique)
│   ├── appName
│   ├── esIndex
│   ├── collections []
│   └── createdAt
│
└── {appId}_{collectionName}             # App collections
    └── Documents with custom 'id' field

## API Endpoints

POST   /mongo-app/create                                            - Initialize app
GET    /mongo-app/list                                              - List all mongo apps
GET    /mongo-app/get-id/{appName}                                  - Get app IDs by name
GET    /mongo-app/{appId}/config                                    - Get app info
POST   /mongo-app/{appId}/coll/create                               - Create collection
GET    /mongo-app/{appId}/coll/list                                 - List collections
GET    /mongo-app/{appId}/coll/exists/{collName}                    - Check if collection exists
DELETE /mongo-app/{appId}/delete                                    - Delete app
POST   /mongo-app/{appId}/coll/{collName}/doc/create                - Create document
PUT    /mongo-app/{appId}/coll/{collName}/doc/{docId}/update        - Update document
GET    /mongo-app/{appId}/coll/{collName}/doc/{docId}/get           - Get document
DELETE /mongo-app/{appId}/coll/{collName}/doc/{docId}/delete        - Delete document
GET    /mongo-app/{appId}/coll/{collName}/doc/list                  - List all documents