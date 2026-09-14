import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Highlight as StoredHighlight } from '../types';
import { genId } from '../utils';

type HighlightRegistry = {
  set: (name: string, value: unknown) => void;
  delete: (name: string) => void;
};

type CssWithHighlights = typeof CSS & {
  highlights?: HighlightRegistry;
};

type HighlightConstructor = new (...ranges: Range[]) => unknown;

type BlockRanges = {
  persisted: Range[];
  live: Range | null;
};

const HIGHLIGHT_NAME = 'noteit-text-highlight';
const blockRanges = new Map<string, BlockRanges>();

const hasCssHighlights = () => {
  if (typeof window === 'undefined') return false;
  const css = CSS as CssWithHighlights;
  return Boolean(css.highlights && 'Highlight' in window);
};

const refreshRegistry = () => {
  if (!hasCssHighlights()) return;
  const ranges: Range[] = [];
  blockRanges.forEach((entry) => {
    ranges.push(...entry.persisted);
    if (entry.live) ranges.push(entry.live);
  });

  const css = CSS as CssWithHighlights;
  if (ranges.length === 0) {
    css.highlights?.delete(HIGHLIGHT_NAME);
    return;
  }

  const HighlightCtor = window.Highlight as HighlightConstructor;
  css.highlights?.set(HIGHLIGHT_NAME, new HighlightCtor(...ranges));
};

const clampHighlights = (highlights: StoredHighlight[], contentLength: number) =>
  highlights
    .map((highlight) => ({
      ...highlight,
      start: Math.max(0, Math.min(highlight.start, contentLength)),
      end: Math.max(0, Math.min(highlight.end, contentLength)),
    }))
    .filter((highlight) => highlight.start < highlight.end);

const mergeHighlights = (highlights: StoredHighlight[]) => {
  const sorted = [...highlights]
    .filter((highlight) => highlight.start < highlight.end)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: StoredHighlight[] = [];

  sorted.forEach((highlight) => {
    const last = merged[merged.length - 1];
    if (!last || highlight.start > last.end) {
      merged.push({ ...highlight });
      return;
    }
    last.end = Math.max(last.end, highlight.end);
  });

  return merged;
};

const getTextNodes = (root: HTMLElement) => {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    nodes.push(node as Text);
    node = walker.nextNode();
  }
  return nodes;
};

const getNodeOffset = (root: HTMLElement, targetNode: Node, targetOffset: number) => {
  let offset = 0;
  const nodes = getTextNodes(root);

  for (const node of nodes) {
    if (node === targetNode) {
      return offset + Math.min(targetOffset, node.data.length);
    }
    if (node.parentNode === targetNode) {
      const children = Array.from(targetNode.childNodes);
      const childIndex = children.indexOf(node);
      if (childIndex >= targetOffset) return offset;
    }
    offset += node.data.length;
  }

  if (targetNode === root) {
    return Math.min(targetOffset, root.textContent?.length ?? 0);
  }

  return offset;
};

const getOffsetFromPoint = (root: HTMLElement, x: number, y: number) => {
  const doc = root.ownerDocument;
  const docWithCaret = doc as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };

  const caretRange = docWithCaret.caretRangeFromPoint?.(x, y);
  if (caretRange && root.contains(caretRange.startContainer)) {
    return getNodeOffset(root, caretRange.startContainer, caretRange.startOffset);
  }

  const caretPosition = docWithCaret.caretPositionFromPoint?.(x, y);
  if (caretPosition && root.contains(caretPosition.offsetNode)) {
    return getNodeOffset(root, caretPosition.offsetNode, caretPosition.offset);
  }

  const textLength = root.textContent?.length ?? 0;
  const rect = root.getBoundingClientRect();
  if (y <= rect.top) return 0;
  if (y >= rect.bottom) return textLength;
  return x < rect.left + rect.width / 2 ? 0 : textLength;
};

const getRangeFromOffsets = (root: HTMLElement, start: number, end: number) => {
  const textLength = root.textContent?.length ?? 0;
  const safeStart = Math.max(0, Math.min(start, textLength));
  const safeEnd = Math.max(0, Math.min(end, textLength));
  if (safeStart >= safeEnd) return null;

  const range = document.createRange();
  let pos = 0;
  let didStart = false;
  let didEnd = false;

  for (const node of getTextNodes(root)) {
    const next = pos + node.data.length;
    if (!didStart && safeStart <= next) {
      range.setStart(node, Math.max(0, safeStart - pos));
      didStart = true;
    }
    if (!didEnd && safeEnd <= next) {
      range.setEnd(node, Math.max(0, safeEnd - pos));
      didEnd = true;
      break;
    }
    pos = next;
  }

  if (!didStart || !didEnd) return null;
  return range;
};

interface Options {
  blockId: string;
  content: string;
  highlights: StoredHighlight[];
  enabled: boolean;
  onCommit: (highlights: StoredHighlight[]) => void;
}

export const useTextHighlight = ({
  blockId,
  content,
  highlights,
  enabled,
  onCommit,
}: Options) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const anchorOffset = useRef<number | null>(null);
  const activePointerId = useRef<number | null>(null);
  const [supportsCssHighlights] = useState(hasCssHighlights);

  const safeHighlights = useMemo(
    () => clampHighlights(highlights, content.length),
    [highlights, content.length],
  );

  useEffect(() => {
    if (!supportsCssHighlights) return;
    const root = rootRef.current;
    if (!root) return;

    const persisted = safeHighlights
      .map((highlight) => getRangeFromOffsets(root, highlight.start, highlight.end))
      .filter((range): range is Range => range !== null);

    blockRanges.set(blockId, {
      persisted,
      live: blockRanges.get(blockId)?.live ?? null,
    });
    refreshRegistry();

    return () => {
      blockRanges.delete(blockId);
      refreshRegistry();
    };
  }, [blockId, safeHighlights, supportsCssHighlights]);

  const setLiveRange = useCallback((range: Range | null) => {
    if (!supportsCssHighlights) return;
    const entry = blockRanges.get(blockId) ?? { persisted: [], live: null };
    entry.live = range;
    blockRanges.set(blockId, entry);
    refreshRegistry();
  }, [blockId, supportsCssHighlights]);

  const clearGesture = useCallback(() => {
    anchorOffset.current = null;
    activePointerId.current = null;
    setLiveRange(null);
  }, [setLiveRange]);

  const updateLiveHighlight = useCallback((focusOffset: number) => {
    const root = rootRef.current;
    const anchor = anchorOffset.current;
    if (!root || anchor === null) return null;

    const start = Math.min(anchor, focusOffset);
    const end = Math.max(anchor, focusOffset);
    const range = getRangeFromOffsets(root, start, end);
    setLiveRange(range);
    return { start, end };
  }, [setLiveRange]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled || e.pointerType !== 'pen') return;
    const root = rootRef.current;
    if (!root) return;

    const offset = getOffsetFromPoint(root, e.clientX, e.clientY);
    activePointerId.current = e.pointerId;
    anchorOffset.current = offset;
    e.preventDefault();
    e.stopPropagation();
    root.setPointerCapture(e.pointerId);
  }, [enabled]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    const root = rootRef.current;
    if (!root) return;

    e.preventDefault();
    e.stopPropagation();
    const focusOffset = getOffsetFromPoint(root, e.clientX, e.clientY);
    updateLiveHighlight(focusOffset);
  }, [updateLiveHighlight]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    const root = rootRef.current;
    if (!root) return;

    e.preventDefault();
    e.stopPropagation();
    const focusOffset = getOffsetFromPoint(root, e.clientX, e.clientY);
    const range = updateLiveHighlight(focusOffset);

    if (range && range.start < range.end) {
      onCommit(mergeHighlights([
        ...safeHighlights,
        { id: genId(), start: range.start, end: range.end },
      ]));
    }

    try { root.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    clearGesture();
  }, [clearGesture, onCommit, safeHighlights, updateLiveHighlight]);

  const handlePointerCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    try { rootRef.current?.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    clearGesture();
  }, [clearGesture]);

  return {
    rootRef,
    supportsCssHighlights,
    safeHighlights,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
  };
};
