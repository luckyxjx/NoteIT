import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import type { CodeBlock as CodeBlockType, TextBlock as TextBlockType } from '../types';
import { AutoTextarea } from './AutoTextarea';

// ─── Text Block ───────────────────────────────────────────────────────────────
interface TextBlockProps {
  block: TextBlockType;
  onChange: (content: string) => void;
}

export const TextBlock: React.FC<TextBlockProps> = ({ block, onChange }) => (
  <div className="text-surface">
    <AutoTextarea
      value={block.content}
      placeholder="Write freely…"
      onChange={onChange}
    />
  </div>
);

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
