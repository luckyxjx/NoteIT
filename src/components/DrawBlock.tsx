import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Pencil, Eraser, Trash2, PenLine } from 'lucide-react';
import type { DrawBlock as DrawBlockType } from '../types';

// ─── Palette ────────────────────────────────────────────────────────────────
const PALETTE = [
  { label: 'Ink',       value: '#3A2E27' },
  { label: 'Teal',      value: '#5FBFB0' },
  { label: 'Amber',     value: '#C9A876' },
  { label: 'Terracotta', value: '#B05A45' },
  { label: 'Sage',      value: '#7A9E7A' },
  { label: 'Lavender',  value: '#9B8EC4' },
];

// ─── Canvas resolution ───────────────────────────────────────────────────────
const CANVAS_H = 320; // internal px height
const CANVAS_SCALE = 2; // 2× for retina / hi-DPI stylus

interface Props {
  block: DrawBlockType;
  onChange: (content: string) => void;
}

export const DrawBlock: React.FC<Props> = ({ block, onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef   = useRef<HTMLDivElement>(null);
  const [tool, setTool]   = useState<'pen' | 'eraser'>('pen');
  const [color, setColor] = useState(PALETTE[0].value);
  const [size, setSize]   = useState(2);
  const isDrawing = useRef(false);
  const lastPt    = useRef<{ x: number; y: number } | null>(null);
  const initialized = useRef(false);

  // ── Set canvas internal width to match container, then load content ────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap   = wrapRef.current;
    if (!canvas || !wrap || initialized.current) return;
    initialized.current = true;

    const W = Math.round(wrap.clientWidth * CANVAS_SCALE || 800 * CANVAS_SCALE);
    const H = CANVAS_H * CANVAS_SCALE;
    canvas.width  = W;
    canvas.height = H;

    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#F1E6D8';
    ctx.fillRect(0, 0, W, H);

    if (block.content) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, W, H);
      img.src = block.content;
    }
  }, []); // eslint-disable-line

  // ── Coordinate mapping (accounts for CSS scaling) ─────────────────────────
  const getXY = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left)  * (canvas.width  / rect.width),
      y: (e.clientY - rect.top)   * (canvas.height / rect.height),
    };
  }, []);

  // ── Draw ──────────────────────────────────────────────────────────────────
  const draw = useCallback((
    ctx: CanvasRenderingContext2D,
    from: { x: number; y: number },
    to:   { x: number; y: number },
    pressure: number,
  ) => {
    const isEraser = tool === 'eraser';
    const baseW = isEraser ? 24 : size * CANVAS_SCALE;
    const w = isEraser ? baseW : Math.max(1, baseW * (0.4 + pressure * 1.2));

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.strokeStyle = isEraser ? '#F1E6D8' : color;
    ctx.lineWidth   = w;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.stroke();
  }, [tool, color, size]);

  // ── Pointer events ────────────────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current!;
    canvas.setPointerCapture(e.pointerId);
    isDrawing.current = true;
    const pt = getXY(e);
    lastPt.current = pt;

    // Dot for tap
    const ctx = canvas.getContext('2d')!;
    const p = e.pressure > 0 ? e.pressure : 0.5;
    draw(ctx, pt, pt, p);
  }, [getXY, draw]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || !lastPt.current) return;
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pt = getXY(e);
    const p  = e.pressure > 0 ? e.pressure : 0.5;
    draw(ctx, lastPt.current, pt, p);
    lastPt.current = pt;
  }, [getXY, draw]);

  const onPointerUp = useCallback(() => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    lastPt.current    = null;
    const canvas = canvasRef.current!;
    onChange(canvas.toDataURL('image/png'));
  }, [onChange]);

  // ── Clear ─────────────────────────────────────────────────────────────────
  const clear = useCallback(() => {
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext('2d')!;
    ctx.fillStyle = '#F1E6D8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onChange(canvas.toDataURL('image/png'));
  }, [onChange]);

  return (
    <div className="draw-surface" ref={wrapRef}>
      {/* Toolbar */}
      <div className="draw-toolbar">
        <PenLine size={13} style={{ color: 'var(--cream-meta)', flexShrink: 0 }} />

        {/* Color palette */}
        <div className="draw-palette">
          {PALETTE.map((p) => (
            <button
              key={p.value}
              type="button"
              className={`draw-swatch${color === p.value && tool === 'pen' ? ' active' : ''}`}
              style={{ background: p.value }}
              title={p.label}
              onClick={() => { setColor(p.value); setTool('pen'); }}
              aria-label={p.label}
            />
          ))}
        </div>

        {/* Size */}
        <input
          type="range"
          min={1}
          max={8}
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          className="draw-size-slider"
          title="Pen size"
          aria-label="Pen size"
        />

        <div className="draw-divider" />

        {/* Tools */}
        <button
          type="button"
          className={`draw-tool-btn${tool === 'pen' ? ' active' : ''}`}
          onClick={() => setTool('pen')}
          title="Pen"
          aria-label="Pen tool"
        >
          <Pencil size={13} />
        </button>
        <button
          type="button"
          className={`draw-tool-btn${tool === 'eraser' ? ' active' : ''}`}
          onClick={() => setTool('eraser')}
          title="Eraser"
          aria-label="Eraser tool"
        >
          <Eraser size={13} />
        </button>
        <button
          type="button"
          className="draw-tool-btn"
          onClick={clear}
          title="Clear canvas"
          aria-label="Clear drawing"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="draw-canvas"
        style={{ touchAction: 'none', cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
        aria-label="Drawing canvas"
      />
    </div>
  );
};
