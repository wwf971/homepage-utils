All local config (server, MongoDB, Elasticsearch, Redis, JDBC, RabbitMQ) is stored in one single sqlite table. Config belonging to different services are differentiated by the category value.

Table strucutre:
```
CREATE TABLE IF NOT EXISTS config (
    config_key TEXT PRIMARY KEY,
    config_value TEXT NOT NULL,
    category TEXT NOT NULL,
    time_updated INTEGER NOT NULL
)
```
- `time_updated`: unix time stamp in millisecond.

Data example:
```
config_key         | config_value           | category       | time_updated
-------------------|------------------------|----------------|-------------
serverName         | Production Server      | backend        | 1737123456789
serverId           | prod01                 | backend        | 1737123456789
mongo.host         | mongodb.example.com    | mongo          | 1737123456790
mongo.port         | 27017                  | mongo          | 1737123456790
elasticsearch.url  | http://localhost:9200  | elasticsearch  | 1737123456791
redis.host         | localhost              | redis          | 1737123456792
```

