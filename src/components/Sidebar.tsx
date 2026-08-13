import React from 'react';
import { Search, Plus, NotebookPen, FileText, Code2 } from 'lucide-react';
import type { NoteIndexEntry } from '../types';
import { fmtTime } from '../utils';

interface Props {
  notes: NoteIndexEntry[];
  currentId: string | null;
  query: string;
  ready: boolean;
  isOpen: boolean;
  onQuery: (q: string) => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
}

const blockCountLabel = (count: number) =>
  count === 1 ? '1 block' : `${count} blocks`;

export const Sidebar: React.FC<Props> = ({
  notes,
  currentId,
  query,
  ready,
  isOpen,
  onQuery,
  onSelect,
  onNew,
}) => {
  const filtered = notes.filter((n) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      (n.title || '').toLowerCase().includes(q) ||
      (n.preview || '').toLowerCase().includes(q)
    );
  });

  const previewIcon = (preview: string) =>
    preview.startsWith('</> ') ? (
      <Code2 size={10} style={{ flexShrink: 0, opacity: 0.6 }} />
    ) : (
      <FileText size={10} style={{ flexShrink: 0, opacity: 0.6 }} />
    );

  return (
    <aside className={`sidebar${isOpen ? ' open' : ''}`} aria-label="Notes sidebar">
      <div className="sidebar-head">
        {/* Brand */}
        <div className="brand">
          <div className="brand-icon">
            <NotebookPen size={16} />
          </div>
          <div>
            <div className="brand-title">NOTEit</div>
            <div className="brand-subtitle">Your Notebook</div>
          </div>
        </div>

        {/* Search */}
        <div className="search-box" role="search">
          <Search size={13} style={{ color: 'var(--ink-faint)', flexShrink: 0 }} />
          <input
            id="search-input"
            type="search"
            placeholder="Search notes…"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            aria-label="Search notes"
          />
        </div>

        {/* New note */}
        <button
          id="new-note-btn"
          className="new-note-btn"
          onClick={onNew}
          type="button"
          aria-label="Create new note"
        >
          <Plus size={15} />
          New note
        </button>
      </div>

      {/* List */}
      <nav className="note-list" aria-label="Note list">
        {ready && filtered.length === 0 ? (
          <div className="empty-list">
            {notes.length === 0
              ? 'Nothing here yet \u2014\nstart your first note ✦'
              : 'No notes match that search.'}
          </div>
        ) : (
          <>
            {query.trim() === '' && (
              <div
                className="note-list-section-label"
                style={{ display: 'flex', alignItems: 'center' }}
              >
                <span>All notes</span>
                <span className="note-count-badge">{notes.length}</span>
              </div>
            )}
            {filtered.map((n) => (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                className={`note-item${n.id === currentId ? ' active' : ''}`}
                onClick={() => onSelect(n.id)}
                onKeyDown={(e) => e.key === 'Enter' && onSelect(n.id)}
                aria-label={`Open note: ${n.title || 'Untitled'}`}
                aria-current={n.id === currentId ? 'true' : undefined}
              >
                <div className="note-item-title">{n.title || 'Untitled'}</div>
                <div
                  className="note-item-preview"
                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  {previewIcon(n.preview)}
                  {n.preview || 'Empty note'}
                </div>
                <div className="note-item-meta">
                  <span>{fmtTime(n.updatedAt)}</span>
                  {n.blockCount > 0 && (
                    <span style={{ opacity: 0.7 }}>· {blockCountLabel(n.blockCount)}</span>
                  )}
                </div>

              </div>
            ))}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <span>{notes.length} {notes.length === 1 ? 'note' : 'notes'}</span>
        <span style={{ opacity: 0.6 }}>NOTEit</span>
      </div>
    </aside>
  );
};
