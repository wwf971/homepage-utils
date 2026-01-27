import React, { useState } from 'react';
import { MinusIcon, PlusIcon } from '@wwf971/react-comp-misc';
import '../styles/common.css';

const Subpanel = ({ title, children, defaultExpanded = false }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="config-section" style={{ marginTop: '12px' }}>
      <div style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }}>
        {title && (
          <div 
            className="section-title" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              cursor: 'pointer',
              userSelect: 'none'
            }}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <MinusIcon width={14} height={14} color="#666" strokeWidth={2} style={{ marginRight: '8px' }} />
            ) : (
              <PlusIcon width={14} height={14} color="#666" strokeWidth={2} style={{ marginRight: '8px' }} />
            )}
            {title}
          </div>
        )}
        <div style={{ display: isExpanded ? 'block' : 'none' }}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default Subpanel;
