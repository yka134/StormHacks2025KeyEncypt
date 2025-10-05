// popup.js
import { localKeyPair, localShared, makeKeys, makeKeyToSend, makeDerivedKey, generateEncryptedMessage, decryptEncryptedMessage } from './encrypt.js';

async function init() {
    // generate key pair for this session if it doesn't exist
    if (!localKeyPair.value) {
        localKeyPair.value = await makeKeys();
        console.log("Generated session key pair");
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
        if (!localKeyPair.value) return alert("Key pair not ready");
        const pubKeyBase64 = await makeKeyToSend(localKeyPair.value);
        await navigator.clipboard.writeText(pubKeyBase64);
        alert("Public key copied to clipboard!");
    });

    // Paste Private Key / or receive other's public key to derive shared key
    pastePrivBtn.addEventListener("click", async () => {
        const otherPubKey = prompt("Paste the other person's public key:");
        if (!otherPubKey) return;

        localShared.value = await makeDerivedKey(localKeyPair.value, otherPubKey);
        alert("Shared key derived for this session!");
    });

    // Encrypt
    encrypterBtn.addEventListener("click", async () => {
        if (!localShared.value) return alert("No shared key! Derive one first.");
        const msg = encrypterInput.value;
        const encrypted = await generateEncryptedMessage(localShared.value, msg);
        encrypterInput.value = encrypted; // show encrypted
    });

    // Decrypt
    decrypterBtn.addEventListener("click", async () => {
        if (!localShared.value) return alert("No shared key! Derive one first.");
        const msg = decrypterInput.value;
        try {
            const decrypted = await decryptEncryptedMessage(localShared.value, msg);
            decrypterInput.value = decrypted; // show decrypted
        } catch (err) {
            alert("Decryption failed: invalid input or key");
        }
    });
});
