// Decoding for file previews. The gateway sends file bodies as base64 data URLs.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (let i = 0; i < clean.length; i += 1) {
    buffer = ((buffer << 6) | ALPHABET.indexOf(clean[i])) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[index] = (buffer >> bits) & 0xff;
      index += 1;
    }
  }
  return bytes.subarray(0, index);
}

// Returns the text, or null when the bytes are not UTF-8 text (for example a binary file).
export function decodeUtf8(bytes: Uint8Array): string | null {
  if (bytes.indexOf(0) !== -1) return null;
  const escaped: string[] = [];
  for (let i = 0; i < bytes.length; i += 1) {
    escaped.push('%' + bytes[i].toString(16).padStart(2, '0'));
  }
  try {
    return decodeURIComponent(escaped.join(''));
  } catch {
    return null;
  }
}
