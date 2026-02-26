import React from 'react';
import { formatTimestamp } from '../../file-access-point/fileUtils';
import '../rabbitmq.css';

const ReceiveLog = ({ messages }) => {
  return (
    <div className="log-panel">
      <div className="log-panel-header">
        Received Messages ({messages.length})
      </div>
      
      <div className="log-panel-content">
        {messages.length === 0 ? (
          <div className="log-panel-empty">
            No messages received yet
          </div>
        ) : (
          <div className="log-panel-list">
            {messages.map((message, index) => (
              <div key={index} className="log-item">
                <div className="log-item-header">
                  <span className="log-item-type log-item-type-received">
                    {message.type}
                  </span>
                  <span className="log-item-timestamp">
                    {formatTimestamp(message.timestamp)}
                  </span>
                </div>
                <div className="log-item-id">
                  ID: {message.id}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReceiveLog;
