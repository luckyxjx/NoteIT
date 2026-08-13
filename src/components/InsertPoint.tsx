import React, { useState } from 'react';
import { Plus, Type, Code2, PenLine } from 'lucide-react';
import type { BlockType } from '../types';

interface Props {
  onInsert: (type: BlockType) => void;
  forced?: boolean;
}

export const InsertPoint: React.FC<Props> = ({ onInsert, forced = false }) => {
  const [open, setOpen] = useState(false);

  const handle = (type: BlockType) => {
    onInsert(type);
    setOpen(false);
  };

  return (
    <div className="insert-row">
      <div className="insert-line" />
      <button
        type="button"
        className={`insert-plus${forced ? ' forced' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label="Insert block"
      >
        <Plus size={11} />
      </button>
      <div className="insert-line" />
      {open && (
        <div className="insert-menu">
          <button type="button" onClick={() => handle('text')}>
            <Type size={13} /> Text
          </button>
          <button type="button" onClick={() => handle('code')}>
            <Code2 size={13} /> Code
          </button>
          <button type="button" onClick={() => handle('draw')}>
            <PenLine size={13} /> Draw
          </button>
        </div>
      )}
    </div>
  );
};
