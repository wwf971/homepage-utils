import React from 'react';
import './ConfirmDialog.css';

/**
 * ConfirmDialog - A simple confirmation dialog component
 * 
 * @param {boolean} isOpen - Whether the dialog is open
 * @param {string} message - Message to display
 * @param {function} onConfirm - Callback when confirmed
 * @param {function} onCancel - Callback when cancelled
 * @param {string} confirmText - Text for confirm button (default: "Confirm")
 * @param {string} cancelText - Text for cancel button (default: "Cancel")
 * @param {string} type - Type of dialog: "danger" | "warning" | "info" (default: "warning")
 */
const ConfirmDialog = ({ 
  isOpen, 
  message, 
  onConfirm, 
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning'
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
  };

  const handleCancel = () => {
    onCancel();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'danger':
        return 'Warning';
      case 'warning':
        return 'Confirm';
      case 'info':
        return 'Information';
      default:
        return 'Confirm';
    }
  };

  return (
    <div className="confirm-dialog-backdrop" onClick={handleBackdropClick}>
      <div className="confirm-dialog">
        <div className={`confirm-dialog-header ${type}`}>
          <h4>{getTitle()}</h4>
        </div>
        <div className="confirm-dialog-content">
          <p>{message}</p>
        </div>
        <div className="confirm-dialog-actions">
          <button 
            onClick={handleCancel}
            className="confirm-dialog-btn cancel"
          >
            {cancelText}
          </button>
          <button 
            onClick={handleConfirm}
            className={`confirm-dialog-btn confirm ${type}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;

