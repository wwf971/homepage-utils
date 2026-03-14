import React, { useState } from 'react';
import { MinusIcon, PlusIcon } from '@wwf971/react-comp-misc';
import '../MongoAppConfig.css';

const AppMongoCollectionCard = ({
  collName,
  collectionInfo,
  appId,
  index,
  onCreate,
  onDelete,
  isDeleting = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const isExisting = collectionInfo?.exists || false;
  const docCount = collectionInfo?.docCount || 0;
  const indices = collectionInfo?.indices || [];
  const fullCollectionName = appId ? `${appId}_${collName}` : collName;

  const internalIndices = indices.filter(idx => !idx.external);
  const externalIndices = indices.filter(idx => idx.external);

  const handleCreate = (event) => {
    event.stopPropagation();
    if (onCreate) {
      onCreate(collName);
    }
  };

  const handleDeleteClick = (event) => {
    event.stopPropagation();
    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      return;
    }
    if (onDelete) {
      onDelete(collName);
    }
    setIsConfirmingDelete(false);
  };

  const handleCancelDelete = (event) => {
    event.stopPropagation();
    setIsConfirmingDelete(false);
  };

  const handleToggleExpand = () => {
    if (isExisting) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div className="collection-card-container">
      <div className="collection-card-header" onClick={handleToggleExpand}>
        <div className="collection-card-title-group">
          {index !== undefined && (
            <span className="collection-card-index">#{index}</span>
          )}
          {isExisting ? (
            isExpanded ? (
              <MinusIcon width={10} height={10} color="#999" strokeWidth={2} />
            ) : (
              <PlusIcon width={10} height={10} color="#999" strokeWidth={2} />
            )
          ) : null}
          <div className="collection-card-title-content">
            <div className="collection-card-name-line">
              <span className="collection-card-label">Collection:</span>
              <span className="collection-card-name">{collName}</span>
              {docCount > 0 && (
                <span className="collection-card-count">({docCount})</span>
              )}
              <span className={`collection-card-status ${isExisting ? 'collection-card-status-exists' : 'collection-card-status-missing'}`}>
                {isExisting ? 'Exists' : 'Missing'}
              </span>
            </div>
            {isExisting && (
              <div className="collection-card-subline">
                MongoDB collection: <span className="collection-card-mono">{fullCollectionName}</span>
              </div>
            )}
          </div>
        </div>

        <div className="collection-card-actions" onClick={(event) => event.stopPropagation()}>
          {!isExisting && (
            <button
              onClick={handleCreate}
              className="collection-card-btn collection-card-btn-primary"
            >
              Create
            </button>
          )}
          {isExisting && (
            <>
              <button
                onClick={handleDeleteClick}
                className={`collection-card-btn ${isConfirmingDelete ? 'collection-card-btn-danger' : 'collection-card-btn-warn'}`}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : (isConfirmingDelete ? 'Confirm' : 'Delete')}
              </button>
              {isConfirmingDelete && !isDeleting && (
                <button
                  onClick={handleCancelDelete}
                  className="collection-card-btn collection-card-btn-muted"
                >
                  Cancel
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {isExisting && isExpanded && (
        <div className="collection-card-details">
          <div className="collection-card-details-label">ES Indices:</div>
          {indices.length > 0 ? (
            <div className="collection-indices-container">
              {internalIndices.length > 0 && (
                <div className="collection-indices-row">
                  {internalIndices.map((indexInfo, idx) => (
                    <span key={`${indexInfo.name}-${idx}`} className="index-tag-internal">
                      {indexInfo.name}
                    </span>
                  ))}
                </div>
              )}
              {externalIndices.length > 0 && (
                <div>
                  <div className="external-label">External:</div>
                  <div className="collection-indices-row">
                    {externalIndices.map((indexInfo, idx) => (
                      <span key={`${indexInfo.name}-${idx}`} className="index-tag-external">
                        {indexInfo.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="no-items-text">None</div>
          )}
        </div>
      )}
    </div>
  );
};

export default AppMongoCollectionCard;
