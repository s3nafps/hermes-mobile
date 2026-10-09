import { describe, expect, it } from 'vitest';

import { parseBlocks, parseInline } from './markdown';
import { userVisibleText } from './userText';

describe('parseBlocks', () => {
  it('reads headings, paragraphs and lists', () => {
    const blocks = parseBlocks('# Title\n\nFirst line\nsecond line\n\n- one\n- two\n\n3. third\n4. fourth');
    expect(blocks).toEqual([
      { type: 'heading', level: 1, text: 'Title' },
      { type: 'paragraph', text: 'First line\nsecond line' },
      { type: 'list', ordered: false, items: ['one', 'two'] },
      { type: 'list', ordered: true, items: ['third', 'fourth'] },
    ]);
  });

  it('keeps fenced code exactly as written, including markdown-looking lines inside it', () => {
    const blocks = parseBlocks('Run:\n```bash\n# not a heading\n- not a list\n```\nDone.');
    expect(blocks).toEqual([
      { type: 'paragraph', text: 'Run:' },
      { type: 'code', language: 'bash', code: '# not a heading\n- not a list' },
      { type: 'paragraph', text: 'Done.' },
    ]);
  });

  it('treats an unclosed fence as code running to the end of the reply', () => {
    expect(parseBlocks('```\nunfinished')).toEqual([{ type: 'code', language: '', code: 'unfinished' }]);
  });

  it('reads quotes', () => {
    expect(parseBlocks('> a note\n> over two lines')).toEqual([{ type: 'quote', text: 'a note\nover two lines' }]);
  });
});

describe('parseInline', () => {
  it('reads bold, italic, code and links', () => {
    expect(parseInline('a **bold** and *italic* and `code` and [docs](https://example.com)')).toEqual([
      { type: 'text', text: 'a ' },
      { type: 'bold', text: 'bold' },
      { type: 'text', text: ' and ' },
      { type: 'italic', text: 'italic' },
      { type: 'text', text: ' and ' },
      { type: 'code', text: 'code' },
      { type: 'text', text: ' and ' },
      { type: 'link', text: 'docs', url: 'https://example.com' },
    ]);
  });

  it('leaves arithmetic with stars as written', () => {
    expect(parseInline('2 * 3 * 4')).toEqual([{ type: 'text', text: '2 * 3 * 4' }]);
  });

  it('does not turn a link to a non-web address into a link', () => {
    expect(parseInline('[file](file:///etc/passwd)')).toEqual([{ type: 'text', text: '[file](file:///etc/passwd)' }]);
  });
});

describe('userVisibleText', () => {
  it('keeps the typed text and drops the attached file context the server appends', () => {
    const stored =
      'Summarise the attached notes in one line.\n\n--- Attached Context ---\n\n📄 @file:.hermes/desktop-attachments/notes.txt (11 tokens)\n```\nQuarterly notes\n```';
    expect(userVisibleText(stored)).toBe('Summarise the attached notes in one line.');
  });

  it('leaves an ordinary message alone', () => {
    expect(userVisibleText('  hello there  ')).toBe('hello there');
  });
});
