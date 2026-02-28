import React, { useRef } from 'react';
import ItemSelector from './ItemSelector.jsx';
import { CrossIcon, RefreshIcon } from '@wwf971/react-comp-misc';
import './fileAccessPoint.css';

/**
 * FileSelector - Single file selector
 * 
 * Props:
 * - serverUrl: string - Backend server URL
 * - fileAccessPointId: string - File access point ID
 * - initialPath: string - Starting path (default: '/')
 * - onConfirm: (selectedFile) => void - Called with selected file object
 * - onCancel: () => void
 * - height: number - Fixed height for FolderView body (default: 400)
 * - title: string - Title to display (default: 'Select File')
 */
const FileSelector = ({ serverUrl, fileAccessPointId, initialPath, onConfirm, onCancel, height, title = 'Select File' }) => {
  const itemSelectorRef = useRef(null);
  
  const handleConfirm = (selectedItems) => {
    if (selectedItems.length > 0 && onConfirm) {
      onConfirm(selectedItems[0]); // Return single file
    }
  };
  
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
          mode: 'single',
          allowedTypes: ['file'],
          allowMixed: false
        }}
        onConfirm={handleConfirm}
        onCancel={onCancel}
        height={height}
        showTitle={false}
      />
    </div>
  );
};

export default FileSelector;
