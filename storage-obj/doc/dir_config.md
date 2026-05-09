## Directory Structure

`ddl` means Data Definition Language: SQL files that define and evolve table structures.

```text
storage-obj/
  .gitignore

  README.md
  doc-recover.txt

  doc/
    api.md
    backend.md
    config.md
    database.md
    dir_config.md
    docker.md
    guidance_db_update.md
    id.md
    object_version.md
    route.md
    space.md

  config/
    config.js
    config.0.js

  backend/
    __pycache__/
    app.py
    requirements.txt
    utils.py

  frontend/
    eslint.config.js
    index.html
    package.json
    pnpm-lock.yaml
    public/
      favicon.svg
      icons.svg
    src/
      App.tsx
      App.css
      ResourceTree.tsx
      index.css
      main.tsx
      assets/
        hero.png
      service/
        ServiceInfo.tsx
        service.css
      space/
        SpaceInfo.tsx
        space.css
      store/
        appStore.ts
        serviceStore.ts
        spaceStore.ts
      types/
        react-comp-misc.d.ts
    tsconfig.app.json
    tsconfig.json
    tsconfig.node.json
    vite.config.ts

  database/
    init_db.sql
    init_data_example.sql

  build/
    index.html
    favicon.svg
    icons.svg
    assets/
      index-*.css
      index-*.js

  script/
    launch-test.sh
```

