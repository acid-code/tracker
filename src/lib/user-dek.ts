const DEK_IDB_BASE = "dek-v1";
const TEXT_ENC = new TextEncoder();
const TEXT_DEC = new TextDecoder();

function b64FromBuf(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

function bufFromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export async function generateDek(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

export async function exportDekRaw(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return b64FromBuf(raw);
}

export async function importDekRaw(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    bufFromB64(b64).buffer as ArrayBuffer,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

export async function encryptJson(
  key: CryptoKey,
  value: unknown,
): Promise<{ iv: string; ciphertext: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = TEXT_ENC.encode(JSON.stringify(value));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plain,
  );
  return { iv: b64FromBuf(iv), ciphertext: b64FromBuf(cipher) };
}

export async function decryptJson<T>(
  key: CryptoKey,
  iv: string,
  ciphertext: string,
): Promise<T> {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bufFromB64(iv).buffer as ArrayBuffer },
    key,
    bufFromB64(ciphertext).buffer as ArrayBuffer,
  );
  return JSON.parse(TEXT_DEC.decode(plain)) as T;
}

export { DEK_IDB_BASE };
