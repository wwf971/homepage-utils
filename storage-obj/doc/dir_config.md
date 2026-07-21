# Directory Structure

```text
storage-obj/
  README.md

  config/
    config.yaml
    config.0.yaml

  backend/
    app.py
    service.py
    space.py
    object.py
    obj_metadata.py
    s3_utils.py
    config_loader.py

  frontend/src/
    App.tsx
    ResourceTree.tsx
    ResourcePanel.tsx
    storage-endpoint/
    service/
    space/
    object/
    store/

  doc/
    storage-obj.md
    storage_endpoint.md
    backend_s3.md
    space.md
    object.md
    object_metadata.md
    obj_version.md
    api.md
    config.md
    backend.md
    database.md
    id.md

  database/
    init_db.sql
    init_data_example.sql

  script/
    launch-test.sh
```

- `config/config.yaml` contains tracked defaults.
- `config/config.0.yaml` contains local overrides and credentials.
- `backend/s3_utils.py` centralizes AWS S3 operations.
- `build/` contains generated frontend output.

