import { MongoAppStore } from '@wwf971/homepage-utils-utils'
import { getBackendServerUrl } from '../remote/backendServerStore'

export const mongoAppStore = new MongoAppStore({ backendUrlDefault: getBackendServerUrl() })
