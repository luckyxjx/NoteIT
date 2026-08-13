import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Trash2, Code2, Type, ChevronUp, ChevronDown, Search, Menu, X, Copy, Check, FileText, NotebookPen } from 'lucide-react';

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const COLORS = {
  bg: '#EAE6DA',
  bgDeep: '#DFDAC9',
  sidebar: '#E2DDCF',
  ink: '#26211B',
  inkSoft: '#5B5548',
  inkFaint: '#8C8574',
  hair: 'rgba(38,33,27,0.14)',
  hairStrong: 'rgba(38,33,27,0.28)',
  paper: '#F4F1E6',
  paperLine: 'rgba(38,33,27,0.09)',
  brass: '#9C6B23',
  brassDeep: '#7A5119',
  brassBg: '#EFE1C4',
  danger: '#8E3A2E',
  dangerBg: '#EFDAD3',
  term: '#1C211F',
  termHead: '#242A27',
  termText: '#B9E3C6',
  termFaint: '#6E8A78',
  termLine: '#33403A',
};

const CSS = `
  .na-root { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: ${COLORS.ink}; background: ${COLORS.bg}; display: flex; height: 100%; min-height: 620px; border-radius: 14px; overflow: hidden; border: 1px solid ${COLORS.hair}; }
  .na-serif { font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; }
  .na-mono { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; }
  .na-sidebar { width: 268px; flex-shrink: 0; background: ${COLORS.sidebar}; border-right: 1px solid ${COLORS.hair}; display: flex; flex-direction: column; transition: transform 0.2s ease; }
  .na-main { flex: 1; display: flex; flex-direction: column; min-width: 0; background: ${COLORS.bg}; }
  .na-sidebar-head { padding: 16px 16px 10px; }
  .na-brand { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
  .na-brand-title { font-size: 15px; font-weight: 600; letter-spacing: 0.01em; }
  .na-search { display: flex; align-items: center; gap: 7px; background: ${COLORS.bg}; border: 1px solid ${COLORS.hair}; border-radius: 8px; padding: 7px 10px; margin-bottom: 10px; }
  .na-search input { border: none; background: transparent; outline: none; font-size: 13px; color: ${COLORS.ink}; width: 100%; }
  .na-search input::placeholder { color: ${COLORS.inkFaint}; }
  .na-newbtn { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 8px 10px; border-radius: 8px; border: 1px solid ${COLORS.brassDeep}; background: ${COLORS.brass}; color: #FBF6EA; font-size: 13px; font-weight: 600; cursor: pointer; }
  .na-newbtn:hover { background: ${COLORS.brassDeep}; }
  .na-list { flex: 1; overflow-y: auto; padding: 4px 8px 12px; }
  .na-item { padding: 9px 10px; border-radius: 8px; cursor: pointer; margin-bottom: 2px; border: 1px solid transparent; }
  .na-item:hover { background: ${COLORS.bg}; }
  .na-item.active { background: ${COLORS.paper}; border-color: ${COLORS.hair}; }
  .na-item-title { font-size: 13.5px; font-weight: 600; color: ${COLORS.ink}; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .na-item-preview { font-size: 12px; color: ${COLORS.inkFaint}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .na-item-meta { font-size: 10.5px; color: ${COLORS.inkFaint}; margin-top: 3px; text-transform: uppercase; letter-spacing: 0.04em; }
  .na-empty-list { padding: 24px 14px; font-size: 12.5px; color: ${COLORS.inkFaint}; text-align: center; line-height: 1.5; }
  .na-topbar { display: flex; align-items: center; gap: 10px; padding: 12px 22px; border-bottom: 1px solid ${COLORS.hair}; }
  .na-topbar input.na-title { flex: 1; border: none; background: transparent; outline: none; font-size: 20px; font-weight: 600; color: ${COLORS.ink}; }
  .na-topbar input.na-title::placeholder { color: ${COLORS.inkFaint}; font-weight: 500; }
  .na-savestate { font-size: 11px; color: ${COLORS.inkFaint}; white-space: nowrap; }
  .na-menu-btn, .na-icon-btn { background: transparent; border: none; cursor: pointer; color: ${COLORS.inkSoft}; display: flex; align-items: center; justify-content: center; padding: 5px; border-radius: 6px; }
  .na-icon-btn:hover { background: ${COLORS.hair}; color: ${COLORS.ink}; }
  .na-icon-btn.danger:hover { background: ${COLORS.dangerBg}; color: ${COLORS.danger}; }
  .na-menu-btn { display: none; }
  .na-body { flex: 1; overflow-y: auto; padding: 18px 22px 60px; }
  .na-noselect { flex: 1; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 10px; color: ${COLORS.inkFaint}; padding: 40px; text-align: center; }
  .na-noselect-title { font-size: 15px; font-weight: 600; color: ${COLORS.inkSoft}; }
  .na-block { border-radius: 10px; margin-bottom: 4px; position: relative; }
  .na-block-header { display: flex; align-items: center; gap: 6px; padding: 3px 4px; opacity: 0; transition: opacity 0.12s; }
  .na-block:hover .na-block-header, .na-block:focus-within .na-block-header { opacity: 1; }
  .na-block-tag { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; color: ${COLORS.inkFaint}; display: flex; align-items: center; gap: 4px; margin-right: auto; }
  .na-text-surface { background: ${COLORS.paper}; border-radius: 8px; padding: 12px 16px; background-image: repeating-linear-gradient(${COLORS.paperLine} 0 1px, transparent 1px 30px); background-position: 0 6px; border: 1px solid ${COLORS.hair}; }
  .na-text-surface textarea { width: 100%; border: none; outline: none; background: transparent; resize: none; font-size: 14.5px; line-height: 30px; color: ${COLORS.ink}; overflow: hidden; }
  .na-text-surface textarea::placeholder { color: ${COLORS.inkFaint}; }
  .na-code-surface { background: ${COLORS.term}; border-radius: 8px; overflow: hidden; border: 1px solid ${COLORS.termLine}; }
  .na-code-head { display: flex; align-items: center; justify-content: space-between; padding: 7px 12px; background: ${COLORS.termHead}; border-bottom: 1px solid ${COLORS.termLine}; }
  .na-code-head input { background: transparent; border: none; outline: none; color: ${COLORS.termText}; font-size: 11.5px; text-transform: lowercase; width: 90px; }
  .na-code-head input::placeholder { color: ${COLORS.termFaint}; }
  .na-code-surface textarea { width: 100%; border: none; outline: none; background: transparent; resize: none; color: ${COLORS.termText}; font-size: 13px; line-height: 21px; padding: 12px 16px; overflow: hidden; }
  .na-code-surface textarea::placeholder { color: ${COLORS.termFaint}; }
  .na-copybtn { background: transparent; border: none; cursor: pointer; color: ${COLORS.termFaint}; display: flex; align-items: center; gap: 4px; font-size: 11px; padding: 3px 6px; border-radius: 5px; }
  .na-copybtn:hover { color: ${COLORS.termText}; background: rgba(255,255,255,0.06); }
  .na-insert { display: flex; align-items: center; gap: 8px; height: 14px; position: relative; }
  .na-insert-line { flex: 1; height: 1px; background: transparent; }
  .na-insert:hover .na-insert-line { background: ${COLORS.hairStrong}; }
  .na-insert-btn { width: 18px; height: 18px; border-radius: 50%; border: 1px solid ${COLORS.hairStrong}; background: ${COLORS.bg}; color: ${COLORS.inkSoft}; display: none; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
  .na-insert:hover .na-insert-btn, .na-insert-btn.forced { display: flex; }
  .na-insert-menu { position: absolute; left: 26px; top: -6px; z-index: 5; background: ${COLORS.paper}; border: 1px solid ${COLORS.hair}; border-radius: 8px; box-shadow: 0 4px 14px rgba(38,33,27,0.18); display: flex; overflow: hidden; }
  .na-insert-menu button { display: flex; align-items: center; gap: 6px; padding: 7px 12px; background: transparent; border: none; cursor: pointer; font-size: 12.5px; color: ${COLORS.ink}; }
  .na-insert-menu button:hover { background: ${COLORS.bg}; }
  .na-bottom-add { display: flex; gap: 8px; margin-top: 8px; }
  .na-bottom-add button { display: flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 8px; border: 1px dashed ${COLORS.hairStrong}; background: transparent; color: ${COLORS.inkSoft}; font-size: 12.5px; cursor: pointer; }
  .na-bottom-add button:hover { background: ${COLORS.paper}; color: ${COLORS.ink}; }
  @media (max-width: 760px) {
    .na-menu-btn { display: flex; }
    .na-sidebar { position: absolute; top: 0; bottom: 0; left: 0; z-index: 20; transform: translateX(-100%); box-shadow: 0 0 24px rgba(0,0,0,0.25); }
    .na-sidebar.open { transform: translateX(0); }
    .na-root { position: relative; }
    .na-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.3); z-index: 15; }
  }
`;

function useAutoResize(value) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = ref.current.scrollHeight + 'px';
    }
  }, [value]);
  return ref;
}

function TextBlock({ block, onChange, placeholder }) {
  const ref = useAutoResize(block.content);
  return (
    <div className="na-text-surface">
      <textarea
        ref={ref}
        rows={1}
        value={block.content}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function CodeBlock({ block, onChangeContent, onChangeLang }) {
  const ref = useAutoResize(block.content);
  const [copied, setCopied] = useState(false);
  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(block.content || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch (e) {}
  };
  return (
    <div className="na-code-surface">
      <div className="na-code-head">
        <input
          value={block.language || ''}
          placeholder="plain text"
          onChange={(e) => onChangeLang(e.target.value)}
        />
        <button className="na-copybtn" onClick={doCopy} type="button">
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
      <textarea
        ref={ref}
        rows={1}
        className="na-mono"
        value={block.content}
        placeholder="// paste or write code here"
        spellCheck={false}
        onChange={(e) => onChangeContent(e.target.value)}
      />
    </div>
  );
}

function InsertPoint({ onInsert, forced }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="na-insert">
      <div className="na-insert-line" />
      <button
        type="button"
        className={'na-insert-btn' + (forced ? ' forced' : '')}
        onClick={() => setOpen((o) => !o)}
      >
        <Plus size={12} />
      </button>
      {open && (
        <div className="na-insert-menu">
          <button type="button" onClick={() => { onInsert('text'); setOpen(false); }}>
            <Type size={13} /> Text
          </button>
          <button type="button" onClick={() => { onInsert('code'); setOpen(false); }}>
            <Code2 size={13} /> Code
          </button>
        </div>
      )}
    </div>
  );
}

export default function NotesApp() {
  const [notes, setNotes] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [currentNote, setCurrentNote] = useState(null);
  const [query, setQuery] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [saveState, setSaveState] = useState('idle');
  const [ready, setReady] = useState(false);
  const saveTimer = useRef(null);
  const skipNextSave = useRef(false);

  const previewOf = (blocks) => {
    const b = (blocks || []).find((x) => (x.content || '').trim().length > 0) || blocks?.[0];
    if (!b) return '';
    const text = (b.content || '').replace(/\s+/g, ' ').trim();
    return b.type === 'code' ? `</> ${text.slice(0, 70)}` : text.slice(0, 90);
  };

  useEffect(() => {
    (async () => {
      try {
        const idx = await window.storage.get('notes-index');
        const list = idx ? JSON.parse(idx.value) : [];
        if (list.length === 0) {
          const welcomeId = genId();
          const welcome = {
            id: welcomeId,
            title: 'Welcome to your notebook',
            blocks: [
              {
                id: genId(),
                type: 'text',
                content:
                  "This is a text block. It behaves like paper — write drafts, thoughts, or plans here. Formatting stays plain and predictable.",
              },
              {
                id: genId(),
                type: 'code',
                language: 'js',
                content: "// This is a code block.\n// It never gets reformatted into prose, and prose never turns into code.\nfunction hello() {\n  return 'two materials, one notebook';\n}",
              },
              {
                id: genId(),
                type: 'text',
                content: 'Use the + between blocks, or the buttons below, to mix as many text and code sections as a note needs.',
              },
            ],
          };
          await window.storage.set('note:' + welcomeId, JSON.stringify(welcome));
          const newIndex = [{ id: welcomeId, title: welcome.title, updatedAt: Date.now(), preview: previewOf(welcome.blocks) }];
          await window.storage.set('notes-index', JSON.stringify(newIndex));
          setNotes(newIndex);
          setCurrentId(welcomeId);
          setCurrentNote(welcome);
        } else {
          setNotes(list);
        }
      } catch (e) {
        setNotes([]);
      }
      setReady(true);
    })();
  }, []);

  const persistIndexEntry = useCallback((note) => {
    setNotes((prev) => {
      const others = prev.filter((n) => n.id !== note.id);
      const entry = { id: note.id, title: note.title || 'Untitled', updatedAt: Date.now(), preview: previewOf(note.blocks) };
      const next = [entry, ...others].sort((a, b) => b.updatedAt - a.updatedAt);
      window.storage.set('notes-index', JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  useEffect(() => {
    if (!currentNote) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await window.storage.set('note:' + currentNote.id, JSON.stringify(currentNote));
        persistIndexEntry(currentNote);
        setSaveState('saved');
      } catch (e) {
        setSaveState('idle');
      }
    }, 450);
    return () => clearTimeout(saveTimer.current);
  }, [currentNote, persistIndexEntry]);

  const openNote = async (id) => {
    if (id === currentId) return;
    try {
      const res = await window.storage.get('note:' + id);
      if (res) {
        skipNextSave.current = true;
        setCurrentNote(JSON.parse(res.value));
        setCurrentId(id);
        setMobileOpen(false);
      }
    } catch (e) {}
  };

  const createNote = async () => {
    const id = genId();
    const note = { id, title: '', blocks: [{ id: genId(), type: 'text', content: '' }] };
    skipNextSave.current = true;
    await window.storage.set('note:' + id, JSON.stringify(note));
    persistIndexEntry(note);
    setCurrentId(id);
    setCurrentNote(note);
    setMobileOpen(false);
  };

  const deleteNote = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this note? This cannot be undone.')) return;
    try {
      await window.storage.delete('note:' + id);
    } catch (err) {}
    const next = notes.filter((n) => n.id !== id);
    setNotes(next);
    window.storage.set('notes-index', JSON.stringify(next)).catch(() => {});
    if (id === currentId) {
      if (next.length > 0) {
        openNote(next[0].id);
      } else {
        setCurrentId(null);
        setCurrentNote(null);
      }
    }
  };

  const updateTitle = (title) => setCurrentNote((prev) => ({ ...prev, title }));

  const updateBlock = (blockId, patch) => {
    setCurrentNote((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)),
    }));
  };

  const deleteBlock = (blockId) => {
    setCurrentNote((prev) => {
      if (prev.blocks.length <= 1) {
        return { ...prev, blocks: [{ ...prev.blocks[0], content: '' }] };
      }
      return { ...prev, blocks: prev.blocks.filter((b) => b.id !== blockId) };
    });
  };

  const moveBlock = (blockId, dir) => {
    setCurrentNote((prev) => {
      const idx = prev.blocks.findIndex((b) => b.id === blockId);
      const swapWith = idx + dir;
      if (swapWith < 0 || swapWith >= prev.blocks.length) return prev;
      const blocks = [...prev.blocks];
      [blocks[idx], blocks[swapWith]] = [blocks[swapWith], blocks[idx]];
      return { ...prev, blocks };
    });
  };

  const insertBlock = (type, atIndex) => {
    setCurrentNote((prev) => {
      const newBlock = type === 'code' ? { id: genId(), type: 'code', language: '', content: '' } : { id: genId(), type: 'text', content: '' };
      const blocks = [...prev.blocks];
      blocks.splice(atIndex, 0, newBlock);
      return { ...prev, blocks };
    });
  };

  const filteredNotes = notes.filter((n) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (n.title || '').toLowerCase().includes(q) || (n.preview || '').toLowerCase().includes(q);
  });

  const fmtTime = (ts) => {
    const d = new Date(ts);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="na-root">
      <style>{CSS}</style>
      {mobileOpen && <div className="na-overlay" onClick={() => setMobileOpen(false)} />}
      <div className={'na-sidebar' + (mobileOpen ? ' open' : '')}>
        <div className="na-sidebar-head">
          <div className="na-brand">
            <NotebookPen size={18} color={COLORS.brass} />
            <span className="na-brand-title na-serif">Notebook</span>
          </div>
          <div className="na-search">
            <Search size={13} color={COLORS.inkFaint} />
            <input placeholder="Search notes" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <button className="na-newbtn" onClick={createNote} type="button">
            <Plus size={14} /> New note
          </button>
        </div>
        <div className="na-list">
          {ready && filteredNotes.length === 0 && (
            <div className="na-empty-list">
              {notes.length === 0 ? 'No notes yet. Start your first one.' : 'No notes match your search.'}
            </div>
          )}
          {filteredNotes.map((n) => (
            <div
              key={n.id}
              className={'na-item' + (n.id === currentId ? ' active' : '')}
              onClick={() => openNote(n.id)}
            >
              <div className="na-item-title">{n.title || 'Untitled'}</div>
              <div className="na-item-preview">{n.preview || 'Empty note'}</div>
              <div className="na-item-meta">{fmtTime(n.updatedAt)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="na-main">
        {currentNote ? (
          <>
            <div className="na-topbar">
              <button className="na-menu-btn na-icon-btn" onClick={() => setMobileOpen(true)} type="button">
                <Menu size={18} />
              </button>
              <input
                className="na-title na-serif"
                placeholder="Untitled"
                value={currentNote.title}
                onChange={(e) => updateTitle(e.target.value)}
              />
              <span className="na-savestate">{saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : ''}</span>
              <button className="na-icon-btn danger" onClick={(e) => deleteNote(currentNote.id, e)} type="button" aria-label="Delete note">
                <Trash2 size={16} />
              </button>
            </div>
            <div className="na-body">
              <InsertPoint forced={currentNote.blocks.length === 0} onInsert={(type) => insertBlock(type, 0)} />
              {currentNote.blocks.map((block, i) => (
                <React.Fragment key={block.id}>
                  <div className="na-block">
                    <div className="na-block-header">
                      <span className="na-block-tag">
                        {block.type === 'code' ? <Code2 size={11} /> : <Type size={11} />}
                        {block.type === 'code' ? 'code' : 'text'}
                      </span>
                      <button className="na-icon-btn" onClick={() => moveBlock(block.id, -1)} type="button" aria-label="Move up" disabled={i === 0}>
                        <ChevronUp size={14} />
                      </button>
                      <button className="na-icon-btn" onClick={() => moveBlock(block.id, 1)} type="button" aria-label="Move down" disabled={i === currentNote.blocks.length - 1}>
                        <ChevronDown size={14} />
                      </button>
                      <button className="na-icon-btn danger" onClick={() => deleteBlock(block.id)} type="button" aria-label="Delete block">
                        <X size={14} />
                      </button>
                    </div>
                    {block.type === 'code' ? (
                      <CodeBlock
                        block={block}
                        onChangeContent={(v) => updateBlock(block.id, { content: v })}
                        onChangeLang={(v) => updateBlock(block.id, { language: v })}
                      />
                    ) : (
                      <TextBlock block={block} placeholder="Write freely…" onChange={(v) => updateBlock(block.id, { content: v })} />
                    )}
                  </div>
                  <InsertPoint onInsert={(type) => insertBlock(type, i + 1)} />
                </React.Fragment>
              ))}
              <div className="na-bottom-add">
                <button type="button" onClick={() => insertBlock('text', currentNote.blocks.length)}>
                  <Type size={13} /> Add text
                </button>
                <button type="button" onClick={() => insertBlock('code', currentNote.blocks.length)}>
                  <Code2 size={13} /> Add code
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="na-noselect">
            <FileText size={30} color={COLORS.inkFaint} />
            <div className="na-noselect-title na-serif">{ready ? 'No note selected' : 'Loading…'}</div>
            {ready && <button className="na-newbtn" style={{ width: 'auto' }} onClick={createNote} type="button"><Plus size={14} /> New note</button>}
          </div>
        )}
      </div>
    </div>
  );
}
