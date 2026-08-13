import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from 'react';

export interface PageCanvasHandle {
  clear: () => void;
}

interface Props {
  active: boolean;
  tool: 'pen' | 'eraser';
  color: string;
  size: number;
  initialDrawing: string | undefined;
  onChange: (dataUrl: string) => void;
  /** The notebook-content element to size the canvas against */
  contentEl: HTMLDivElement | null;
}

const DPR = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 2, 3) : 2;

export const PageCanvas = forwardRef<PageCanvasHandle, Props>(
  ({ active, tool, color, size, initialDrawing, onChange, contentEl }, ref) => {
    const canvasRef    = useRef<HTMLCanvasElement>(null);
    const isDrawing    = useRef(false);
    const lastPt       = useRef<{ x: number; y: number } | null>(null);
    const savedDataUrl = useRef<string | undefined>(initialDrawing);
    const isInited     = useRef(false);

    // ── Expose clear() ───────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      clear() {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        savedDataUrl.current = undefined;
        onChange(canvas.toDataURL('image/png'));
      },
    }));

    // ── Size canvas to content element, restore drawing ──────────────────────
    const initCanvas = (canvas: HTMLCanvasElement, el: HTMLDivElement) => {
      const cssW = el.offsetWidth;
      const cssH = Math.max(el.scrollHeight, el.offsetHeight, 600);

      canvas.style.width  = cssW  + 'px';
      canvas.style.height = cssH  + 'px';

      const prev = canvas.width > 0 ? canvas.toDataURL() : null;

      canvas.width  = cssW * DPR;
      canvas.height = cssH * DPR;

      const ctx = canvas.getContext('2d')!;
      ctx.scale(DPR, DPR);

      // Restore: prefer saved content, then the stored note drawing, then prev
      const src = savedDataUrl.current ?? (prev && prev !== 'data:,') ? (savedDataUrl.current ?? prev) : null;
      if (src) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, cssW, cssH);
        img.src = src;
      }
    };

    useLayoutEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || !contentEl) return;
      if (!isInited.current) {
        isInited.current = true;
        // Load the persisted drawLayer on first mount
        if (initialDrawing) {
          savedDataUrl.current = initialDrawing;
        }
      }
      initCanvas(canvas, contentEl);
    }, [contentEl]); // eslint-disable-line

    // Resize observer — refit canvas when content grows
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || !contentEl) return;
      const ro = new ResizeObserver(() => {
        // Save before resize
        savedDataUrl.current = canvas.toDataURL();
        initCanvas(canvas, contentEl);
      });
      ro.observe(contentEl);
      return () => ro.disconnect();
    }, [contentEl]); // eslint-disable-line

    // Re-load when note switches (initialDrawing changes)
    const prevNoteDrawing = useRef(initialDrawing);
    useEffect(() => {
      if (prevNoteDrawing.current === initialDrawing) return;
      prevNoteDrawing.current = initialDrawing;
      savedDataUrl.current = initialDrawing;
      isInited.current = false;

      const canvas = canvasRef.current;
      if (!canvas || !contentEl) return;
      initCanvas(canvas, contentEl);
    }, [initialDrawing]); // eslint-disable-line

    // ── Coordinate helper ────────────────────────────────────────────────────
    const getXY = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current!;
      const rect   = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left),
        y: (e.clientY - rect.top),
      };
    };

    const drawSegment = (
      ctx: CanvasRenderingContext2D,
      from: { x: number; y: number },
      to:   { x: number; y: number },
      pressure: number,
    ) => {
      const isErase = tool === 'eraser';
      const baseW   = isErase ? 28 : size;
      const w       = isErase ? baseW : Math.max(0.5, baseW * (0.3 + pressure * 1.4));

      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.strokeStyle   = isErase ? 'rgba(0,0,0,1)' : color;
      ctx.lineWidth     = w;
      ctx.lineCap       = 'round';
      ctx.lineJoin      = 'round';

      if (isErase) {
        const prev = ctx.globalCompositeOperation;
        ctx.globalCompositeOperation = 'destination-out';
        ctx.stroke();
        ctx.globalCompositeOperation = prev;
      } else {
        ctx.stroke();
      }
    };

    // ── Pointer events ───────────────────────────────────────────────────────
    const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!active) return;
      e.preventDefault();
      canvasRef.current!.setPointerCapture(e.pointerId);
      isDrawing.current = true;
      const pt = getXY(e);
      lastPt.current = pt;

      const ctx = canvasRef.current!.getContext('2d')!;
      const p   = e.pressure > 0 ? e.pressure : 0.5;
      drawSegment(ctx, pt, pt, p);
    };

    const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!active || !isDrawing.current || !lastPt.current) return;
      e.preventDefault();
      const ctx = canvasRef.current!.getContext('2d')!;
      const pt  = getXY(e);
      const p   = e.pressure > 0 ? e.pressure : 0.5;
      drawSegment(ctx, lastPt.current, pt, p);
      lastPt.current = pt;
    };

    const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing.current) return;
      isDrawing.current = false;
      lastPt.current    = null;
      const dataUrl = canvasRef.current!.toDataURL('image/png');
      savedDataUrl.current = dataUrl;
      onChange(dataUrl);
    };

    return (
      <canvas
        ref={canvasRef}
        className={`page-canvas${active ? ' draw-active' : ''}`}
        style={{
          cursor: active
            ? (tool === 'eraser' ? 'cell' : 'crosshair')
            : 'default',
          touchAction: active ? 'none' : 'auto',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
        aria-hidden="true"
      />
    );
  },
);

PageCanvas.displayName = 'PageCanvas';
