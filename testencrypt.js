// local global variables
let localKeyPair = null;
let localShared = null;

// Creates a private/public key pair
async function makeKeys() {
    if (!window.crypto || !window.crypto.subtle) return null;

    return crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveKey"]
    );
}

// Export public key to base64 string
async function makeKeyToSend(keyPair) {
    const pubKey = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    return btoa(JSON.stringify(pubKey));
}

// Create shared key from other's public key
async function makeDerivedKey(ourKeyPair, otherPubKey) {
    const jwk = JSON.parse(atob(otherPubKey));
    const otherPubImported = await crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "ECDH", namedCurve: "P-256" },
        true,
        []
    );
    return crypto.subtle.deriveKey(
        { name: "ECDH", public: otherPubImported },
        ourKeyPair.privateKey,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
}

// Encrypt message
async function generateEncryptedMessage(sharedKey, msg) {
    const enc = new TextEncoder();
    const data = enc.encode(msg);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, sharedKey, data);

    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    return btoa(String.fromCharCode(...combined));
}

// Decrypt message
async function decryptEncryptedMessage(sharedKey, base64Message) {
    const combinedBytes = Uint8Array.from(atob(base64Message), c => c.charCodeAt(0));
    const iv = combinedBytes.slice(0, 12);
    const ciphertext = combinedBytes.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, sharedKey, ciphertext);
    return new TextDecoder().decode(decrypted);
}

// Event handlers
async function pubKeyInput() {
    const pubKey = document.getElementById("pub-key-input").value;
    localShared = await makeDerivedKey(localKeyPair, pubKey);
}

async function encryptText() {
    const msg = document.getElementById("encrypt-input").value;
    if (!localShared) return alert("Set the shared key first!");
    const encrypted = await generateEncryptedMessage(localShared, msg);
    document.getElementById("encrypted-text").innerText = encrypted;
}

async function decryptText() {
    const msg = document.getElementById("decrypt-input").value;
    if (!localShared) return alert("Set the shared key first!");
    const decrypted = await decryptEncryptedMessage(localShared, msg);
    document.getElementById("result-text").innerText = decrypted;
}

// Initialize keys and UI
async function main() {
    // Try to load keys from sessionStorage
    const privateStored = localStorage.getItem("privateKey");
    const publicStored = localStorage.getItem("publicKey");

    if (privateStored && publicStored) {
        // Import stored keys
        const privateJwk = JSON.parse(privateStored);
        const publicJwk = JSON.parse(publicStored);

        localKeyPair = {
            privateKey: await crypto.subtle.importKey(
                "jwk",
                privateJwk,
                { name: "ECDH", namedCurve: "P-256" },
                true,
                ["deriveKey"]
            ),
            publicKey: await crypto.subtle.importKey(
                "jwk",
                publicJwk,
                { name: "ECDH", namedCurve: "P-256" },
                true,
                []
            )
        };
    } else {
        // Generate new keys
        localKeyPair = await makeKeys();

        // Export & store in sessionStorage
        const exportedPrivate = await crypto.subtle.exportKey("jwk", localKeyPair.privateKey);
        const exportedPublic = await crypto.subtle.exportKey("jwk", localKeyPair.publicKey);
        localStorage.setItem("privateKey", JSON.stringify(exportedPrivate));
        localStorage.setItem("publicKey", JSON.stringify(exportedPublic));
    }

    // Show public key
    const base64Key = await makeKeyToSend(localKeyPair);
    document.getElementById("public-key-text").innerText = base64Key;

    // Attach button handlers
    document.getElementById("pub-key-submit").onclick = pubKeyInput;
    document.getElementById("encrypt-submit").onclick = encryptText;
    document.getElementById("decrypt-submit").onclick = decryptText;
}

// Run after DOM is ready
document.addEventListener("DOMContentLoaded", main);
