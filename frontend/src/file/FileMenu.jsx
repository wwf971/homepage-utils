import React from 'react';
import Menu from '@wwf971/react-comp-misc/src/menu/Menu';

/**
 * FileMenu - Context menu for file items
 * 
 * @param {Object} file - The file object
 * @param {Object} position - Menu position {x, y}
 * @param {Function} onClose - Callback to close menu
 * @param {Function} onDownload - Callback for download action
 * @param {Function} onShow - Callback for show action
 * @param {Function} onRename - Callback for rename action
 * @param {Function} onContextMenu - Callback for right-click on backdrop (for repositioning)
 */
const FileMenu = ({ file, position, onClose, onDownload, onShow, onRename, onContextMenu }) => {
  const menuItems = [
    {
      type: 'item',
      name: 'Download',
      data: { action: 'download', file }
    },
    {
      type: 'item',
      name: 'Show',
      data: { action: 'show', file }
    },
    {
      type: 'item',
      name: 'Rename',
      data: { action: 'rename', file }
    }
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
      items={menuItems}
      position={position}
      onClose={onClose}
      onItemClick={handleItemClick}
      onContextMenu={onContextMenu}
    />
  );
};

export default FileMenu;

