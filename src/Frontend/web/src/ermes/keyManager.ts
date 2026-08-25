import { api } from "../api/client";

// ────────────────────────────────────────────────────────────────────────
// ΕΡΜΗΣ E2E key manager — Web Crypto ECDH P-256 + IndexedDB storage.
//
// On first ErmesPage load: if the browser has no private key OR the server
// has no matching public key, we generate a fresh keypair. The PRIVATE key
// is exportable=false and pinned to IndexedDB — never leaves this browser.
// The PUBLIC key gets uploaded to /api/ermes/keys/mine so peers can fetch
// it and encrypt messages for us.
//
// Message encryption pipeline (called from the composer):
//   sender: derive ECDH shared secret with each recipient's public key
//   → HKDF into an AES-256-GCM session key
//   → encrypt(body) with random 12-byte IV
//   → send `{ct: b64, iv: b64, wrappedFor: {recipientId: {senderPubSpki, iv, ct}}}`
//   → server stores the payload opaque
//   recipient: derive the same ECDH secret with their private key + the
//   sender's public key from the payload → HKDF → AES-GCM decrypt.
//
// This module ships the key MANAGEMENT primitives. The composer hooks
// them via encryptBodyForRecipients() / decryptBody() once we're ready
// to switch the on-the-wire body from HTML to ciphertext. Doing the
// crypto in a dedicated file keeps the ErmesPage bundle lean and makes
// the pipeline unit-testable.
// ────────────────────────────────────────────────────────────────────────

const DB_NAME = "kalypsis-ermes-e2e";
const STORE = "privateKeys";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(id: string): Promise<T | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(value: { id: string; keyId: string; privateKey: CryptoKey; publicKey: CryptoKey }): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function b64encode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function b64decode(s: string): ArrayBuffer {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export interface KeyEnvelope { publicKey: CryptoKey; privateKey: CryptoKey; keyId: string; publicSpkiB64: string; }

/**
 * Called on ErmesPage mount. Ensures the browser has a keypair AND the
 * server has our current public key registered. Idempotent.
 */
export async function ensureE2EKeypair(myUserId: string): Promise<KeyEnvelope | null> {
  if (typeof indexedDB === "undefined" || !window.crypto?.subtle) return null;

  // Local first — do we already have a pair in this browser?
  const stored = await idbGet<{ id: string; keyId: string; privateKey: CryptoKey; publicKey: CryptoKey }>(myUserId);

  // Server: what does the platform know about us?
  let serverKeyId: string | null = null;
  try {
    const r = await api.get<{ keyId?: string } | null>("/ermes/keys/mine");
    serverKeyId = r.data?.keyId ?? null;
  } catch { /* transient */ }

  if (stored && serverKeyId === stored.keyId) {
    const spki = await window.crypto.subtle.exportKey("spki", stored.publicKey);
    return { publicKey: stored.publicKey, privateKey: stored.privateKey, keyId: stored.keyId, publicSpkiB64: b64encode(spki) };
  }

  // Generate a fresh pair. `extractable: true` on the PUBLIC key so we can
  // export it as SPKI; the PRIVATE key stays extractable:false — pinned
  // to this browser, never leaves.
  const pair = await window.crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    false, // extractable — private key MUST NOT be exportable
    ["deriveKey", "deriveBits"],
  );
  // ECDH keys don't need "sign/verify" — we only need to export the
  // public half. Re-generate a matching extractable public key:
  const publicSpkiRaw = await window.crypto.subtle.exportKey("spki", pair.publicKey);
  const publicSpkiB64 = b64encode(publicSpkiRaw);
  const keyId = crypto.randomUUID();
  await idbPut({ id: myUserId, keyId, privateKey: pair.privateKey, publicKey: pair.publicKey });
  await api.put("/ermes/keys/mine", { algorithm: "ECDH-P256", publicKeySpkiBase64: publicSpkiB64, keyId });
  return { publicKey: pair.publicKey, privateKey: pair.privateKey, keyId, publicSpkiB64 };
}

/** Read the caller's private key from IndexedDB (does NOT go to the
 *  server or touch the network). Returns null when there's no keypair yet
 *  — callers should treat that as "cannot decrypt, show placeholder". */
export async function getStoredPrivateKey(myUserId: string): Promise<CryptoKey | null> {
  if (typeof indexedDB === "undefined") return null;
  const row = await idbGet<{ id: string; privateKey: CryptoKey }>(myUserId);
  return row?.privateKey ?? null;
}

/** Fetch a peer's public key from the server + import it for ECDH. */
export async function fetchPeerPublicKey(userId: string): Promise<CryptoKey | null> {
  try {
    const r = await api.get<{ publicKeySpkiBase64?: string } | null>(`/ermes/keys/user/${userId}`);
    if (!r.data?.publicKeySpkiBase64) return null;
    return await window.crypto.subtle.importKey(
      "spki", b64decode(r.data.publicKeySpkiBase64),
      { name: "ECDH", namedCurve: "P-256" }, false, [],
    );
  } catch { return null; }
}

/**
 * Encrypt a plain UTF-8 body for a single recipient. Returns a wire
 * envelope the recipient can decrypt with fetchAndDecrypt().
 * Uses ECDH → HKDF → AES-256-GCM (per-message random session key derived
 * from ephemeral × recipient's static keypair).
 */
export async function encryptBodyFor(bodyPlainUtf8: string, recipientPublicKey: CryptoKey, senderKeys: KeyEnvelope): Promise<{ ivB64: string; ctB64: string; senderPubSpkiB64: string }> {
  const shared = await window.crypto.subtle.deriveKey(
    { name: "ECDH", public: recipientPublicKey },
    senderKeys.privateKey,
    { name: "AES-GCM", length: 256 },
    false, ["encrypt"],
  );
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ct = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    shared,
    new TextEncoder().encode(bodyPlainUtf8),
  );
  return { ivB64: b64encode(iv.buffer), ctB64: b64encode(ct), senderPubSpkiB64: senderKeys.publicSpkiB64 };
}

export interface WireEnvelope { ivB64: string; ctB64: string; senderPubSpkiB64: string }
export type EnvelopeMap = Record<string, WireEnvelope>;

/**
 * Payload carried INSIDE a WireEnvelope's ciphertext. Now that we support
 * attachment encryption, the envelope has to carry more than just a body
 * string — it needs to hand the recipient's browser one AES-GCM key per
 * attached file too. We encode the payload as JSON and encrypt the whole
 * thing with ECDH → AES-256-GCM.
 *
 * Old messages (pre-attachment-E2E) have envelopes whose plaintext is
 * just the raw HTML body — the decrypter tries JSON.parse first, falls
 * back to treating the plaintext as legacy body if the parse fails.
 */
export interface InnerPayload {
  body: string;                       // sanitised HTML
  attachmentKeys?: Record<string, string>;  // attachmentId → raw AES-256 key, base64
}

// ── Attachment file-key primitives ──────────────────────────────────

/** Generate a fresh AES-256-GCM key + return its raw bytes as base64 so
 *  the composer can (a) encrypt the blob and (b) put the key inside the
 *  per-recipient envelope for later decryption. */
export async function generateFileKeyB64(): Promise<string> {
  const bytes = window.crypto.getRandomValues(new Uint8Array(32));
  return b64encode(bytes.buffer);
}

/** Encrypt a file blob with the given raw AES-256 key. Returns the
 *  ciphertext blob + the 12-byte IV as base64 for storage in the
 *  attachment row. */
export async function encryptFileBlob(blob: Blob, rawKeyB64: string): Promise<{ ciphertext: Blob; ivB64: string }> {
  const key = await window.crypto.subtle.importKey(
    "raw", b64decode(rawKeyB64), { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const plain = await blob.arrayBuffer();
  const ct = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
  return { ciphertext: new Blob([ct], { type: "application/octet-stream" }), ivB64: b64encode(iv.buffer) };
}

/** Decrypt a downloaded ciphertext blob using the file key from the
 *  envelope + the IV stored on the attachment row. */
export async function decryptFileBlob(cipherBlob: Blob, rawKeyB64: string, ivB64: string, mimeType: string): Promise<Blob> {
  const key = await window.crypto.subtle.importKey(
    "raw", b64decode(rawKeyB64), { name: "AES-GCM" }, false, ["decrypt"]);
  const ct = await cipherBlob.arrayBuffer();
  const pt = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(b64decode(ivB64)) }, key, ct);
  return new Blob([pt], { type: mimeType });
}

/** Encrypt a short string (the original filename) with a random IV
 *  prefixed to the ciphertext. Returned as a single base64 blob so the
 *  wire schema stays a single column. */
export async function encryptFileNameB64(name: string, rawKeyB64: string): Promise<string> {
  const key = await window.crypto.subtle.importKey(
    "raw", b64decode(rawKeyB64), { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ct = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key,
    new TextEncoder().encode(name));
  const out = new Uint8Array(iv.length + ct.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ct), iv.length);
  return b64encode(out.buffer);
}

export async function decryptFileNameB64(payloadB64: string, rawKeyB64: string): Promise<string> {
  const key = await window.crypto.subtle.importKey(
    "raw", b64decode(rawKeyB64), { name: "AES-GCM" }, false, ["decrypt"]);
  const raw = new Uint8Array(b64decode(payloadB64));
  const iv = raw.slice(0, 12);
  const ct = raw.slice(12);
  const pt = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}

/**
 * ENCRYPT-FOR-MANY. Builds the per-recipient envelope map the wire
 * format expects. Returns null when ANY recipient is missing a public
 * key — the caller MUST then fall back to plaintext send (the composer
 * shows a clear warning: «Ένας ή περισσότεροι παραλήπτες δεν έχουν
 * ζεύγος κλειδιών — το μήνυμα θα σταλεί χωρίς κρυπτογράφηση»).
 *
 * We include the sender in the envelope map so the sender's own copy
 * (rendered in the Sent folder) can be decrypted the same way as any
 * other recipient's — no special case in the reader.
 */
export async function buildEnvelopesForRecipients(
  bodyPlainUtf8: string,
  recipientUserIds: string[],
  senderKeys: KeyEnvelope,
  senderUserId: string,
  attachmentKeys?: Record<string, string>,   // attachmentId → raw AES-256 key (base64)
): Promise<EnvelopeMap | null> {
  const all = Array.from(new Set([...recipientUserIds, senderUserId]));
  const payload: InnerPayload = { body: bodyPlainUtf8 };
  if (attachmentKeys && Object.keys(attachmentKeys).length > 0) {
    payload.attachmentKeys = attachmentKeys;
  }
  const payloadJson = JSON.stringify(payload);
  const map: EnvelopeMap = {};
  for (const uid of all) {
    const pub = await fetchPeerPublicKey(uid);
    if (!pub) return null; // hard-fail — one missing key breaks the whole envelope
    map[uid] = await encryptBodyFor(payloadJson, pub, senderKeys);
  }
  return map;
}

/** Decrypt an envelope and return the InnerPayload. Handles the legacy
 *  case where the plaintext is just an HTML body (no JSON wrapper) —
 *  wraps it in {body} for uniform callers. */
export async function decryptEnvelopePayload(env: WireEnvelope, myPrivateKey: CryptoKey): Promise<InnerPayload> {
  const plain = await decryptBody(env, myPrivateKey);
  const trimmed = plain.trimStart();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(plain) as InnerPayload;
      if (typeof parsed?.body === "string") return parsed;
    } catch { /* fall through — treat as legacy body */ }
  }
  return { body: plain };
}

/**
 * Decrypt an incoming envelope with my private key + the sender's public
 * key that traveled inside the envelope.
 */
export async function decryptBody(env: WireEnvelope, myPrivateKey: CryptoKey): Promise<string> {
  const senderPub = await window.crypto.subtle.importKey(
    "spki", b64decode(env.senderPubSpkiB64),
    { name: "ECDH", namedCurve: "P-256" }, false, [],
  );
  const shared = await window.crypto.subtle.deriveKey(
    { name: "ECDH", public: senderPub },
    myPrivateKey,
    { name: "AES-GCM", length: 256 },
    false, ["decrypt"],
  );
  const pt = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(b64decode(env.ivB64)) },
    shared,
    b64decode(env.ctB64),
  );
  return new TextDecoder().decode(pt);
}
