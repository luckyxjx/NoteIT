import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useCallback,
} from 'react';
import type { ToolVariant } from '../types';

// ─── Public handle ────────────────────────────────────────────────────────────
export interface PageCanvasHandle {
  clear: () => void;
  undo: () => void;
  repaintCanvas: () => void;
  startStroke: (e: React.PointerEvent<HTMLElement>) => void;
  moveStroke: (e: React.PointerEvent<HTMLElement>) => void;
  endStroke: () => void;
  cancelStroke: () => void;
  capturePointer: (pointerId: number) => void;
  releasePointer: (pointerId: number) => void;
}

interface Props {
  active: boolean;
  toolVariant: ToolVariant;
  color: string;
  size: number;
  noteId: string;
  initialDrawing: string | undefined;
  onChange: (dataUrl: string) => void;
  contentEl: HTMLDivElement | null;
}

const DPR = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 2, 3) : 2;
const UNDO_CAP = 30;
const SAVE_DEBOUNCE_MS = 1500;

export const PageCanvas = forwardRef<PageCanvasHandle, Props>(
  ({ active, toolVariant, color, size, noteId, initialDrawing, onChange, contentEl }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef(false);
    const lastPt = useRef<{ x: number; y: number } | null>(null);
    const savedDataUrl = useRef<string | undefined>(initialDrawing);
    const resizeTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isInited = useRef(false);

    // ── Undo stack ──────────────────────────────────────────────────────────
    const strokeHistory = useRef<string[]>([]);

    // ── Debounced save ──────────────────────────────────────────────────────
    const pendingSave = useRef<string | null>(null);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const flushSave = useCallback(() => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (pendingSave.current !== null) {
        onChange(pendingSave.current);
        pendingSave.current = null;
      }
    }, [onChange]);

    const debouncedSave = useCallback((dataUrl: string) => {
      pendingSave.current = dataUrl;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        if (pendingSave.current !== null) {
          onChange(pendingSave.current);
          pendingSave.current = null;
        }
      }, SAVE_DEBOUNCE_MS);
    }, [onChange]);

    // Flush on unmount
    useEffect(() => {
      return () => { flushSave(); };
    }, [flushSave]);

    // Flush on beforeunload
    useEffect(() => {
      const handler = () => { flushSave(); };
      window.addEventListener('beforeunload', handler);
      return () => window.removeEventListener('beforeunload', handler);
    }, [flushSave]);

    // ── Coordinate helper ───────────────────────────────────────────────────
    const getXY = useCallback((e: React.PointerEvent<HTMLElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }, []);

    // ── Draw segment (varies by tool variant) ───────────────────────────────
    const drawSegment = useCallback((
      ctx: CanvasRenderingContext2D,
      from: { x: number; y: number },
      to: { x: number; y: number },
      pressure: number,
    ) => {
      ctx.save();

      switch (toolVariant) {
        case 'eraser': {
          const w = 28;
          ctx.globalCompositeOperation = 'destination-out';
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(to.x, to.y);
          ctx.strokeStyle = 'rgba(0,0,0,1)';
          ctx.lineWidth = w;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();
          break;
        }
        case 'pencil': {
          const baseW = Math.max(1, size * 0.6);
          const w = Math.max(0.3, baseW * (0.2 + pressure * 0.8));
          ctx.globalAlpha = 0.55;
          ctx.globalCompositeOperation = 'source-over';
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(to.x, to.y);
          ctx.strokeStyle = color;
          ctx.lineWidth = w;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();
          break;
        }
        case 'highlighter': {
          const w = 18;
          ctx.globalAlpha = 0.28;
          ctx.globalCompositeOperation = 'multiply';
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(to.x, to.y);
          ctx.strokeStyle = color;
          ctx.lineWidth = w;
          ctx.lineCap = 'square';
          ctx.lineJoin = 'bevel';
          ctx.stroke();
          break;
        }
        default: { // pen
          const baseW = size;
          const w = Math.max(0.5, baseW * (0.3 + pressure * 1.4));
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(to.x, to.y);
          ctx.strokeStyle = color;
          ctx.lineWidth = w;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();
          break;
        }
      }

      ctx.restore();
    }, [toolVariant, color, size]);

    // ── Resize canvas — synchronous pixel-safe path (for live content growth) ─
    // We NEVER use img.onload here because setting canvas.width/height always
    // clears the bitmap, and async restoration loses races against rapid
    // ResizeObserver callbacks. Instead we capture/restore pixels synchronously.
    const resizeCanvas = useCallback((canvas: HTMLCanvasElement, el: HTMLDivElement) => {
      const cssW = el.offsetWidth;
      const cssH = Math.max(el.scrollHeight, el.offsetHeight, 600);
      const newW  = Math.round(cssW * DPR);
      const newH  = Math.round(cssH * DPR);

      // Nothing to do if dimensions haven't changed
      if (canvas.width === newW && canvas.height === newH) return;

      // Capture existing pixels synchronously BEFORE blanking
      const ctx = canvas.getContext('2d')!;
      let snapshot: ImageData | null = null;
      if (canvas.width > 0 && canvas.height > 0) {
        try { snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height); } catch { /* cross-origin guard */ }
      }

      // Set new dimensions (this erases the canvas)
      canvas.style.width  = cssW + 'px';
      canvas.style.height = cssH + 'px';
      canvas.width  = newW;
      canvas.height = newH;

      // Restore pixels and re-apply DPR scale — all synchronous, no race
      ctx.scale(DPR, DPR);
      if (snapshot) {
        ctx.putImageData(snapshot, 0, 0);
      }

      // Update savedDataUrl so the debounced save has the correct latest state
      savedDataUrl.current = canvas.toDataURL('image/png');
    }, []);

    // ── Load from URL — async path, used only for initial mount from storage ─
    const loadFromUrl = useCallback((canvas: HTMLCanvasElement, el: HTMLDivElement, src: string) => {
      const cssW = el.offsetWidth;
      const cssH = Math.max(el.scrollHeight, el.offsetHeight, 600);
      canvas.style.width  = cssW + 'px';
      canvas.style.height = cssH + 'px';
      canvas.width  = Math.round(cssW * DPR);
      canvas.height = Math.round(cssH * DPR);
      const ctx = canvas.getContext('2d')!;
      ctx.scale(DPR, DPR);
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, cssW, cssH);
      img.src = src;
    }, []);

    // ── Repaint from saved state (clears residue) ───────────────────────────
    const repaintCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas || !contentEl) return;
      if (savedDataUrl.current) {
        loadFromUrl(canvas, contentEl, savedDataUrl.current);
      }
    }, [contentEl, loadFromUrl]);

    // ── Expose handle ───────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      clear() {
        const canvas = canvasRef.current;
        if (!canvas) return;
        // Push current state to undo before clearing
        const currentData = canvas.toDataURL();
        if (strokeHistory.current.length < UNDO_CAP) {
          strokeHistory.current.push(currentData);
        } else {
          strokeHistory.current.shift();
          strokeHistory.current.push(currentData);
        }
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        savedDataUrl.current = undefined;
        const dataUrl = canvas.toDataURL('image/png');
        debouncedSave(dataUrl);
      },

      undo() {
        const canvas = canvasRef.current;
        if (!canvas || !contentEl || strokeHistory.current.length === 0) return;
        const prev = strokeHistory.current.pop()!;
        savedDataUrl.current = prev;
        loadFromUrl(canvas, contentEl, prev);
        debouncedSave(prev);
      },

      repaintCanvas() {
        repaintCanvas();
      },

      startStroke(e) {
        // Push snapshot for undo before starting
        const canvas = canvasRef.current;
        if (canvas) {
          const snap = canvas.toDataURL();
          if (strokeHistory.current.length >= UNDO_CAP) {
            strokeHistory.current.shift();
          }
          strokeHistory.current.push(snap);
        }
        isDrawing.current = true;
        const pt = getXY(e);
        lastPt.current = pt;
        const ctx = canvasRef.current!.getContext('2d')!;
        const p = e.pressure > 0 ? e.pressure : 0.5;
        drawSegment(ctx, pt, pt, p);
      },

      moveStroke(e) {
        if (!isDrawing.current || !lastPt.current) return;
        const ctx = canvasRef.current!.getContext('2d')!;
        const pt = getXY(e);
        const p = e.pressure > 0 ? e.pressure : 0.5;
        drawSegment(ctx, lastPt.current, pt, p);
        lastPt.current = pt;
      },

      endStroke() {
        if (!isDrawing.current) return;
        isDrawing.current = false;
        lastPt.current = null;
        const dataUrl = canvasRef.current!.toDataURL('image/png');
        savedDataUrl.current = dataUrl;
        debouncedSave(dataUrl);
      },

      cancelStroke() {
        if (!isDrawing.current) return;
        isDrawing.current = false;
        lastPt.current = null;
        // Discard partial stroke — restore from last snapshot
        if (strokeHistory.current.length > 0) {
          const lastSnap = strokeHistory.current.pop()!;
          savedDataUrl.current = lastSnap;
          if (canvasRef.current && contentEl) {
            loadFromUrl(canvasRef.current, contentEl, lastSnap);
          }
        } else {
          repaintCanvas();
        }
      },

      capturePointer(pointerId: number) {
        canvasRef.current?.setPointerCapture(pointerId);
      },

      releasePointer(pointerId: number) {
        try { canvasRef.current?.releasePointerCapture(pointerId); } catch { /* noop */ }
      },
    }), [getXY, drawSegment, debouncedSave, repaintCanvas, loadFromUrl, contentEl]);

    // ── Initial mount ───────────────────────────────────────────────────────
    useLayoutEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || !contentEl) return;
      if (isInited.current) return;
      isInited.current = true;

      if (initialDrawing) {
        savedDataUrl.current = initialDrawing;
        // Load from saved PNG — async is fine here, canvas is blank at mount
        loadFromUrl(canvas, contentEl, initialDrawing);
      } else {
        // Fresh canvas — just size it
        resizeCanvas(canvas, contentEl);
      }
    }, [contentEl, loadFromUrl, resizeCanvas]); // eslint-disable-line

    // ── Resize observer — debounced, synchronous pixel restore ──────────────
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || !contentEl) return;
      const ro = new ResizeObserver(() => {
        // Debounce: wait for layout to settle before resizing
        if (resizeTimer.current) clearTimeout(resizeTimer.current);
        resizeTimer.current = setTimeout(() => {
          resizeTimer.current = null;
          resizeCanvas(canvas, contentEl);
        }, 150);
      });
      ro.observe(contentEl);
      return () => {
        ro.disconnect();
        if (resizeTimer.current) clearTimeout(resizeTimer.current);
      };
    }, [contentEl, resizeCanvas]);

    // ── Note switch: flush old note, load new note ──────────────────────────
    const prevNoteId = useRef(noteId);
    useEffect(() => {
      if (prevNoteId.current === noteId) return;

      // Flush any pending save for the PREVIOUS note before switching
      flushSave();
      // Cancel any pending resize for the old note
      if (resizeTimer.current) { clearTimeout(resizeTimer.current); resizeTimer.current = null; }

      // Reset for new note
      prevNoteId.current = noteId;
      savedDataUrl.current = initialDrawing;
      strokeHistory.current = [];
      isInited.current = false;

      const canvas = canvasRef.current;
      if (!canvas || !contentEl) return;

      if (initialDrawing) {
        loadFromUrl(canvas, contentEl, initialDrawing);
      } else {
        resizeCanvas(canvas, contentEl);
        // Clear any leftover pixels from the previous note
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }, [noteId, initialDrawing, flushSave, contentEl, loadFromUrl, resizeCanvas]);

    // ── Render ──────────────────────────────────────────────────────────────
    return (
      <canvas
        ref={canvasRef}
        className={`page-canvas${active ? ' draw-active' : ''}`}
        style={{
          cursor: active
            ? (toolVariant === 'eraser' ? 'cell' : 'crosshair')
            : 'default',
          touchAction: active ? 'none' : 'auto',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      />
    );
  },
);

PageCanvas.displayName = 'PageCanvas';
