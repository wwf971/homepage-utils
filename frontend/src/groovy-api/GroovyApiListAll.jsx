import React, { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import groovyApiStore from './groovyApiStore';
import GroovyApiCard from './GroovyApiCard';

const GroovyApiListAll = observer(({ refreshTrigger }) => {
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadScripts();
  }, [refreshTrigger]);

  const loadScripts = async () => {
    setMessage(null);
    const result = await groovyApiStore.fetchScripts(false);
    
    if (!result.success) {
      setMessage({ type: 'error', text: result.error });
    }
  };

  const forceRefresh = async () => {
    setMessage(null);
    const result = await groovyApiStore.reload();
    
    if (!result.success) {
      setMessage({ type: 'error', text: result.error });
    }
  };

  const handleDelete = (id) => {
    // Script is already removed from store by GroovyApiCard
    setMessage({ type: 'success', text: 'Script deleted successfully' });
  };

  return (
    <div style={{ padding: '6px 8px' }}>
      <button
        onClick={forceRefresh}
        disabled={groovyApiStore.loading}
        style={{
          padding: '6px 8px',
          marginBottom: '12px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          background: '#fff',
          cursor: groovyApiStore.loading ? 'not-allowed' : 'pointer'
        }}
      >
        {groovyApiStore.loading ? 'Loading...' : 'Refresh'}
      </button>

      {message && (
        <div style={{
          marginBottom: '12px',
          padding: '12px',
          background: message.type === 'error' ? '#fee' : '#efe',
          border: `1px solid ${message.type === 'error' ? '#fcc' : '#cfc'}`,
          borderRadius: '4px',
          color: message.type === 'error' ? '#c33' : '#363'
        }}>
          {message.text}
        </div>
      )}

      {groovyApiStore.scriptsArray.length === 0 ? (
        <div style={{ padding: '12px', color: '#666' }}>
          {groovyApiStore.loading ? 'Loading...' : 'No scripts uploaded yet'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {groovyApiStore.scriptsArray.map((script, index) => (
            <GroovyApiCard
              key={script.id}
              script={script}
              index={index}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export default GroovyApiListAll;
