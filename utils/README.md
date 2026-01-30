# @wwf971/spring-learn-utils

Utility components for configuring and testing backend server connections.

## Installation

In a pnpm workspace, add to your project:

```bash
pnpm add '@wwf971/spring-learn-utils@workspace:*'
```

## Usage

```jsx
import { 
  BackendServerConfig, 
  BackendServerTestConnection,
  backendServerStore 
} from '@wwf971/spring-learn-utils'
import '@wwf971/spring-learn-utils/dist/spring-learn-utils.css'

function App() {
  return (
    <div>
      <BackendServerConfig />
      <BackendServerTestConnection />
    </div>
  )
}
```

## Components

### BackendServerConfig
Allows users to view and edit the backend server URL. The URL is persisted in localStorage.

### BackendServerTestConnection
Tests the connection to the backend server by calling the `/actuator/health` endpoint.

### backendServerStore
MobX store that manages:
- `url` - Backend server URL
- `isTesting` - Testing state
- `testResult` - Test result object
- `testConnection(url?)` - Method to test connection
- `setUrl(newUrl)` - Method to update URL

## Backend Requirements

The backend server should have a health check endpoint:
- `GET /actuator/health` - Returns `{ status: 'UP' }` when healthy

## Development

```bash
# Install dependencies
pnpm install

# Run dev server
pnpm dev

# Build library
pnpm build
```
