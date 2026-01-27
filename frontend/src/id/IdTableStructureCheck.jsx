import React, { useState } from 'react';
import { SpinningCircle } from '@wwf971/react-comp-misc';
import { checkIdTableStructure } from '../remote/dataStore';
import Subpanel from '../components/Subpanel';
import '../styles/common.css';

const IdTableStructureCheck = () => {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);

  const handleCheck = async () => {
    setChecking(true);
    setResult(null);
    
    try {
      const response = await checkIdTableStructure();
      
      if (response.code === 0 || response.code === -1 || response.code === -2) {
        setResult(response.data);
      } else {
        setResult({
          exists: false,
          message: response.message || 'Unknown error'
        });
      }
    } catch (error) {
      setResult({
        exists: false,
        message: `Failed to check table structure: ${error.message}`
      });
    } finally {
      setChecking(false);
    }
  };

  return (
    <Subpanel title="Table Structure Check" defaultExpanded={false}>
        <p className="config-hint">
          Check table structure, validate required columns, and view row count.
        </p>
        
        <button 
          onClick={handleCheck} 
          disabled={checking}
          style={{
            padding: '6px 8px',
            backgroundColor: checking ? '#ccc' : '#28a745',
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
            'Check Structure'
          )}
        </button>
        
        {result && (
          <div style={{ marginTop: '6px' }}>
            {!result.exists ? (
              <div 
                style={{ 
                  padding: '6px 8px',
                  backgroundColor: '#fee',
                  border: '1px solid #fcc',
                  borderRadius: '4px',
                  color: '#c33'
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>
                  Table Not Found
                </div>
                <div style={{ fontSize: '13px' }}>
                  {result.message}
                </div>
              </div>
            ) : (
              <div>
                <div 
                  style={{ 
                    padding: '6px 8px',
                    backgroundColor: result.hasValidStructure ? '#e7f5e7' : '#fff3cd',
                    border: `1px solid ${result.hasValidStructure ? '#c3e6c3' : '#ffc107'}`,
                    borderRadius: '4px',
                    color: result.hasValidStructure ? '#2d662d' : '#856404',
                    marginBottom: '6px'
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>
                    {result.hasValidStructure ? 'Valid Structure' : 'Structure Issues Detected'}
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
                  
                  {result.rowCount !== null && result.rowCount !== undefined && (
                    <div style={{ fontSize: '13px', marginBottom: '4px' }}>
                      <strong>Row Count:</strong> {result.rowCount.toLocaleString()}
                    </div>
                  )}
                </div>

                {result.structureIssues && result.structureIssues.length > 0 && (
                  <div 
                    style={{ 
                      padding: '6px 8px',
                      backgroundColor: '#fee',
                      border: '1px solid #fcc',
                      borderRadius: '4px',
                      color: '#c33',
                      marginBottom: '6px'
                    }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>
                      Structure Issues:
                    </div>
                    <ul style={{ margin: '6px 0', paddingLeft: '20px', fontSize: '13px' }}>
                      {result.structureIssues.map((issue, idx) => (
                        <li key={idx} style={{ marginBottom: '4px' }}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.columns && result.columns.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>
                      Table Columns ({result.columns.length}):
                    </div>
                    <div style={{ 
                      border: '1px solid #ddd', 
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <table style={{ 
                        width: '100%', 
                        borderCollapse: 'collapse',
                        fontSize: '13px'
                      }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f5f5f5' }}>
                            <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Column Name</th>
                            <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Data Type</th>
                            <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Nullable</th>
                            <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Key</th>
                            <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Default</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.columns.map((col, idx) => (
                            <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f9f9f9' }}>
                              <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{col.columnName}</td>
                              <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{col.columnType}</td>
                              <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                                {col.isNullable ? 'YES' : 'NO'}
                              </td>
                              <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{col.columnKey || '-'}</td>
                              <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{col.columnDefault || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
    </Subpanel>
  );
};

export default IdTableStructureCheck;
