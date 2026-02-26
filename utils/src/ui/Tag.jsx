import React from 'react';
import { CrossIcon } from '@wwf971/react-comp-misc';
import './tag.css';

/**
 * A reusable tag component that matches the mongo tag styling.
 * 
 * @param {Object} props
 * @param {string} props.children - Main text content of the tag
 * @param {string} [props.secondary] - Secondary text (shown in grey, typically in parentheses)
 * @param {boolean} [props.isClickable=false] - Whether the tag is clickable (shows hover effect)
 * @param {boolean} [props.isSelected=false] - Whether the tag is selected (blue background)
 * @param {boolean} [props.isClosable=false] - Whether to show a cross button at top-right corner
 * @param {Function} [props.onClick] - Click handler
 * @param {Function} [props.onContextMenu] - Context menu handler
 * @param {Function} [props.onClose] - Close button click handler (when isClosable is true)
 * @param {Object} [props.style] - Additional inline styles
 * @param {string} [props.className] - Additional CSS classes
 */
const Tag = ({ 
  children, 
  secondary, 
  isClickable = false, 
  isSelected = false, 
  isClosable = false,
  onClick, 
  onContextMenu,
  onClose,
  style,
  className = ''
}) => {
  const classes = [
    'mongo-tag',
    isClickable ? 'mongo-tag-clickable' : 'mongo-tag-static',
    isSelected ? 'mongo-tag-selected' : '',
    className
  ].filter(Boolean).join(' ');

  const handleCloseClick = (e) => {
    e.stopPropagation();
    onClose?.(e);
  };

  return (
    <span 
      className={classes}
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{ 
        position: 'relative', 
        paddingRight: isClosable ? '20px' : undefined,
        userSelect: 'text',
        ...style 
      }}
    >
      {children}
      {secondary && (
        <span style={{ marginLeft: '6px', color: '#999' }}>
          ({secondary})
        </span>
      )}
      {isClosable && (
        <span
          onClick={handleCloseClick}
          style={{
            position: 'absolute',
            top: '50%',
            right: '4px',
            transform: 'translateY(-50%)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <CrossIcon width={10} height={10} color="#666" strokeWidth={2} />
        </span>
      )}
    </span>
  );
};

export default Tag;
