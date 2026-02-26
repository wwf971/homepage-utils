import React from 'react';

const EndPointInput = ({ value, onChange, appId, serverUrl }) => {
  const endpointPath = `/mongo-app/${appId}/api/${value || '{endpoint_name}'}`;
  const fullUrl = `${serverUrl}${endpointPath}`;

  return (
    <div style={{ marginBottom: '12px' }}>
      <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', fontWeight: '500' }}>
        Endpoint Name:
      </label>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder="endpoint-name"
        style={{
          width: '100%',
          padding: '6px',
          fontSize: '12px',
          border: '1px solid #ddd',
          borderRadius: '4px'
        }}
      />
      <div style={{
        marginTop: '4px',
        fontSize: '11px',
        color: '#666',
        lineHeight: '1.4'
      }}>
        <div style={{ display: 'flex' }}>
          <span style={{ width: '90px', flexShrink: 0 }}>Relative path:</span>
          <span style={{ fontFamily: 'monospace' }}>{endpointPath}</span>
        </div>
        <div style={{ display: 'flex' }}>
          <span style={{ width: '90px', flexShrink: 0 }}>Full URL:</span>
          <span style={{ fontFamily: 'monospace' }}>{fullUrl}</span>
        </div>
      </div>
    </div>
  );
};

export default EndPointInput;
