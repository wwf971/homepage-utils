## Config Convention

This config design avoids committing private local values into git while keeping local testing convenient. It uses a two-layer architecture: tracked default config in `config/config.yaml`, and gitignored local override config in `config/config.0.yaml`.

- `config/config.yaml` contains example/default values and is tracked.
- `config/config.0.yaml` contains real local values, is excluded by `.gitignore`.
- `backend/config_loader.py` loads `config.yaml` first, then deep-merges `config.0.yaml` when it exists.
- backend and launch scripts read merged config through `config_loader.py` (or mirrored environment variables).

### Override mechanism (`config.0.yaml` -> `config.yaml`)

`config_loader.py` loads defaults first, then merges `config.0.yaml` when it exists.

Example pattern:

```yaml
# config/config.yaml
dir_base: "."
backend_port: 5107
test_conda_env: ""
database_index: 0

config_dbs:
  local:
    label: local
    host: 127.0.0.1
    port: 5432
    database_name: postgres
    username: postgres
    password: postgres
```

```yaml
# config/config.0.yaml (gitignored local file)
database_index: 1

config_dbs:
  raspi5-ubuntu:
    label: raspi5-ubuntu
    host: 192.168.1.32
    port: 5432
    database_name: app_db
    username: wwf194
    password: example_password
```

Merge result behavior:
- keys not present in `config.0.yaml` keep defaults from `config.yaml`
- keys present in `config.0.yaml` override defaults (nested dicts are deep-merged)
- `config_dbs` preset order follows keys in `config.0.yaml` first, then keys only in `config.yaml`
- optional `database_preset_order` in either file can set explicit preset order
- callers use `load_project_config()` or `resolve_launch_config()` only

## Storage Endpoints

`storage_endpoints` defines the available object storage backends.

```yaml
storage_endpoints:
  postgres_local:
    label: PostgreSQL local
    type: from_config_dbs
    config_db_name: local
    is_default: true

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

- the map key is the storage endpoint key used by APIs
- exactly one endpoint has `is_default: true`
- `from_config_dbs` reads PostgreSQL connection values from `config_dbs`
- `s3_aws` contains one S3 bucket connection
- `bucket_name` is required for S3 operations.
- `region_name` should match the bucket region.
- `path_prefix` is normalized without leading or trailing `/`.
- explicit credentials are optional when an IAM role or the standard AWS credential chain is available.
- real credentials belong only in gitignored `config/config.0.yaml`.

Nested endpoint fields are deep-merged between the tracked and local config layers. Using the same endpoint key in both files overrides only the specified local fields.

Refer to [storage_endpoint.md](./storage_endpoint.md) for endpoint behavior.
