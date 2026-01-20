import React from 'react';
import { formatTimestamp } from '../../file/fileUtils';
import '../rabbitmq.css';

const PublishLog = ({ tasks }) => {
  return (
    <div className="log-panel">
      <div className="log-panel-header">
        Published Tasks ({tasks.length})
      </div>
      
      <div className="log-panel-content">
        {tasks.length === 0 ? (
          <div className="log-panel-empty">
            No tasks published yet
          </div>
        ) : (
          <div className="log-panel-list">
            {tasks.map((task, index) => (
              <div key={index} className="log-item">
                <div className="log-item-header">
                  <span className="log-item-type log-item-type-published">
                    {task.type}
                  </span>
                  <span className="log-item-timestamp">
                    {formatTimestamp(task.timestamp)}
                  </span>
                </div>
                <div className="log-item-id">
                  ID: {task.id}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PublishLog;
