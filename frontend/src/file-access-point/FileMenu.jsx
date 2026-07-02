import React from 'react';
import { Menu } from '@wwf971/react-comp-misc';

/**
 * FileMenu - Context menu for file items
 * 
 * @param {Object} file - The file object
 * @param {Object} position - Menu position {x, y}
 * @param {Function} onClose - Callback to close menu
 * @param {Function} onDownload - Callback for download action
 * @param {Function} onShow - Callback for show action
 * @param {Function} onOpenInNewTab - Callback for open in new tab action
 * @param {Function} onRename - Callback for rename action
 * @param {Function} onContextMenu - Callback for right-click on backdrop (for repositioning)
 */
const FileMenu = ({ file, position, onClose, onDownload, onShow, onOpenInNewTab, onRename, onContextMenu }) => {
  const menuItems = [
    {
      id: 'download',
      label: 'Download',
      data: { action: 'download', file },
    },
    {
      id: 'show',
      label: 'Show',
      data: { action: 'show', file },
    },
    {
      id: 'open-in-new-tab',
      label: 'Open in New Tab',
      data: { action: 'openInNewTab', file },
    },
    {
      id: 'rename',
      label: 'Rename',
      data: { action: 'rename', file },
    },
  ];

  const handleItemClick = (item) => {
    const { action } = item.data;
    
    switch (action) {
      case 'download':
        onDownload(file);
        break;
      case 'show':
        onShow(file);
        break;
      case 'openInNewTab':
        onOpenInNewTab(file);
        break;
      case 'rename':
        onRename(file);
        break;
      default:
        break;
    }
    
    onClose();
  };

  return (
    <Menu
      data={{ items: menuItems }}
      config={{
        isOpen: true,
        posOpen: position,
      }}
      onEvent={(eventType, eventData) => {
        if (eventType === 'closeRequest') {
          onClose();
          return;
        }
        if (eventType === 'itemClick') {
          handleItemClick(eventData.item);
          return;
        }
        if (eventType === 'backdropContextMenu' && onContextMenu) {
          onContextMenu(eventData.event);
        }
      }}
    />
  );
};

export default FileMenu;

