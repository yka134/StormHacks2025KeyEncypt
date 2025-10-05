// popup.js
import { localKeyPair, localShared, makeKeys, makeKeyToSend, makeDerivedKey, generateEncryptedMessage, decryptEncryptedMessage, exportCryptoKey, importCryptoKey } from './encrypt.js';

// --- Functions to get/set keys to/from storage ---

async function getLocalKeyPair() {
    const data = await chrome.storage.local.get(['privateKeyJwk', 'publicKeyJwk']);
    if (data.privateKeyJwk && data.publicKeyJwk) {
        const privateKey = await importCryptoKey(data.privateKeyJwk, ["deriveKey"]);
        const publicKey = await importCryptoKey(data.publicKeyJwk, []);
        return { privateKey, publicKey };
    }
    return null;
}

async function setLocalKeyPair(keyPair) {
    const privateKeyJwk = await exportCryptoKey(keyPair.privateKey);
    const publicKeyJwk = await exportCryptoKey(keyPair.publicKey);
    await chrome.storage.local.set({ privateKeyJwk, publicKeyJwk });
}

async function getSharedKey() {
    const data = await chrome.storage.local.get('sharedKeyJwk');
    if (data.sharedKeyJwk) {
        return await importCryptoKey(data.sharedKeyJwk, ["encrypt", "decrypt"]);
    }
    return null;
}

async function setSharedKey(sharedKey) {
    const sharedKeyJwk = await exportCryptoKey(sharedKey);
    await chrome.storage.local.set({ sharedKeyJwk });
}

// --- Initialization Logic ---

async function init() {
    // Check for existing key pair in storage
    let keyPair = await getLocalKeyPair();
    
    if (!keyPair) {
        // Generate new key pair if none found
        keyPair = await makeKeys();
        if (keyPair) {
            await setLocalKeyPair(keyPair);
            console.log("Generated and stored session key pair");
        }
    } else {
        console.log("Loaded session key pair from storage");
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    
    await init(); // call on load
    
    const copyPubBtn = document.getElementById("copyPubBtn");
    const pastePrivBtn = document.getElementById("pastePrivBtn");
    const encrypterBtn = document.getElementById("encrypterBtn");
    const decrypterBtn = document.getElementById("decrypterBtn");
    const encrypterInput = document.getElementById("encrypterInput");
    const decrypterInput = document.getElementById("decrypterInput");

    // Copy Public Key
    copyPubBtn.addEventListener("click", async () => {
        const keyPair = await getLocalKeyPair();
        if (!keyPair) return alert("Key pair not ready");
        
        const pubKeyBase64 = await makeKeyToSend(keyPair);
        await navigator.clipboard.writeText(pubKeyBase64);
        alert("Public key copied to clipboard!");
    });

    // Paste Other's Public Key to Derive Shared Key
    pastePrivBtn.addEventListener("click", async () => {
        const otherPubKey = prompt("Paste the other person's public key:");
        if (!otherPubKey) return;

        const keyPair = await getLocalKeyPair();
        if (!keyPair) return alert("Your key pair is not ready.");

        try {
            const sharedKey = await makeDerivedKey(keyPair, otherPubKey);
            await setSharedKey(sharedKey); // <--- Store the derived key
            alert("Shared key derived and stored for this session!");
        } catch (err) {
            alert("Error deriving shared key: invalid public key format.");
            console.error(err);
        }
    });

    // Encrypt
    encrypterBtn.addEventListener("click", async () => {
        const sharedKey = await getSharedKey();
        if (!sharedKey) return alert("No shared key! Derive one first.");
        
        const msg = encrypterInput.value;
        const encrypted = await generateEncryptedMessage(sharedKey, msg);
        encrypterInput.value = encrypted; // show encrypted
    });

    // Decrypt
    decrypterBtn.addEventListener("click", async () => {
        const sharedKey = await getSharedKey();
        if (!sharedKey) return alert("No shared key! Derive one first.");
        
        const msg = decrypterInput.value;
        try {
            const decrypted = await decryptEncryptedMessage(sharedKey, msg);
            decrypterInput.value = decrypted; // show decrypted
        } catch (err) {
            alert("Decryption failed: invalid input or key");
            console.error("Decryption Error:", err);
        }
    });
});