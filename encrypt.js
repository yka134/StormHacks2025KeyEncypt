// encrypt.js

// Local global variables (used for runtime cache)
export const localKeyPair = { value: null };
export const localShared = { value: null };

// Creates a private/public key pair
export async function makeKeys() {
  if (!window.crypto?.subtle) {
    console.error("Web Crypto API not supported.");
    return null;
  }

  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  );
  console.log("Key pair generated.");
  return keyPair;
}

// Returns a base64 public key to share
export async function makeKeyToSend(keyPair) {
  const pubKey = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  return btoa(JSON.stringify(pubKey));
}

// Derives the shared key from local + remote public keys
export async function makeDerivedKey(ourKeyPair, otherPubKey) {
  const jwk = JSON.parse(atob(otherPubKey));
  const otherImported = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );

  const sharedKey = await crypto.subtle.deriveKey(
    { name: "ECDH", public: otherImported },
    ourKeyPair.privateKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  return sharedKey;
}

// Encrypt message with shared key
export async function generateEncryptedMessage(sharedKey, msg) {
  const enc = new TextEncoder();
  const data = enc.encode(msg);

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    sharedKey,
    data
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}

// Decrypt message with shared key
export async function decryptEncryptedMessage(sharedKey, base64Message) {
  const combined = Uint8Array.from(atob(base64Message), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    sharedKey,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}
