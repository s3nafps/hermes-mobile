import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import type { SentAttachment } from '@/lib/chat/types';
import type { RpcClient } from '@/lib/gateway/rpc';

// Largest photo or file the app sends. The gateway receives each upload as one JSON frame
// on the chat socket, and that frame is capped at 16 MiB. Base64 adds a third, so raw
// files stay under 10 MB.
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

// Image types the gateway accepts for attach_bytes. Other images, such as HEIC, go as files.
const GATEWAY_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp']);

export type PickedFile = {
  name: string;
  kind: 'image' | 'file';
  mimeType: string;
  uri: string;
  // Set when the picker already returned the bytes, as it does for photos.
  base64?: string;
  size?: number;
};

// A file in the composer. It uploads as soon as it is picked, so sending is instant.
export type PendingAttachment = SentAttachment & {
  key: string;
  status: 'uploading' | 'ready' | 'failed';
  error?: string;
  // The gateway's handle for an image, so it can be detached again.
  path?: string;
};

export async function pickPhoto(): Promise<PickedFile | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    base64: true,
    quality: 0.85,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  return {
    name: asset.fileName ?? 'photo.jpg',
    kind: 'image',
    mimeType: asset.mimeType ?? 'image/jpeg',
    uri: asset.uri,
    base64: asset.base64 ?? undefined,
    size: asset.fileSize ?? undefined,
  };
}

export async function pickDocument(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const mimeType = asset.mimeType ?? 'application/octet-stream';
  return {
    name: asset.name,
    kind: GATEWAY_IMAGE_TYPES.has(mimeType) ? 'image' : 'file',
    mimeType,
    uri: asset.uri,
    size: asset.size ?? undefined,
  };
}

// Sends a picked file to the gateway for this session. An image is queued for the next
// message. Any other file is staged in the session workspace, and the message refers to it.
export async function uploadAttachment(
  rpc: RpcClient,
  sessionId: string,
  file: PickedFile,
): Promise<Pick<PendingAttachment, 'path' | 'refText'>> {
  if (file.size !== undefined && file.size > MAX_ATTACHMENT_BYTES) throw tooLarge(file.name);
  const base64 = file.base64 ?? (await readBase64(file.uri));
  if (decodedSize(base64) > MAX_ATTACHMENT_BYTES) throw tooLarge(file.name);

  if (file.kind === 'image') {
    const result = await rpc.call<{ path: string }>('image.attach_bytes', {
      session_id: sessionId,
      content_base64: base64,
      filename: file.name,
    });
    return { path: result.path };
  }

  const result = await rpc.call<{ path: string; ref_text: string }>('file.attach', {
    session_id: sessionId,
    name: file.name,
    data_url: `data:${file.mimeType};base64,${base64}`,
  });
  return { path: result.path, refText: result.ref_text };
}

// Removes a queued image from the session. Files are only referenced by the message, so
// there is nothing to undo for them.
export async function detachAttachment(rpc: RpcClient, sessionId: string, attachment: PendingAttachment): Promise<void> {
  if (attachment.kind !== 'image' || !attachment.path) return;
  await rpc.call('image.detach', { session_id: sessionId, path: attachment.path }).catch(() => undefined);
}

function tooLarge(name: string): Error {
  return new Error(`${name} is larger than ${MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB.`);
}

// Reads a picked file as base64. On web the picker's uri is a browser blob URL, which
// only fetch can read. Native files are read with the file system API.
async function readBase64(uri: string): Promise<string> {
  if (Platform.OS !== 'web') return new File(uri).base64();
  const blob = await (await fetch(uri)).blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      resolve(dataUrl.slice(dataUrl.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file.'));
    reader.readAsDataURL(blob);
  });
}

// Size of the decoded bytes behind a base64 string, without decoding it.
function decodedSize(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}
