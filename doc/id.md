id table structure in mysql database
```
+------------------+---------------+------+-----+---------+-------+
| Field            | Type          | Null | Key | Default | Extra |
+------------------+---------------+------+-----+---------+-------+
| value            | bigint        | NO   | PRI | NULL    |       |
| selfType         | tinyint       | NO   |     | NULL    |       |
| type             | varchar(256)  | YES  |     | NULL    |       |
| metadata         | varchar(1024) | YES  |     | NULL    |       |
| createAt         | bigint        | YES  |     | NULL    |       |
| createAtTimezone | int           | YES  |     | NULL    |       |
+------------------+---------------+------+-----+---------+-------+
```
## Table Columns

- **value** (BIGINT, PRIMARY KEY): The 64-bit unsigned ID value
- **selfType** (TINYINT): The ID generation method (0=random, 1=ms_48)
- **type** (VARCHAR(256)): User-defined type/category tag for the ID
- **metadata** (VARCHAR(1024)): Additional metadata or context (JSON, string, etc.)
- **createAt** (BIGINT): Timestamp when the ID was created (milliseconds since epoch)
- **createAtTimezone** (INT): Timezone offset when created (range: -12 to 12) 


## ID Types

There are two kinds of IDs: **random** and **time-based**.

### selfType Values

- **0: Random ID**
  - A randomly generated 64-bit unsigned integer
  - Provides good uniqueness with no time dependency
  - Suitable for distributed systems where coordination is difficult

- **1: ms_48 (Time-based ID)**
  - Timestamp-based ID with 48-bit millisecond timestamp + 16-bit offset
  - **High 48 bits**: Milliseconds since epoch (allows timestamps until year 8921)
  - **Low 16 bits**: Offset/counter (allows up to 65,536 IDs per millisecond)

  - Scheme of ms_48 id:
```
#64-bit id based on unix time stamp
high |-------48bit------|---16bit---| low
high |---unix_stamp_ms--|---offset--| low
```

## ID Formats

Each ID (regardless of selfType) can be represented in multiple formats, all convertible to one another:

1. **64-bit Integer** - Native unsigned 64-bit integer value
2. **Base36 String** - Uses characters 0-9a-z (case-insensitive, compact)
3. **Base64-like String** - Uses characters 0-9a-zA-Z_- (URL-safe, shorter)
4. **Hex String** - Uses characters 0-9a-f (traditional hexadecimal)

**Important**: When working with Java's signed `long`, use `Long.compareUnsigned()` and `Long.toUnsignedString()` to properly handle the most significant bit.

## API Endpoints

### Configuration & Table Management

GET    /id/config/app/                                      - Get application default config
GET    /id/config/                                          - Get computed config (merged layers)
POST   /id/config/set/                                      - Update local config override
GET    /id/table/check/                                     - Check if ID table exists
GET    /id/table/structure/                                 - Get table structure and validation
POST   /id/table/create/                                    - Create ID table
POST   /id/table/delete/                                    - Delete ID table
POST   /id/table/recreate/                                  - Delete and recreate ID table

### ID Operations

POST   /id/issue/random                                     - Issue new random ID
POST   /id/issue/ms48                                       - Issue new timestamp-based ID (ms_48)
GET    /id/get/{value}                                      - Get ID by value (supports integer/string formats)
GET    /id/list                                             - List all IDs with pagination
POST   /id/search                                           - Search IDs by filters (type, dateRange, selfType)
POST   /id/search/substring                                 - Search IDs by base36 substring (0-9a-z)
PUT    /id/{value}/metadata                                 - Update ID metadata
DELETE /id/{value}                                          - Delete ID by value
GET    /id/convert/{value}/{format}                         - Convert ID to different format (int/base36/base64/hex)
