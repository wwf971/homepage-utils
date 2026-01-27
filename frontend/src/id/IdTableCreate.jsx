import React, { useState, useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { SpinningCircle } from '@wwf971/react-comp-misc';
import { idComputedConfigAtom, createIdTable, checkIdTable } from '../remote/dataStore';
import Subpanel from '../components/Subpanel';
import '../styles/common.css';

const IdTableCreate = () => {
  const [creating, setCreating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [tableExists, setTableExists] = useState(false);
  const [result, setResult] = useState(null);
  const computedConfig = useAtomValue(idComputedConfigAtom);
  
  const databaseName = computedConfig.find(c => c.key === 'databaseName')?.value || '';
  const tableName = computedConfig.find(c => c.key === 'tableName')?.value || '';

  useEffect(() => {
    checkTableExistence();
  }, [databaseName, tableName]);

  const checkTableExistence = async () => {
    if (!databaseName || !tableName) return;
    
    setChecking(true);
    try {
      const response = await checkIdTable();
      if (response.code === 0 && response.data) {
        setTableExists(response.data.exists);
      } else {
        setTableExists(false);
      }
    } catch (error) {
      setTableExists(false);
    } finally {
      setChecking(false);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    setResult(null);
    
    try {
      const response = await createIdTable();
      
      if (response.code === 0) {
        setResult({
          success: true,
          message: response.data.message || 'Table created successfully'
        });
        setTableExists(true);
      } else {
        setResult({
          success: false,
          message: response.message || response.data?.message || 'Failed to create table'
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: `Failed to create table: ${error.message}`
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Subpanel title="Create ID Table" defaultExpanded={false}>
        
        <p className="config-hint">
          Create the ID service table with standard structure in the configured database.
        </p>

        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '13px', marginBottom: '4px' }}>
            <strong>Database:</strong> {databaseName || '(not configured)'}
          </div>
          <div style={{ fontSize: '13px', marginBottom: '4px' }}>
            <strong>Table:</strong> {tableName || '(not configured)'}
          </div>
        </div>

        <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px', padding: '6px 8px', backgroundColor: '#f5f5f5', borderRadius: '3px' }}>
          <strong>Standard Structure:</strong>
          <div style={{ marginTop: '4px' }}>
            • value (BIGINT, PRIMARY KEY) - 64-bit ID<br/>
            • selfType (TINYINT) - 0=random, 1=ms_48<br/>
            • type (VARCHAR) - User-defined type<br/>
            • metadata (VARCHAR) - Additional metadata<br/>
            • createAt (BIGINT) - Timestamp in milliseconds<br/>
            • createAtTimezone (INT) - Timezone (-12 to 12)
          </div>
        </div>
        
        <button 
          onClick={handleCreate} 
          disabled={creating || checking || tableExists || !databaseName || !tableName}
          style={{
            padding: '6px 8px',
            backgroundColor: (creating || checking || tableExists || !databaseName || !tableName) ? '#ccc' : '#17a2b8',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: (creating || checking || tableExists || !databaseName || !tableName) ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px'
          }}
        >
          {creating ? (
            <>
              <SpinningCircle width={16} height={16} color="white" />
              <span>Creating...</span>
            </>
          ) : checking ? (
            'Checking...'
          ) : tableExists ? (
            'Table Already Exists'
          ) : (
            'Create Table'
          )}
        </button>
        
        {result && (
          <div 
            style={{ 
              marginTop: '6px',
              padding: '6px 8px',
              backgroundColor: result.success ? '#e7f5e7' : '#fee',
              border: `1px solid ${result.success ? '#c3e6c3' : '#fcc'}`,
              borderRadius: '4px',
              color: result.success ? '#2d662d' : '#c33'
            }}
          >
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
              {result.success ? 'Success' : 'Failed'}
            </div>
            <div style={{ fontSize: '13px' }}>
              {result.message}
            </div>
          </div>
        )}
    </Subpanel>
  );
};

export default IdTableCreate;
