import { readResult } from '@/components/review/api';
import type { GatewayHttp } from '@/lib/gateway';

import { base64ToBytes, decodeUtf8 } from './decode';
import type { FilePreviewData, FolderResult, ManagedEntry, ManagedFile, ManagedListing } from './types';

export async function listFolder(http: GatewayHttp, path: string): Promise<FolderResult> {
  const listing = readResult<ManagedListing>(await http.GET('/api/files', { params: { query: { path } } }));
  return { ...listing, requested: path };
}

// Reads one file for a text preview. Callers check the size first (see canLoadPreview).
export async function loadPreview(http: GatewayHttp, entry: ManagedEntry): Promise<FilePreviewData> {
  const file = readResult<ManagedFile>(
    await http.GET('/api/files/read', { params: { query: { path: entry.path } } }),
  );
  const comma = file.data_url.indexOf(',');
  const bytes = base64ToBytes(comma === -1 ? '' : file.data_url.slice(comma + 1));
  return { path: entry.path, text: decodeUtf8(bytes) };
}
