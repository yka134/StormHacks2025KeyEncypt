// local global variables
export const localKeyPair = { value: null };
export const localShared = { value: null };

// Creates a private,public key pair for the local user
// Returns the key pair on success
export async function makeKeys() {
    // Ensure crypto module is supported (it should be on all modern browsers)
    if (!window.crypto || !window.crypto.subtle) {
        console.error("Web Crypto API is not supported in this environment.");
        return null;
    }
    
    try {
        const keyPair = await crypto.subtle.generateKey(
            { name: "ECDH", namedCurve: "P-256" },
            true,
            ["deriveKey"]   // so that a shared key can be derived
        );
        console.log("Key pair generated successfully.");
        
        return keyPair;
    
    } catch (error) {
        console.error("Error generating keys: ", error);
        throw error;
    }
}

// Using a local key pair, returns a stringified &
// base64 encoded version of the public key (to make it easier to share)
export async function makeKeyToSend(keyPair) {
    // Ensure crypto module is supported (it should be on all modern browsers)
    if (!window.crypto || !window.crypto.subtle) {
        console.error("Web Crypto API is not supported in this environment.");
        return null;
    }
    
    const pubKey = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    const stringPubKey = JSON.stringify(pubKey);
    const base64PubKey = btoa(stringPubKey);
    return base64PubKey;
}

// Using a local key pair and the base64 version of the other
// person's public key; creates a shared key to use for encrypt/decrypt
export async function makeDerivedKey(ourKeyPair, otherPubKey) {
    // Ensure crypto module is supported (it should be on all modern browsers)
    if (!window.crypto || !window.crypto.subtle) {
        console.error("Web Crypto API is not supported in this environment.");
        return null;
    }
    
    // Undo base64/stringify of other key
    const jwk = JSON.parse(atob(otherPubKey));
    const otherPubImported = await crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "ECDH", namedCurve: "P-256" },
        true,
        []
    );

    // create the derived key
    const sharedKey = await crypto.subtle.deriveKey(
        { name: "ECDH", public: otherPubImported },
        ourKeyPair.privateKey,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );

    return sharedKey;
}

// Using the derived shared key, encrypts and returns a string
export async function generateEncryptedMessage(sharedKey, msg) {
    // Ensure crypto module is supported (it should be on all modern browsers)
    if (!window.crypto || !window.crypto.subtle) {
        console.error("Web Crypto API is not supported in this environment.");
        return null;
    }
    
    // Assume input is a string of base 64
    const enc = new TextEncoder();
    const data = enc.encode(msg);

    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96 bytes for Init Vector
    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        sharedKey,
        data
    );

    const encryptedBytes = new Uint8Array(encrypted);

    // combine the Init Vector and the ciphertext
    const combined = new Uint8Array(iv.length + encryptedBytes.length);
    combined.set(iv);
    combined.set(encryptedBytes, iv.length);

    // convert to base64 for easier sending
    const base64Message = btoa(String.fromCharCode(...combined));

    return base64Message;
}

// Using the derived shared key and an encrypted mesage;
// decryptes and returns the string
export async function decryptEncryptedMessage(sharedKey, base64Message) {
    // Ensure crypto module is supported (it should be on all modern browsers)
    if (!window.crypto || !window.crypto.subtle) {
        console.error("Web Crypto API is not supported in this environment.");
        return null;
    }
    
    const combinedBytes = Uint8Array.from(atob(base64Message), c => c.charCodeAt(0));

    // extract the first 12 bytes (Init Vector)
    const iv = combinedBytes.slice(0, 12);

    // extract the rest (ciphertext)
    const ciphertext = combinedBytes.slice(12);

    // decrypt
    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        sharedKey,
        ciphertext
    );

    const dec = new TextDecoder();
    return dec.decode(decrypted);
}