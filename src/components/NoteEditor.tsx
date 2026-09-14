import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Menu,
  Trash2,
  ChevronUp,
  ChevronDown,
  X,
  Type,
  Code2,
  FileText,
  Plus,
  NotebookPen,
  PenLine,
  Eraser,
  Pencil,
  Highlighter,
  Undo2,
} from 'lucide-react';
import type { Highlight, Note, BlockType, ToolVariant } from '../types';
import { TextBlock, CodeBlock } from './Blocks';
import { DrawBlock } from './DrawBlock';
import { InsertPoint } from './InsertPoint';
import { PageCanvas, type PageCanvasHandle } from './PageCanvas';

// ─── Palette ─────────────────────────────────────────────────────────────────
const PALETTE = [
  { label: 'Ink', value: '#3A2E27' },
  { label: 'Teal', value: '#5FBFB0' },
  { label: 'Amber', value: '#C9A876' },
  { label: 'Terracotta', value: '#B05A45' },
  { label: 'Sage', value: '#7A9E7A' },
  { label: 'Lavender', value: '#9B8EC4' },
];

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_HEIGHT_PX = 900;

interface Props {
  note: Note | null;
  noteId: string | null;
  ready: boolean;
  saveState: 'idle' | 'saving' | 'saved';
  onMenuOpen: () => void;
  onTitleChange: (t: string) => void;
  onDelete: () => void;
  onUpdateBlock: (blockId: string, patch: Partial<Note['blocks'][0]>) => void;
  onDeleteBlock: (blockId: string) => void;
  onMoveBlock: (blockId: string, dir: -1 | 1) => void;
  onInsertBlock: (type: BlockType, atIndex: number) => void;
  onNewNote: () => void;
  onUpdateDrawLayer: (dataUrl: string) => void;
}

const isTextHighlighterTarget = (target: EventTarget | null) =>
  target instanceof Element
    && target.closest('[data-text-block-id]') !== null;

// ─── Page break ──────────────────────────────────────────────────────────────
const PageBreak: React.FC<{ page: number }> = ({ page }) => (
  <div className="page-break" aria-hidden="true">
    <span className="page-break-label">page {page}</span>
  </div>
);

// ─── Main component ──────────────────────────────────────────────────────────
export const NoteEditor: React.FC<Props> = ({
  note,
  noteId,
  ready,
  saveState,
  onMenuOpen,
  onTitleChange,
  onDelete,
  onUpdateBlock,
  onDeleteBlock,
  onMoveBlock,
  onInsertBlock,
  onNewNote,
  onUpdateDrawLayer,
}) => {
  // ── Draw state ──────────────────────────────────────────────────────────
  const [drawMode, setDrawMode] = useState(false);
  const [toolVariant, setToolVariant] = useState<ToolVariant>('pen');
  const [drawColor, setDrawColor] = useState(PALETTE[0].value);
  const [drawSize, setDrawSize] = useState(2.5);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const pageCanvasRef = useRef<PageCanvasHandle | null>(null);
  const notebookContentRef = useRef<HTMLDivElement | null>(null);
  const activePointerId = useRef<number | null>(null);

  // ── Keyboard shortcut: Ctrl+Z / Cmd+Z for undo ─────────────────────────
  useEffect(() => {
    if (!drawMode) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        pageCanvasRef.current?.undo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [drawMode]);

  // ── Select a tool variant helper ────────────────────────────────────────
  const selectTool = useCallback((variant: ToolVariant) => {
    setToolVariant(variant);
  }, []);

  const selectColorAndPen = useCallback((color: string) => {
    setDrawColor(color);
    // If switching color, go back to last non-eraser tool (or pen)
    setToolVariant((prev) => prev === 'eraser' ? 'pen' : prev);
  }, []);

  // ── Empty / no note ─────────────────────────────────────────────────────
  if (!note || !noteId) {
    return (
      <div className="main empty-main-shell" role="main" aria-label="No note selected">
        <div className="note-toolbar slim">
          <button
            className="icon-btn menu-btn"
            type="button"
            onClick={onMenuOpen}
            aria-label="Open sidebar"
          >
            <Menu size={18} />
          </button>
        </div>
        <div className="empty-main">
          <div className="empty-main-icon">
            {ready ? <FileText size={26} /> : <NotebookPen size={26} />}
          </div>
          <div className="empty-main-title">
            {ready ? 'Pick a note or start fresh' : 'Loading your notes…'}
          </div>
          <p className="empty-main-sub">
            {ready ? 'this is your space.' : 'One moment…'}
          </p>
          {ready && (
            <button
              className="new-note-btn"
              style={{ width: 'auto', marginTop: 4 }}
              onClick={onNewNote}
              type="button"
            >
              <Plus size={15} /> New note
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Pointer events (seamless stylus) ────────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const isPen = e.pointerType === 'pen';
    const shouldDraw = isPen || (drawMode && e.pointerType !== 'touch');

    if (!shouldDraw) return;
    if (isPen && drawMode && toolVariant === 'highlighter' && isTextHighlighterTarget(e.target)) return;

    // Reject if another pointer is already active
    if (activePointerId.current !== null) return;
    activePointerId.current = e.pointerId;

    e.preventDefault();
    // Capture on canvas, not the wrapper div
    pageCanvasRef.current?.capturePointer(e.pointerId);
    pageCanvasRef.current?.startStroke(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only respond to the tracked pointer
    if (activePointerId.current === null || e.pointerId !== activePointerId.current) return;

    const isPen = e.pointerType === 'pen';
    if (isPen || drawMode) {
      e.preventDefault();
      pageCanvasRef.current?.moveStroke(e);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current === null || e.pointerId !== activePointerId.current) return;

    const isPen = e.pointerType === 'pen';
    if (isPen || drawMode) {
      e.preventDefault();
      pageCanvasRef.current?.releasePointer(e.pointerId);
      pageCanvasRef.current?.endStroke();
    }
    activePointerId.current = null;
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== null && e.pointerId === activePointerId.current) {
      // OS took over (e.g. handwriting overlay) — discard partial stroke + repaint
      pageCanvasRef.current?.cancelStroke();
      try { pageCanvasRef.current?.releasePointer(e.pointerId); } catch { /* noop */ }
      activePointerId.current = null;
    }
    // Repaint to clear any compositing residue from OS overlays
    pageCanvasRef.current?.repaintCanvas();
  };

  return (
    <main className="main" aria-label="Note editor">

      {/* ── Rich toolbar ───────────────────────────────────────────────── */}
      <div className="note-toolbar" role="toolbar" aria-label="Note toolbar">

        {/* Left: menu (mobile) */}
        <button
          className="icon-btn menu-btn"
          type="button"
          onClick={onMenuOpen}
          aria-label="Open sidebar"
        >
          <Menu size={18} />
        </button>

        <div className="toolbar-divider" />

        {/* Insert buttons */}
        <div className="toolbar-group" role="group" aria-label="Insert block">
          <button
            className="toolbar-btn"
            type="button"
            onClick={() => { setDrawMode(false); onInsertBlock('text', note.blocks.length); }}
            title="Add text block"
            aria-label="Add text block"
          >
            <Type size={14} />
            <span>Text</span>
          </button>
          <button
            className="toolbar-btn"
            type="button"
            onClick={() => { setDrawMode(false); onInsertBlock('code', note.blocks.length); }}
            title="Add code block"
            aria-label="Add code block"
          >
            <Code2 size={14} />
            <span>Code</span>
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Draw mode toggle */}
        <button
          id="draw-mode-toggle"
          className={`toolbar-btn draw-toggle${drawMode ? ' active' : ''}`}
          type="button"
          onClick={() => setDrawMode((d) => !d)}
          title={drawMode ? 'Switch to type mode' : 'Switch to draw mode'}
          aria-pressed={drawMode}
          aria-label="Toggle draw mode"
        >
          <PenLine size={14} />
          <span>{drawMode ? 'Drawing' : 'Draw'}</span>
        </button>

        {/* Draw tools — visible when draw mode active */}
        {drawMode && (
          <>
            <div className="toolbar-divider" />
            <div className="toolbar-group toolbar-draw-tools" role="group" aria-label="Drawing tools">

              {/* Tool variants */}
              <button
                type="button"
                className={`toolbar-btn${toolVariant === 'pen' ? ' active' : ''}`}
                onClick={() => selectTool('pen')}
                title="Pen"
                aria-label="Pen tool"
              >
                <PenLine size={14} />
              </button>
              <button
                type="button"
                className={`toolbar-btn${toolVariant === 'pencil' ? ' active' : ''}`}
                onClick={() => selectTool('pencil')}
                title="Pencil"
                aria-label="Pencil tool"
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                className={`toolbar-btn${toolVariant === 'highlighter' ? ' active' : ''}`}
                onClick={() => selectTool('highlighter')}
                title="Highlighter"
                aria-label="Highlighter tool"
              >
                <Highlighter size={14} />
              </button>
              <button
                type="button"
                className={`toolbar-btn${toolVariant === 'eraser' ? ' active' : ''}`}
                onClick={() => selectTool('eraser')}
                title="Eraser"
                aria-label="Eraser tool"
              >
                <Eraser size={14} />
              </button>

              <div className="toolbar-divider" />

              {/* Color swatches */}
              {PALETTE.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  className={`draw-swatch${drawColor === p.value && toolVariant !== 'eraser' ? ' active' : ''}`}
                  style={{ background: p.value }}
                  title={p.label}
                  aria-label={`${p.label} ink`}
                  onClick={() => selectColorAndPen(p.value)}
                />
              ))}

              {/* Size slider */}
              <input
                type="range"
                min={1}
                max={8}
                step={0.5}
                value={drawSize}
                onChange={(e) => setDrawSize(Number(e.target.value))}
                className="draw-size-slider"
                title={`Pen size: ${drawSize}`}
                aria-label="Pen size"
              />

              <div className="toolbar-divider" />

              {/* Undo */}
              <button
                type="button"
                className="toolbar-btn"
                onClick={() => pageCanvasRef.current?.undo()}
                title="Undo last stroke (Ctrl+Z)"
                aria-label="Undo stroke"
              >
                <Undo2 size={14} />
              </button>

              {/* Clear */}
              <button
                type="button"
                className="toolbar-btn"
                onClick={() => pageCanvasRef.current?.clear()}
                title="Clear all drawings on this page"
                aria-label="Clear page drawing"
              >
                <Trash2 size={14} />
                <span>Clear</span>
              </button>
            </div>
          </>
        )}

        {/* Spacer */}
        <span style={{ flex: 1 }} />

        {/* Right: save state + delete */}
        <div className="save-state" aria-live="polite" aria-atomic="true">
          {saveState === 'saving' && (
            <><span className="save-dot" />Saving…</>
          )}
          {saveState === 'saved' && 'Saved ✓'}
        </div>
        <button
          className="icon-btn danger"
          type="button"
          onClick={onDelete}
          aria-label="Delete this note"
          title="Delete note"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* ── Notebook scroll area ──────────────────────────────────────── */}
      <div className="notebook-scroll">
        <div className="notebook-page">
          <div className="spiral-col" aria-hidden="true" />

          <div
            className="notebook-content"
            ref={notebookContentRef}
            onPointerDownCapture={handlePointerDown}
            onPointerMoveCapture={handlePointerMove}
            onPointerUpCapture={handlePointerUp}
            onPointerCancelCapture={handlePointerCancel}
            style={{ touchAction: drawMode ? 'none' : 'auto' }}
          >

            {/* Title — first thing on the page */}
            <input
              id="note-title"
              className="page-title"
              placeholder="Untitled"
              value={note.title}
              onChange={(e) => onTitleChange(e.target.value)}
              aria-label="Note title"
            />
            <div className="page-title-rule" />

            <InsertPoint
              forced={note.blocks.length === 0}
              onInsert={(type) => onInsertBlock(type, 0)}
            />

            {note.blocks.map((block, i) => {
              // Page break detection
              const heightUpTo = note.blocks.slice(0, i + 1).reduce(
                (acc, b) => b.type === 'code' ? acc + 200 : b.type === 'draw' ? acc + 380 : acc + 90,
                120,
              );
              const heightPrev = note.blocks.slice(0, i).reduce(
                (acc, b) => b.type === 'code' ? acc + 200 : b.type === 'draw' ? acc + 380 : acc + 90,
                120,
              );
              const showBreak = Math.floor(heightUpTo / PAGE_HEIGHT_PX) > Math.floor(heightPrev / PAGE_HEIGHT_PX);

              return (
                <React.Fragment key={block.id}>
                  {showBreak && <PageBreak page={Math.floor(heightUpTo / PAGE_HEIGHT_PX) + 1} />}

                  <div className="block-wrapper">
                    <div className="block-controls">
                      <span className="block-tag">
                        {block.type === 'code' && <Code2 size={11} />}
                        {block.type === 'text' && <Type size={11} />}
                        {block.type === 'draw' && <PenLine size={11} />}
                        {block.type}
                      </span>
                      <button
                        className="icon-btn"
                        type="button"
                        onClick={() => onMoveBlock(block.id, -1)}
                        disabled={i === 0}
                        aria-label="Move block up"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        className="icon-btn"
                        type="button"
                        onClick={() => onMoveBlock(block.id, 1)}
                        disabled={i === note.blocks.length - 1}
                        aria-label="Move block down"
                      >
                        <ChevronDown size={14} />
                      </button>
                      <button
                        className="icon-btn danger"
                        type="button"
                        onClick={() => onDeleteBlock(block.id)}
                        aria-label="Delete block"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {block.type === 'code' ? (
                      <CodeBlock
                        block={block}
                        onChangeContent={(v) => onUpdateBlock(block.id, { content: v })}
                        onChangeLang={(v) => onUpdateBlock(block.id, { language: v })}
                      />
                    ) : block.type === 'draw' ? (
                      <DrawBlock
                        block={block}
                        onChange={(v) => onUpdateBlock(block.id, { content: v })}
                      />
                    ) : (
                      <TextBlock
                        block={block}
                        onChange={(v) => onUpdateBlock(block.id, { content: v })}
                        onChangeHighlights={(highlights: Highlight[]) => onUpdateBlock(block.id, { highlights })}
                        highlighterEnabled={drawMode && toolVariant === 'highlighter'}
                      />
                    )}
                  </div>

                  <InsertPoint onInsert={(type) => onInsertBlock(type, i + 1)} />
                </React.Fragment>
              );
            })}

            {/* Page canvas overlay — covers the whole content area */}
            <PageCanvas
              ref={pageCanvasRef}
              active={drawMode}
              toolVariant={toolVariant}
              color={drawColor}
              size={drawSize}
              noteId={noteId}
              initialDrawing={note.drawLayer}
              onChange={onUpdateDrawLayer}
              contentEl={notebookContentRef.current}
            />
          </div>
        </div>
      </div>
    </main>
  );
};
