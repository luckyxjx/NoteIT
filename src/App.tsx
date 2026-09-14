import { useState, useEffect, useRef, useCallback } from 'react';
import './index.css';
import type { Note, NoteIndexEntry, Block, BlockType } from './types';
import { storage, genId } from './utils';
import { Sidebar } from './components/Sidebar';
import { NoteEditor } from './components/NoteEditor';
import { DeleteDialog } from './components/DeleteDialog';

// ─── Welcome note ────────────────────────────────────────────────────────────
const makeWelcomeNote = (): Note => {
  const id = genId();
  const now = Date.now();
  return {
    id,
    title: 'Welcome ✦ your notebook is ready',
    createdAt: now,
    updatedAt: now,
    blocks: [
      {
        id: genId(),
        type: 'text',
        highlights: [],
        content:
          'This is a text block — like a sticky note on your desk. Write anything here: thoughts, plans, lists, little things you want to remember. It grows as you type.',
      },
      {
        id: genId(),
        type: 'code',
        language: 'typescript',
        content:
          "// This is a code block.\n// It never gets reformatted.\nfunction greet(name: string): string {\n  return `Hello, ${name}! Welcome to NOTEit.`;\n}\n\nconsole.log(greet('World'));",
      },
      {
        id: genId(),
        type: 'text',
        highlights: [],
        content:
          'Use the + between blocks to mix text and code and draw in any order you like. Everything saves automatically — just write.',
      },
    ],
  };
};

// ─── Index entry builder ──────────────────────────────────────────────────────
const toIndexEntry = (note: Note): NoteIndexEntry => {
  const firstWithContent = note.blocks.find((b) => b.content.trim().length > 0);
  const preview = firstWithContent
    ? firstWithContent.type === 'code'
      ? '</> ' + firstWithContent.content.replace(/\s+/g, ' ').trim().slice(0, 70)
      : firstWithContent.content.replace(/\s+/g, ' ').trim().slice(0, 90)
    : '';
  return {
    id: note.id,
    title: note.title,
    preview,
    updatedAt: note.updatedAt,
    blockCount: note.blocks.length,
  };
};

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [notes, setNotes] = useState<NoteIndexEntry[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [query, setQuery] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [ready, setReady] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSave = useRef(false);

  // ── Boot: load index from localStorage ──────────────────────────────────
  useEffect(() => {
    const raw = storage.get('notes-index');
    let list: NoteIndexEntry[] = raw ? JSON.parse(raw) : [];

    if (list.length === 0) {
      // First launch — seed welcome note
      const welcome = makeWelcomeNote();
      storage.set('note:' + welcome.id, JSON.stringify(welcome));
      list = [toIndexEntry(welcome)];
      storage.set('notes-index', JSON.stringify(list));
      setNotes(list);
      skipSave.current = true;
      setCurrentId(welcome.id);
      setCurrentNote(welcome);
    } else {
      setNotes(list);
    }
    setReady(true);
  }, []);

  // ── Persist index ────────────────────────────────────────────────────────
  const persistIndex = useCallback((note: Note) => {
    setNotes((prev) => {
      const entry = toIndexEntry(note);
      const others = prev.filter((n) => n.id !== note.id);
      const next = [entry, ...others].sort((a, b) => b.updatedAt - a.updatedAt);
      storage.set('notes-index', JSON.stringify(next));
      return next;
    });
  }, []);

  // ── Auto-save on change ──────────────────────────────────────────────────
  useEffect(() => {
    if (!currentNote) return;
    if (skipSave.current) { skipSave.current = false; return; }

    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(() => {
      const updated: Note = { ...currentNote, updatedAt: Date.now() };
      storage.set('note:' + updated.id, JSON.stringify(updated));
      persistIndex(updated);
      setSaveState('saved');
    }, 450);

    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [currentNote, persistIndex]);

  // ── Open a note ──────────────────────────────────────────────────────────
  const openNote = useCallback((id: string) => {
    if (id === currentId) { setMobileOpen(false); return; }
    const raw = storage.get('note:' + id);
    if (raw) {
      skipSave.current = true;
      setCurrentNote(JSON.parse(raw));
      setCurrentId(id);
    }
    setMobileOpen(false);
  }, [currentId]);

  // ── Create note ──────────────────────────────────────────────────────────
  const createNote = useCallback(() => {
    const now = Date.now();
    const note: Note = {
      id: genId(),
      title: '',
      createdAt: now,
      updatedAt: now,
      blocks: [{ id: genId(), type: 'text', content: '', highlights: [] }],
    };
    storage.set('note:' + note.id, JSON.stringify(note));
    skipSave.current = true;
    persistIndex(note);
    setCurrentId(note.id);
    setCurrentNote(note);
    setMobileOpen(false);
  }, [persistIndex]);

  // ── Delete note ──────────────────────────────────────────────────────────
  const deleteNote = useCallback((id: string) => {
    storage.delete('note:' + id);
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== id);
      storage.set('notes-index', JSON.stringify(next));
      return next;
    });
    if (id === currentId) {
      const remaining = notes.filter((n) => n.id !== id);
      if (remaining.length > 0) {
        openNote(remaining[0].id);
      } else {
        setCurrentId(null);
        setCurrentNote(null);
      }
    }
  }, [currentId, notes, openNote]);

  // ── Open delete dialog (from toolbar) ────────────────────────────────────
  const requestDeleteCurrentNote = useCallback(() => {
    if (!currentNote) return;
    setConfirmOpen(true);
  }, [currentNote]);

  const confirmDeleteCurrentNote = useCallback(() => {
    if (!currentNote) return;
    setConfirmOpen(false);
    deleteNote(currentNote.id);
  }, [currentNote, deleteNote]);

  // ── Block helpers ────────────────────────────────────────────────────────
  const updateBlock = useCallback((blockId: string, patch: Partial<Block>) => {
    setCurrentNote((prev) =>
      prev
        ? { ...prev, blocks: prev.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } as Block : b)) }
        : prev
    );
  }, []);

  const deleteBlock = useCallback((blockId: string) => {
    setCurrentNote((prev) => {
      if (!prev) return prev;
      if (prev.blocks.length <= 1)
        return {
          ...prev,
          blocks: [
            prev.blocks[0].type === 'text'
              ? { ...prev.blocks[0], content: '', highlights: [] }
              : { ...prev.blocks[0], content: '' },
          ],
        };
      return { ...prev, blocks: prev.blocks.filter((b) => b.id !== blockId) };
    });
  }, []);

  const moveBlock = useCallback((blockId: string, dir: -1 | 1) => {
    setCurrentNote((prev) => {
      if (!prev) return prev;
      const idx = prev.blocks.findIndex((b) => b.id === blockId);
      const swap = idx + dir;
      if (swap < 0 || swap >= prev.blocks.length) return prev;
      const blocks = [...prev.blocks];
      [blocks[idx], blocks[swap]] = [blocks[swap], blocks[idx]];
      return { ...prev, blocks };
    });
  }, []);

  const insertBlock = useCallback((type: BlockType, atIndex: number) => {
    setCurrentNote((prev) => {
      if (!prev) return prev;
      const newBlock: Block =
        type === 'code'
          ? { id: genId(), type: 'code', language: '', content: '' }
          : type === 'draw'
            ? { id: genId(), type: 'draw', content: '' }
            : { id: genId(), type: 'text', content: '', highlights: [] };
      const blocks = [...prev.blocks];
      blocks.splice(atIndex, 0, newBlock);
      return { ...prev, blocks };
    });
  }, []);

  const updateTitle = useCallback((title: string) => {
    setCurrentNote((prev) => (prev ? { ...prev, title } : prev));
  }, []);

  const updateDrawLayer = useCallback((drawLayer: string) => {
    setCurrentNote((prev) => (prev ? { ...prev, drawLayer } : prev));
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="app-shell">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="overlay"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar
        notes={notes}
        currentId={currentId}
        query={query}
        ready={ready}
        isOpen={mobileOpen}
        onQuery={setQuery}
        onSelect={openNote}
        onNew={createNote}
        onClose={() => setMobileOpen(false)}
      />

      <DeleteDialog
        isOpen={confirmOpen}
        noteTitle={currentNote?.title ?? ''}
        onConfirm={confirmDeleteCurrentNote}
        onCancel={() => setConfirmOpen(false)}
      />

      <NoteEditor
        note={currentNote}
        noteId={currentId}
        ready={ready}
        saveState={saveState}
        onMenuOpen={() => setMobileOpen(true)}
        onTitleChange={updateTitle}
        onDelete={requestDeleteCurrentNote}
        onUpdateBlock={updateBlock}
        onDeleteBlock={deleteBlock}
        onMoveBlock={moveBlock}
        onInsertBlock={insertBlock}
        onNewNote={createNote}
        onUpdateDrawLayer={updateDrawLayer}
      />
    </div>
  );
}
