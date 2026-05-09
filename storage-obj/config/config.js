const DATABASE_LOCAL = {
  IP: '127.0.0.1',
  PORT: 5432,
  DATABASE_NAME: 'postgres',
  USERNAME: 'postgres',
  PASSWORD: 'postgres',
}

const CONFIG_DEFAULT = {
  DIR_BASE: '.',
  BACKEND_PORT: 5107,
  DATABASE_LIST: [DATABASE_LOCAL],
  DATABASE_INDEX: 0,
  TEST_CONDA_ENV: '',
}

let configLocal = {}
try {
  const moduleLocal = await import('./config.0.js')
  configLocal = moduleLocal.default ?? {}
} catch (_error) {}

const configWithDefault = {
  ...CONFIG_DEFAULT,
  ...configLocal,
}

const databaseListFromConfig = Array.isArray(configWithDefault.DATABASE_LIST)
  ? configWithDefault.DATABASE_LIST.filter((item) => item && typeof item === 'object')
  : []

const DATABASE_LIST = databaseListFromConfig.length > 0
  ? databaseListFromConfig
  : [...CONFIG_DEFAULT.DATABASE_LIST]

const databaseIndexRaw = Number(configWithDefault.DATABASE_INDEX ?? 0)
const isDatabaseIndexValid = Number.isInteger(databaseIndexRaw) && databaseIndexRaw >= 0 && databaseIndexRaw < DATABASE_LIST.length
const DATABASE_INDEX = isDatabaseIndexValid ? databaseIndexRaw : 0

const DATABASE_CURRENT = DATABASE_LIST[DATABASE_INDEX] ?? DATABASE_LIST[0]

const CONFIG = {
  ...configWithDefault,
  DATABASE_LIST,
  DATABASE_INDEX,
  DATABASE_CURRENT,
  DB_HOST: DATABASE_CURRENT.IP,
  DB_PORT: DATABASE_CURRENT.PORT,
  DB_NAME: DATABASE_CURRENT.DATABASE_NAME,
  DB_USER: DATABASE_CURRENT.USERNAME,
  DB_PASSWORD: DATABASE_CURRENT.PASSWORD,
}

export default CONFIG
