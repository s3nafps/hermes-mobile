// A small markdown reader for chat replies. It covers what agents actually write:
// headings, paragraphs, bullet and numbered lists, quotes, fenced code, and inline
// bold, italic, code and links. Anything else is shown as plain text.

export type Block =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'code'; language: string; code: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'quote'; text: string };

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string }
  | { type: 'code'; text: string }
  | { type: 'link'; text: string; url: string };

const FENCE = /^```\s*(\S*)\s*$/;
const HEADING = /^(#{1,3})\s+(.*)$/;
const BULLET = /^\s*[-*]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;
const QUOTE = /^>\s?/;

function startsBlock(line: string): boolean {
  return FENCE.test(line) || HEADING.test(line) || BULLET.test(line) || NUMBERED.test(line) || QUOTE.test(line);
}

export function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    const fence = FENCE.exec(line);
    if (fence) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1; // The closing fence. An unclosed block runs to the end of the reply.
      blocks.push({ type: 'code', language: fence[1], code: code.join('\n') });
      continue;
    }

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length as 1 | 2 | 3, text: heading[2].trim() });
      i += 1;
      continue;
    }

    if (BULLET.test(line) || NUMBERED.test(line)) {
      const ordered = NUMBERED.test(line);
      const marker = ordered ? NUMBERED : BULLET;
      const items: string[] = [];
      while (i < lines.length && marker.test(lines[i])) {
        items.push(lines[i].replace(marker, ''));
        i += 1;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    if (QUOTE.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) {
        quoted.push(lines[i].replace(QUOTE, ''));
        i += 1;
      }
      blocks.push({ type: 'quote', text: quoted.join('\n') });
      continue;
    }

    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) {
      paragraph.push(lines[i]);
      i += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraph.join('\n') });
  }

  return blocks;
}

// Inline spans. Bold needs a closing pair on the same line; italic must not start with a
// space, so arithmetic such as "2 * 3 * 4" stays as written.
const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*(?!\s)[^*\n]+?\*)|(\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/g;
const LINK = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/;

export function parseInline(text: string): Inline[] {
  const spans: Inline[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > last) spans.push({ type: 'text', text: text.slice(last, index) });
    const token = match[0];
    if (token.startsWith('`')) {
      spans.push({ type: 'code', text: token.slice(1, -1) });
    } else if (token.startsWith('**')) {
      spans.push({ type: 'bold', text: token.slice(2, -2) });
    } else if (token.startsWith('[')) {
      const link = LINK.exec(token);
      if (link) spans.push({ type: 'link', text: link[1], url: link[2] });
      else spans.push({ type: 'text', text: token });
    } else {
      spans.push({ type: 'italic', text: token.slice(1, -1) });
    }
    last = index + token.length;
  }
  if (last < text.length) spans.push({ type: 'text', text: text.slice(last) });
  return spans;
}
