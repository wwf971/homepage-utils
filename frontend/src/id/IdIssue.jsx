import React, { useState, useEffect } from 'react';
import { issueRandomId, issueMs48Id, convertId } from '../remote/dataStore';
import { formatTimestamp, extractTimestampMs } from './idUtils';
import '../styles/common.css';

const IdIssue = () => {
  const [idType, setIdType] = useState('random'); // 'random' or 'ms48'
  const [type, setType] = useState('');
  const [metadata, setMetadata] = useState('');
  const [useSystemTimezone, setUseSystemTimezone] = useState(true);
  const [timezoneOffset, setTimezoneOffset] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Get system timezone offset in hours
  const getSystemTimezoneOffset = () => {
    const offsetMinutes = -new Date().getTimezoneOffset();
    return Math.floor(offsetMinutes / 60);
  };

  // Update timezone when useSystemTimezone changes
  useEffect(() => {
    if (useSystemTimezone) {
      setTimezoneOffset(getSystemTimezoneOffset().toString());
    }
  }, [useSystemTimezone]);

  const handleIssue = async () => {
    setIssuing(true);
    setError(null);
    setResult(null);

    try {
      const request = {
        type: type || null,
        metadata: metadata || null,
        timezoneOffset: timezoneOffset ? parseInt(timezoneOffset) : null
      };

      let response;
      if (idType === 'random') {
        response = await issueRandomId(request);
      } else {
        response = await issueMs48Id(request);
      }

      if (response.success) {
        // Get conversion formats
        // Note: response.id.value is now a string to preserve precision
        const conversionResult = await convertId(response.id.value, 'all');
        setResult({
          ...response.id,
          conversions: conversionResult.success ? conversionResult.conversions : null
        });
      } else {
        setError(response.message || 'Failed to issue ID');
      }
    } catch (err) {
      setError(err.message || 'Unknown error');
    } finally {
      setIssuing(false);
    }
  };

  return (
    <div style={{ padding: '12px', paddingTop: '0px' }}>
      <div style={{ marginBottom: '12px' }}>
        <div style={{ marginBottom: '6px', fontSize: '13px', fontWeight: '500' }}>ID Type</div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="radio"
              value="random"
              checked={idType === 'random'}
              onChange={(e) => setIdType(e.target.value)}
              style={{ marginRight: '4px' }}
            />
            Random ID
          </label>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="radio"
              value="ms48"
              checked={idType === 'ms48'}
              onChange={(e) => setIdType(e.target.value)}
              style={{ marginRight: '4px' }}
            />
            ms_48 (Timestamp-based)
          </label>
        </div>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <div style={{ marginBottom: '4px', fontSize: '13px', fontWeight: '500' }}>Type (Optional)</div>
        <input
          type="text"
          value={type}
          onChange={(e) => setType(e.target.value)}
          placeholder="e.g., user, order, session"
          className="input-text"
          style={{ width: '100%', maxWidth: '400px' }}
        />
      </div>

      <div style={{ marginBottom: '12px' }}>
        <div style={{ marginBottom: '4px', fontSize: '13px', fontWeight: '500' }}>Metadata (Optional)</div>
        <textarea
          value={metadata}
          onChange={(e) => setMetadata(e.target.value)}
          placeholder="Additional metadata or JSON"
          className="input-text"
          style={{ width: '100%', maxWidth: '400px', minHeight: '60px', fontFamily: 'monospace' }}
        />
      </div>

      <div style={{ marginBottom: '12px' }}>
        <div style={{ marginBottom: '4px', fontSize: '13px', fontWeight: '500' }}>Timezone Offset (Optional)</div>
        
        <div style={{ marginBottom: '6px' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={useSystemTimezone}
              onChange={(e) => setUseSystemTimezone(e.target.checked)}
              style={{ marginRight: '6px' }}
            />
            <span style={{ fontSize: '13px' }}>Use system timezone</span>
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="number"
            value={timezoneOffset}
            onChange={(e) => setTimezoneOffset(e.target.value)}
            placeholder="-12 to 12"
            min="-12"
            max="12"
            disabled={useSystemTimezone}
            className="input-text"
            style={{ 
              width: '100px',
              backgroundColor: useSystemTimezone ? '#f5f5f5' : 'white',
              color: useSystemTimezone ? '#999' : 'inherit',
              cursor: useSystemTimezone ? 'not-allowed' : 'text'
            }}
          />
          <span style={{ fontSize: '12px', color: '#666' }}>
            Hours (-12 to +12)
          </span>
        </div>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <button
          onClick={handleIssue}
          disabled={issuing}
          className="button-primary"
          style={{ opacity: issuing ? 0.6 : 1 }}
        >
          {issuing ? 'Issuing...' : 'Issue ID'}
        </button>
      </div>

      {error && (
        <div className="error-message" style={{ marginTop: '12px', padding: '8px', backgroundColor: '#fee', border: '1px solid #fcc', borderRadius: '4px', color: '#c33' }}>
          Error: {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: '12px', padding: '12px', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
          <div className="section-title" style={{ marginBottom: '8px' }}>ID Issued Successfully</div>
          
          <div style={{ fontFamily: 'monospace', fontSize: '13px' }}>
            <div style={{ marginBottom: '6px' }}>
              <span style={{ fontWeight: '500' }}>Integer:</span> {result.value}
            </div>
            <div style={{ marginBottom: '6px' }}>
              <span style={{ fontWeight: '500' }}>Base36:</span> {result.conversions?.valueBase36 || 'N/A'}
            </div>
            <div style={{ marginBottom: '6px' }}>
              <span style={{ fontWeight: '500' }}>Base64:</span> {result.conversions?.valueBase64 || 'N/A'}
            </div>
            <div style={{ marginBottom: '6px' }}>
              <span style={{ fontWeight: '500' }}>Hex:</span> {result.conversions?.valueHex || 'N/A'}
            </div>
            <div style={{ marginBottom: '6px' }}>
              <span style={{ fontWeight: '500' }}>Type:</span> {result.selfType === 0 ? 'Random' : 'ms_48 (Timestamp)'}
            </div>
            {result.selfType === 1 && (
              <div style={{ marginBottom: '6px' }}>
                <span style={{ fontWeight: '500' }}>Timestamp:</span> {formatTimestamp(extractTimestampMs(result.value), result.createAtTimezone)}
              </div>
            )}
            {result.type && (
              <div style={{ marginBottom: '6px' }}>
                <span style={{ fontWeight: '500' }}>Tag:</span> {result.type}
              </div>
            )}
            {result.metadata && (
              <div style={{ marginBottom: '6px' }}>
                <span style={{ fontWeight: '500' }}>Metadata:</span> {result.metadata}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default IdIssue;
