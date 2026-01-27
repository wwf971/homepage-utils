import React, { useState, useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { SpinningCircle } from '@wwf971/react-comp-misc';
import { idComputedConfigAtom, deleteIdTable, recreateIdTable, checkIdTable } from '../remote/dataStore';
import Subpanel from '../components/Subpanel';
import '../styles/common.css';

const IdTableDeleteRecreate = () => {
  const [deleting, setDeleting] = useState(false);
  const [recreating, setRecreating] = useState(false);
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

  const handleDelete = async () => {
    setDeleting(true);
    setResult(null);
    
    try {
      const response = await deleteIdTable();
      
      if (response.code === 0) {
        setResult({
          success: true,
          message: response.data.message || 'Table deleted successfully'
        });
        setTableExists(false);
      } else {
        setResult({
          success: false,
          message: response.message || response.data?.message || 'Failed to delete table'
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: `Failed to delete table: ${error.message}`
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleRecreate = async () => {
    setRecreating(true);
    setResult(null);
    
    try {
      const response = await recreateIdTable();
      
      if (response.code === 0) {
        setResult({
          success: true,
          message: response.data.message || 'Table recreated successfully'
        });
        setTableExists(true);
      } else {
        setResult({
          success: false,
          message: response.message || response.data?.message || 'Failed to recreate table'
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: `Failed to recreate table: ${error.message}`
      });
    } finally {
      setRecreating(false);
    }
  };

  return (
    <Subpanel title="Delete/Recreate Table" defaultExpanded={false}>
      <p className="config-hint">
        Delete or recreate the ID service table. Recreate will drop and create with standard structure.
      </p>

      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '13px', marginBottom: '4px' }}>
          <strong>Database:</strong> {databaseName || '(not configured)'}
        </div>
        <div style={{ fontSize: '13px', marginBottom: '4px' }}>
          <strong>Table:</strong> {tableName || '(not configured)'}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <button 
          onClick={handleDelete} 
          disabled={deleting || recreating || checking || !tableExists || !databaseName || !tableName}
          style={{
            padding: '6px 8px',
            backgroundColor: (deleting || recreating || checking || !tableExists || !databaseName || !tableName) ? '#ccc' : '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: (deleting || recreating || checking || !tableExists || !databaseName || !tableName) ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px'
          }}
        >
          {deleting ? (
            <>
              <SpinningCircle width={16} height={16} color="white" />
              <span>Deleting...</span>
            </>
          ) : checking ? (
            'Checking...'
          ) : !tableExists ? (
            'No Table to Delete'
          ) : (
            'Delete Table'
          )}
        </button>

        <button 
          onClick={handleRecreate} 
          disabled={recreating || deleting || checking || !databaseName || !tableName}
          style={{
            padding: '6px 8px',
            backgroundColor: (recreating || deleting || checking || !databaseName || !tableName) ? '#ccc' : '#ffc107',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: (recreating || deleting || checking || !databaseName || !tableName) ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px'
          }}
        >
          {recreating ? (
            <>
              <SpinningCircle width={16} height={16} color="white" />
              <span>Recreating...</span>
            </>
          ) : checking ? (
            'Checking...'
          ) : (
            'Recreate Table'
          )}
        </button>
      </div>

      <div style={{ fontSize: '12px', color: '#856404', marginBottom: '8px', padding: '6px 8px', backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '3px' }}>
        <strong>Warning:</strong> Delete and Recreate operations will permanently remove all data in the table.
      </div>
      
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

export default IdTableDeleteRecreate;
