import React, { useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { SpinningCircle, RefreshIcon } from '@wwf971/react-comp-misc';
import { 
  mongoDbsAtom, 
  mongoDbSelectedAtom,
  fetchMongoDatabases 
} from '../remote/dataStore';
import './mongo.css';

/**
 * DbListAll - Component for listing all databases in MongoDB
 */
const DbListAll = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const databases = useAtomValue(mongoDbsAtom);
  const selectedDatabase = useAtomValue(mongoDbSelectedAtom);
  const setDatabases = useSetAtom(mongoDbsAtom);
  const setSelectedDatabase = useSetAtom(mongoDbSelectedAtom);

  // Auto-fetch databases when test succeeds
  React.useEffect(() => {
    const handleTestSuccess = () => {
      loadDatabases();
    };
    
    window.addEventListener('mongo-test-success', handleTestSuccess);
    return () => window.removeEventListener('mongo-test-success', handleTestSuccess);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDatabases = async () => {
    // Clear previous databases and show spinner
    setDatabases([]);
    setLoading(true);
    setError(null);

    const result = await fetchMongoDatabases();
    
    if (result.code === 0) {
      setDatabases(result.data);
    } else {
      setError(result.message);
    }
    
    setLoading(false);
  };

  const handleDatabaseClick = (databaseName) => {
    setSelectedDatabase(databaseName);
  };

  return (
    <div className="mongo-databases-section" style={{ marginTop: '12px' }}>
      <div className="mongo-section-header">
        <div className="section-title">MongoDB Databases</div>
        <button 
          onClick={loadDatabases}
          disabled={loading}
          className="mongo-refresh-button"
        >
          <RefreshIcon width={16} height={16} />
        </button>
      </div>

      {error && (
        <div className="test-result error" style={{ marginTop: '2px' }}>
          <strong>✗ Error</strong>
          <div className="result-message">{error}</div>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
          <SpinningCircle width={16} height={16} color="#666" />
          <span>Loading databases...</span>
        </div>
      )}

      {!loading && Array.isArray(databases) && databases.length > 0 && (
        <div style={{ marginTop: '2px' }}>
          <h4 style={{ marginBottom: '2px' }}>
            Found {databases.length} database{databases.length !== 1 ? 's' : ''}:
          </h4>
          <div className="mongo-tags-container">
            {databases.map((db, index) => (
              <span 
                key={index} 
                className={`mongo-tag mongo-tag-clickable ${selectedDatabase === db ? 'mongo-tag-selected' : ''}`}
                onClick={() => handleDatabaseClick(db)}
              >
                {db}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DbListAll;

