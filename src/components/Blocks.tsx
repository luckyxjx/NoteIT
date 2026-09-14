import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import type {
  CodeBlock as CodeBlockType,
  Highlight,
  TextBlock as TextBlockType,
} from '../types';
import { AutoTextarea } from './AutoTextarea';
import { useTextHighlight } from '../hooks/useTextHighlight';

// ─── Text Block ───────────────────────────────────────────────────────────────
interface TextBlockProps {
  block: TextBlockType;
  onChange: (content: string) => void;
  onChangeHighlights: (highlights: Highlight[]) => void;
  highlighterEnabled: boolean;
}

const remapHighlightsForEdit = (
  oldText: string,
  newText: string,
  highlights: Highlight[],
) => {
  if (oldText === newText) return highlights;

  let prefix = 0;
  while (
    prefix < oldText.length
    && prefix < newText.length
    && oldText[prefix] === newText[prefix]
  ) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < oldText.length - prefix
    && suffix < newText.length - prefix
    && oldText[oldText.length - 1 - suffix] === newText[newText.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const oldEditEnd = oldText.length - suffix;
  const newEditEnd = newText.length - suffix;
  const delta = newText.length - oldText.length;

  return highlights
    .map((highlight) => {
      if (highlight.end <= prefix) return highlight;
      if (highlight.start >= oldEditEnd) {
        return {
          ...highlight,
          start: highlight.start + delta,
          end: highlight.end + delta,
        };
      }

      return {
        ...highlight,
        start: highlight.start < prefix ? highlight.start : prefix,
        end: highlight.end > oldEditEnd ? highlight.end + delta : newEditEnd,
      };
    })
    .map((highlight) => ({
      ...highlight,
      start: Math.max(0, Math.min(highlight.start, newText.length)),
      end: Math.max(0, Math.min(highlight.end, newText.length)),
    }))
    .filter((highlight) => highlight.start < highlight.end);
};

const renderFallbackText = (content: string, highlights: Highlight[]) => {
  const pieces: React.ReactNode[] = [];
  let cursor = 0;

  highlights.forEach((highlight) => {
    if (highlight.start > cursor) {
      pieces.push(content.slice(cursor, highlight.start));
    }
    pieces.push(
      <mark className="nb-highlight" key={highlight.id}>
        {content.slice(highlight.start, highlight.end)}
      </mark>,
    );
    cursor = highlight.end;
  });

  if (cursor < content.length) pieces.push(content.slice(cursor));
  return pieces.length > 0 ? pieces : null;
};

export const TextBlock: React.FC<TextBlockProps> = ({
  block,
  onChange,
  onChangeHighlights,
  highlighterEnabled,
}) => {
  const latestContent = useRef(block.content);
  const isComposing = useRef(false);
  const highlights = useMemo(() => block.highlights ?? [], [block.highlights]);
  const {
    rootRef,
    supportsCssHighlights,
    safeHighlights,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
  } = useTextHighlight({
    blockId: block.id,
    content: block.content,
    highlights,
    enabled: highlighterEnabled,
    onCommit: onChangeHighlights,
  });

  useLayoutEffect(() => {
    latestContent.current = block.content;
    const el = rootRef.current;
    if (!el || !supportsCssHighlights || document.activeElement === el) return;
    if (el.textContent !== block.content) {
      el.textContent = block.content;
    }
  }, [block.content, rootRef, supportsCssHighlights]);

  const handleInput = () => {
    if (isComposing.current) return;
    const nextContent = rootRef.current?.textContent ?? '';
    const remappedHighlights = remapHighlightsForEdit(latestContent.current, nextContent, highlights);
    latestContent.current = nextContent;
    onChange(nextContent);
    if (remappedHighlights !== highlights) onChangeHighlights(remappedHighlights);
  };

  const handleCompositionEnd = () => {
    isComposing.current = false;
    handleInput();
  };

  return (
    <div className="text-surface">
      <div
        ref={rootRef}
        className="text-editor"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        spellCheck
        data-placeholder="Write freely…"
        data-text-block-id={block.id}
        onInput={handleInput}
        onCompositionStart={() => { isComposing.current = true; }}
        onCompositionEnd={handleCompositionEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {supportsCssHighlights ? null : renderFallbackText(block.content, safeHighlights)}
      </div>
    </div>
  );
};

// ─── Code Block ───────────────────────────────────────────────────────────────
interface CodeBlockProps {
  block: CodeBlockType;
  onChangeContent: (content: string) => void;
  onChangeLang: (lang: string) => void;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  block,
  onChangeContent,
  onChangeLang,
}) => {
  const [copied, setCopied] = useState(false);

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(block.content || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard not available
    }
  };

  return (
    <div className="code-surface">
      <div className="code-head">
        <div className="code-head-dots">
          <span className="code-dot code-dot-red" />
          <span className="code-dot code-dot-yellow" />
          <span className="code-dot code-dot-green" />
        </div>
        <input
          value={block.language || ''}
          placeholder="language"
          onChange={(e) => onChangeLang(e.target.value)}
          aria-label="Code language"
        />
        <button
          className={`copy-btn${copied ? ' copied' : ''}`}
          onClick={doCopy}
          type="button"
          aria-label="Copy code"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <AutoTextarea
        value={block.content}
        placeholder="// paste or write code here"
        onChange={onChangeContent}
        spellCheck={false}
        className="na-mono"
      />
    </div>
  );
};
