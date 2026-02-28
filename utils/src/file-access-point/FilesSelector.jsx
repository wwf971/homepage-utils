import React, { useRef } from 'react';
import ItemSelector from './ItemSelector.jsx';
import { CrossIcon, RefreshIcon } from '@wwf971/react-comp-misc';
import './fileAccessPoint.css';

/**
 * FilesSelector - Multiple files selector
 * 
 * Props:
 * - serverUrl: string - Backend server URL
 * - fileAccessPointId: string - File access point ID
 * - initialPath: string - Starting path (default: '/')
 * - onConfirm: (selectedFiles) => void - Called with array of selected file objects
 * - onCancel: () => void
 * - height: number - Fixed height for FolderView body (default: 400)
 * - title: string - Title to display (default: 'Select Files')
 */
const FilesSelector = ({ serverUrl, fileAccessPointId, initialPath, onConfirm, onCancel, height, title = 'Select Files' }) => {
  const itemSelectorRef = useRef(null);
  
  const handleRefresh = () => {
    if (itemSelectorRef.current?.refresh) {
      itemSelectorRef.current.refresh();
    }
  };
  
  return (
    <div className="file-access-point-selector-wrapper">
      <button
        onClick={handleRefresh}
        className="file-access-point-selector-action-button file-access-point-selector-refresh-button"
        title="Refresh"
      >
        <RefreshIcon width={16} height={16} />
      </button>
      
      <button
        onClick={onCancel}
        className="file-access-point-selector-action-button file-access-point-selector-close-button"
        title="Cancel"
      >
        <CrossIcon size={16} color="#666" strokeWidth={2} />
      </button>

      <div className="file-access-point-selector-header">
        {title}
      </div>

      <ItemSelector
        ref={itemSelectorRef}
        serverUrl={serverUrl}
        fileAccessPointId={fileAccessPointId}
        initialPath={initialPath}
        selectionConfig={{
          mode: 'multiple',
          allowedTypes: ['file'],
          allowMixed: false
        }}
        onConfirm={onConfirm}
        onCancel={onCancel}
        height={height}
        showTitle={false}
      />
    </div>
  );
};

export default FilesSelector;
