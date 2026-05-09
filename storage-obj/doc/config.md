## Config Convention

This config design avoids committing private local values into git while keeping local testing convenient. It uses a two-layer architecture: tracked default config in `config/config.js`, and gitignored local override config in `config/config.0.js`.

- `config/config.js` contains example/default values and is tracked.
- `config/config.0.js` contains real local values, is excluded by `.gitignore`.
- `config.js` should try importing `config.0.js` and override defaults when available.
- backend/frontend scripts can read from `config.js` (or mirrored environment variables).

### Override mechanism (`config.0.js` -> `config.js`)

`config.js` should export defaults first, then merge `config.0.js` when it exists.

Example pattern:

```javascript
// config/config.js
const baseConfig = {
  PORT: 7001,
  DB_HOST: '127.0.0.1',
  DB_PORT: 5432,
  DB_NAME: 'object_storage',
  DB_USER: 'postgres',
  DB_PASSWORD: 'postgres',
  DATABASE_LIST: [],
  DATABASE_INDEX: 0,
}

let localOverride = {}
try {
  localOverride = (await import('./config.0.js')).default || {}
} catch {
  localOverride = {}
}

const mergedConfig = {
  ...baseConfig,
  ...localOverride,
}

mergedConfig.DATABASE_CURRENT =
  mergedConfig.DATABASE_LIST?.[mergedConfig.DATABASE_INDEX] || null

export default mergedConfig
```

```javascript
// config/config.0.js (gitignored local file)
export default {
  DB_HOST: '10.0.0.8',
  DB_NAME: 'object_storage_local',
  DATABASE_INDEX: 1,
}
```

Merge result behavior:
- keys not present in `config.0.js` keep defaults from `config.js`
- keys present in `config.0.js` override defaults
- callers always import from `config/config.js` only
