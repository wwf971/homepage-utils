# Elasticsearch Index Management

## Overview

This service provides REST APIs for managing Elasticsearch indices, documents, and search operations.

## API Endpoints

### Configuration

POST   /elasticsearch/test/                                            - Test Elasticsearch connection
GET    /elasticsearch/config/app/                                      - Get application.properties config
GET    /elasticsearch/config/                                          - Get current config
POST   /elasticsearch/config/set/                                      - Update config

### Index Management

POST   /elasticsearch/indices/create                                   - Create index
GET    /elasticsearch/indices/list                                     - List all indices
GET    /elasticsearch/indices/{indexName}                              - Get index information
GET    /elasticsearch/indices/{indexName}/settings/                    - Get index settings
POST   /elasticsearch/indices/{indexName}/meta/                        - Update index metadata
DELETE /elasticsearch/indices/{indexName}/delete                       - Delete index
POST   /elasticsearch/indices/{indexName}/rename/                      - Rename index

### Document Operations

GET    /elasticsearch/indices/{indexName}/docs/                        - Get documents (paginated)
POST   /elasticsearch/indices/{indexName}/docs/create                  - Create document
PUT    /elasticsearch/indices/{indexName}/docs/{docId}/update          - Update document
DELETE /elasticsearch/indices/{indexName}/docs/{docId}/delete         - Delete document
POST   /elasticsearch/indices/{indexName}/search/                      - Search documents
