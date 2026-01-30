import { BackendServerConfig, BackendServerTestConnection } from './backend-server'
import './App.css'

function App() {
  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '20px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>
        Backend Server Utils Demo
      </h1>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <BackendServerConfig />
        <BackendServerTestConnection />
      </div>
      </div>
  )
}

export default App
