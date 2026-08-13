import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  noteTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteDialog: React.FC<Props> = ({
  isOpen,
  noteTitle,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="dialog-backdrop" onClick={onCancel} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <div
        className="dialog-box"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-icon">
          <AlertTriangle size={22} />
        </div>
        <h2 className="dialog-title" id="dialog-title">Delete note?</h2>
        <p className="dialog-body">
          <strong>"{noteTitle || 'Untitled'}"</strong> will be permanently deleted.
          This action cannot be undone.
        </p>
        <div className="dialog-actions">
          <button
            className="dialog-btn dialog-btn-cancel"
            onClick={onCancel}
            type="button"
            autoFocus
          >
            Cancel
          </button>
          <button
            className="dialog-btn dialog-btn-delete"
            onClick={onConfirm}
            type="button"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};
