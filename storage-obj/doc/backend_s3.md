# AWS S3 Backend

An AWS S3 storage endpoint stores the same spaces, objects, metadata, and object version trees as a PostgreSQL endpoint. S3 bucket versioning is not required. The service creates and manages its own version objects.

`path_prefix` is the root of this service inside a bucket. S3 keys do not start with `/`.

## Key Layout

```text
{pathPrefix}/
  __metadata__/
    items/{tagEncoded}.json
    spaces.json

  {spaceId}/
    __metadata__/
      items/{tagEncoded}.json

    {dataType}/
      {objectId}/
        __status__.json
        __metadata__/
          items/{tagEncoded}.json
        current/
          data
          info.json
        versions/
          {versionId}/
            data
            info.json
```

- `dataType` is `text`, `bytes`, or `json`.
- `tagEncoded` is one URL-encoded UTF-8 path segment.
- Metadata item files contain `tag`, `rank`, `valueType`, and the applicable value field.
- `__status__.json` contains `versionIdHead`, `isDeleted`, `type`, `editType`, and update time.
- `current/data` contains the checked-out object data.
- `current/info.json` identifies the current version and records its timestamps.
- `versions/{versionId}/data` contains one version's object data.
- `versions/{versionId}/info.json` contains `versionId`, `versionIdPrev`, `isDataDeleted`, timestamps, and change information.

Metadata rank stays inside each metadata item file. Changing rank updates one file and does not require renaming S3 keys.

## Object Workflows

```text
create
  -> write immutable version data and info
  -> write current data and info
  -> create status with HEAD at the new version

update with a new version
  -> write new immutable version with versionIdPrev = current HEAD
  -> replace current data and info
  -> move status HEAD

checkout
  -> read target version
  -> replace current data and info
  -> move status HEAD

soft delete
  -> set status isDeleted = true
  -> remove current data and info
  -> keep all version entries

restore
  -> read the HEAD version
  -> recreate current data and info
  -> set status isDeleted = false

release version data
  -> remove the version data key
  -> keep version info and set isDataDeleted = true
```

## Consistency

S3 provides strong read-after-write and list consistency, but it does not provide a transaction across multiple keys.

- New version IDs use the service `ms_48` ID generator. S3 listing is not used to allocate IDs.
- Creating new version data uses a create-only write.
- An update changes several S3 keys. These writes are not one atomic transaction.
- Concurrent status updates use last-write-wins behavior.
- PostgreSQL batch transaction semantics cannot be guaranteed by S3 alone. S3 endpoints reject batch transaction requests.

## Access Test

`POST /api/config/storage-endpoint/test` checks one selected S3 endpoint:

```text
write {pathPrefix}/__test__/read-write/{randomId}.txt
  -> read it
  -> compare its content
  -> delete it
```

The response does not expose AWS credentials. A cleanup failure is reported as a failed test.

## Configuration

```yaml
storage_endpoints:
  s3_aws_note:
    label: AWS S3
    type: s3_aws
    bucket_name: example-bucket
    region_name: ap-northeast-1
    access_key_id: ""
    secret_access_key: ""
    session_token: ""
    path_prefix: main-note
```

Credentials may be omitted when the backend receives credentials from an IAM role or the standard AWS credential chain. Put real local values only in `config/config.0.yaml`.
