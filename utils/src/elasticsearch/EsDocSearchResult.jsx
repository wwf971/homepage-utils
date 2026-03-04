import React from 'react';

const EsDocSearchResult = ({ doc, mergeMatchesForSameKey = true }) => {
  
  const highlightSingleMatch = (text, startIndex, endIndex) => {
    const before = text.substring(0, startIndex);
    const match = text.substring(startIndex, endIndex);
    const after = text.substring(endIndex);
    
    return (
      <>
        {before}
        <span className="es-search-highlight">{match}</span>
        {after}
      </>
    );
  };

  const highlightMultipleMatches = (text, positions) => {
    if (positions.length === 0) return text;
    
    const sortedPositions = [...positions].sort((a, b) => a.start_index - b.start_index);
    const parts = [];
    let lastEnd = 0;
    
    for (const pos of sortedPositions) {
      if (pos.start_index > lastEnd) {
        parts.push(text.substring(lastEnd, pos.start_index));
      }
      parts.push(
        <span key={pos.start_index} className="es-search-highlight">
          {text.substring(pos.start_index, pos.end_index)}
        </span>
      );
      lastEnd = pos.end_index;
    }
    
    if (lastEnd < text.length) {
      parts.push(text.substring(lastEnd));
    }
    
    return <>{parts}</>;
  };

  const renderMergedMatches = () => {
    const groupedMatches = {};
    
    for (const match of doc.matched_keys) {
      const key = `${match.key}|${match.match_in}`;
      if (!groupedMatches[key]) {
        groupedMatches[key] = {
          key: match.key,
          value: match.value,
          match_in: match.match_in,
          positions: []
        };
      }
      groupedMatches[key].positions.push({
        start_index: match.start_index,
        end_index: match.end_index
      });
    }
    
    const groups = Object.values(groupedMatches);
    const totalMatches = doc.matched_keys.length;
    
    return (
      <>
        <div className="es-search-result-header">
          <div>
            <strong>Document ID:</strong> {doc.id}
          </div>
          <span className="es-match-count">
            {totalMatches} match{totalMatches !== 1 ? 'es' : ''} in {groups.length} field{groups.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="es-search-matches">
          {groups.map((group, idx) => (
            <div key={idx} className="es-search-match">
              <div className="es-match-location">
                {group.positions.length} match{group.positions.length !== 1 ? 'es' : ''} in <strong>{group.match_in}</strong>
              </div>
              <div className="es-match-field">
                <span className="es-field-label">Key:</span>
                {group.match_in === 'key' ? (
                  <code className="es-field-value">
                    {highlightMultipleMatches(group.key, group.positions)}
                  </code>
                ) : (
                  <code className="es-field-value">{group.key}</code>
                )}
              </div>
              <div className="es-match-field">
                <span className="es-field-label">Value:</span>
                {group.match_in === 'value' ? (
                  <code className="es-field-value">
                    {highlightMultipleMatches(group.value, group.positions)}
                  </code>
                ) : (
                  <code className="es-field-value">{group.value}</code>
                )}
              </div>
            </div>
          ))}
        </div>
      </>
    );
  };

  const renderSeparateMatches = () => {
    return (
      <>
        <div className="es-search-result-header">
          <div>
            <strong>Document ID:</strong> {doc.id}
          </div>
          <span className="es-match-count">
            {doc.matched_keys.length} match{doc.matched_keys.length !== 1 ? 'es' : ''}
          </span>
        </div>
        <div className="es-search-matches">
          {doc.matched_keys.map((match, matchIdx) => (
            <div key={matchIdx} className="es-search-match">
              <div className="es-match-location">
                Match in <strong>{match.match_in}</strong> at position {match.start_index}-{match.end_index}
              </div>
              <div className="es-match-field">
                <span className="es-field-label">Key:</span>
                {match.match_in === 'key' ? (
                  <code className="es-field-value">
                    {highlightSingleMatch(match.key, match.start_index, match.end_index)}
                  </code>
                ) : (
                  <code className="es-field-value">{match.key}</code>
                )}
              </div>
              <div className="es-match-field">
                <span className="es-field-label">Value:</span>
                {match.match_in === 'value' ? (
                  <code className="es-field-value">
                    {highlightSingleMatch(match.value, match.start_index, match.end_index)}
                  </code>
                ) : (
                  <code className="es-field-value">{match.value}</code>
                )}
              </div>
            </div>
          ))}
        </div>
      </>
    );
  };

  return (
    <div className="es-search-result-card">
      {mergeMatchesForSameKey ? renderMergedMatches() : renderSeparateMatches()}
    </div>
  );
};

export default EsDocSearchResult;
