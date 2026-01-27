import React, { useState } from 'react';
import { SpinningCircle } from '@wwf971/react-comp-misc';
import { checkIdTable } from '../remote/dataStore';
import Subpanel from '../components/Subpanel';
import '../styles/common.css';

const IdTableCheck = () => {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);

  const handleCheck = async () => {
    setChecking(true);
    setResult(null);
    
    try {
      const response = await checkIdTable();
      
      if (response.code === 0) {
        setResult({
          success: true,
          exists: response.data.exists,
          databaseName: response.data.databaseName,
          tableName: response.data.tableName,
          message: response.data.message
        });
      } else {
        setResult({
          success: false,
          exists: response.data?.exists || false,
          databaseName: response.data?.databaseName || '',
          tableName: response.data?.tableName || '',
          message: response.message || response.data?.message || 'Unknown error'
        });
      }
    } catch (error) {
      setResult({
        success: false,
        exists: false,
        message: `Failed to check table: ${error.message}`
      });
    } finally {
      setChecking(false);
    }
  };

  return (
    <Subpanel title="Table Existence Check" defaultExpanded={false}>
        <p className="config-hint">
          Check if the ID service table exists in the configured database.
        </p>
        
        <button 
          onClick={handleCheck} 
          disabled={checking}
          style={{
            padding: '8px 16px',
            backgroundColor: checking ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: checking ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px'
          }}
        >
          {checking ? (
            <>
              <SpinningCircle width={16} height={16} color="white" />
              <span>Checking...</span>
            </>
          ) : (
            'Check Table'
          )}
        </button>
        
        {result && (
          <div 
            style={{ 
              marginTop: '6px',
              padding: '6px 8px',
              backgroundColor: result.exists ? '#e7f5e7' : '#fee',
              border: `1px solid ${result.exists ? '#c3e6c3' : '#fcc'}`,
              borderRadius: '4px',
              color: result.exists ? '#2d662d' : '#c33'
            }}
          >
            <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>
              {result.exists ? 'Table Exists' : 'Table Check Failed'}
            </div>
            
            {result.databaseName && (
              <div style={{ fontSize: '13px', marginBottom: '4px' }}>
                <strong>Database:</strong> {result.databaseName}
              </div>
            )}
            
            {result.tableName && (
              <div style={{ fontSize: '13px', marginBottom: '4px' }}>
                <strong>Table:</strong> {result.tableName}
              </div>
            )}
            
            <div style={{ fontSize: '13px', marginTop: '6px' }}>
              {result.message}
            </div>
          </div>
        )}
    </Subpanel>
  );
};

export default IdTableCheck;
