// Hand-typed shapes for the managed-files endpoints. schema.ts types them as `unknown`.
// These follow the server source (hermes_cli/web_server.py in hermes-agent 0.19.0).
// Not checked against a running gateway.

// One child of a listed folder. Size is null for folders.
export type ManagedEntry = {
  name: string;
  path: string;
  is_directory: boolean;
  size: number | null;
  mtime: number;
  mime_type: string | null;
};

// GET /api/files?path=...
export type ManagedListing = {
  path: string;
  parent: string | null;
  entries: ManagedEntry[];
  locked_root: string | null;
};

// A listing tagged with the path it was requested for, so a screen never shows the
// contents of a previous folder while the new one loads.
export type FolderResult = ManagedListing & { requested: string };

// GET /api/files/read?path=... (the body arrives as a base64 data URL)
export type ManagedFile = {
  name: string;
  path: string;
  size: number;
  mime_type: string;
  data_url: string;
};

// Decoded text of a file. text is null when the bytes are not plain UTF-8 text.
export type FilePreviewData = {
  path: string;
  text: string | null;
};
