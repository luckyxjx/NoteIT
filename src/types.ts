// ─── Types ───────────────────────────────────────────────────────────────────

export type BlockType = 'text' | 'code';

export interface TextBlock {
  id: string;
  type: 'text';
  content: string;
}

export interface CodeBlock {
  id: string;
  type: 'code';
  language: string;
  content: string;
}

export interface DrawBlock {
  id: string;
  type: 'draw';
  content: string; // base64 PNG data URL
}

export type Block = TextBlock | CodeBlock | DrawBlock;

export interface Note {
  id: string;
  title: string;
  blocks: Block[];
  createdAt: number;
  updatedAt: number;
  drawLayer?: string; // base64 PNG — full-page stylus canvas overlay
}

export interface NoteIndexEntry {
  id: string;
  title: string;
  preview: string;
  updatedAt: number;
  blockCount: number;
}
