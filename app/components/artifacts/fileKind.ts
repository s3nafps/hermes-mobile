import type { ManagedEntry } from './types';

// Text files larger than this are not loaded. Longer previews are also cut off.
export const MAX_PREVIEW_BYTES = 512 * 1024;
export const MAX_PREVIEW_LINES = 1500;

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'json', 'jsonl', 'yaml', 'yml', 'toml', 'csv', 'tsv', 'log', 'ini', 'cfg',
  'py', 'js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'html', 'htm', 'css', 'scss', 'xml', 'sh', 'bash', 'zsh',
  'sql', 'go', 'rs', 'java', 'kt', 'swift', 'c', 'h', 'cpp', 'hpp', 'rb', 'diff', 'patch', 'rst',
]);
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'svg', 'avif', 'heic']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'm4a', 'ogg', 'flac', 'aac']);
const ARCHIVE_EXTENSIONS = new Set(['zip', 'gz', 'tgz', 'tar', '7z', 'rar', 'bz2', 'xz']);
const DOCUMENT_EXTENSIONS = new Set(['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'key', 'pages', 'numbers']);

export type FileKind = { label: string; previewable: boolean };

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

// Type label for a listed file. A text extension wins over the MIME guess, because
// Python's mimetypes maps .ts to video/mp2t.
export function fileKind(entry: ManagedEntry): FileKind {
  const ext = extensionOf(entry.name);
  const mime = entry.mime_type ?? '';
  if (TEXT_EXTENSIONS.has(ext)) return { label: ext.toUpperCase(), previewable: true };
  if (IMAGE_EXTENSIONS.has(ext) || mime.startsWith('image/')) return { label: 'Image', previewable: false };
  if (VIDEO_EXTENSIONS.has(ext) || mime.startsWith('video/')) return { label: 'Video', previewable: false };
  if (AUDIO_EXTENSIONS.has(ext) || mime.startsWith('audio/')) return { label: 'Audio', previewable: false };
  if (ext === 'pdf' || mime === 'application/pdf') return { label: 'PDF', previewable: false };
  if (DOCUMENT_EXTENSIONS.has(ext)) return { label: ext.toUpperCase(), previewable: false };
  if (ARCHIVE_EXTENSIONS.has(ext)) return { label: 'Archive', previewable: false };
  // Unknown types are read as text. The decoder rejects anything that is not UTF-8.
  return { label: ext ? ext.toUpperCase() : 'File', previewable: true };
}

// True when the file may be read for a text preview.
export function canLoadPreview(entry: ManagedEntry): boolean {
  return !entry.is_directory && fileKind(entry).previewable && (entry.size ?? 0) <= MAX_PREVIEW_BYTES;
}

// Hidden files and dependency folders are left out of the list.
export function isHidden(name: string): boolean {
  return name.startsWith('.') || name === 'node_modules' || name === '__pycache__';
}

// Folders first by name, then files with the newest first.
export function sortEntries(entries: ManagedEntry[]): ManagedEntry[] {
  return entries
    .filter((entry) => !isHidden(entry.name))
    .sort((a, b) => {
      if (a.is_directory !== b.is_directory) return a.is_directory ? -1 : 1;
      if (a.is_directory) return a.name.localeCompare(b.name);
      return b.mtime - a.mtime;
    });
}
