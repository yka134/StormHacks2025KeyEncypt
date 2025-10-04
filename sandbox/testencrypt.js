
async function makeKeys() {
    // Ensure crypto module is supported (it should be on all modern browsers)
    if (!window.crypto || !window.crypto.subtle) {
        console.error("Web Crypto API is not supported in this environment.");
        return null;
    }
    
    try {
        const keyPair = await crypto.subtle.generateKey(
            { name: "ECDH", namedCurve: "P-256" },
            true,
            ["deriveKey"]     // TODO: figure this out
        );
        console.log("Key pair generated successfully.");
        
        return keyPair;
    
    } catch (error) {
        console.error("Error generating keys: ", error);
        //throw error;
    }
}

async function makeKeyToSend(keyPair) {
    const pubKey = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    const stringPubKey = JSON.stringify(pubKey);
    const base64PubKey = btoa(stringPubKey);
    return base64PubKey;
}

async function makeDerivedKey(ourKeyPair, otherPubKey) {
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

async function generateEncryptedMessage(sharedKey, msg) {
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

async function decryptEncryptedMessage(sharedKey, base64Message) {
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

let localShared;
let localKeyPair;

async function pubKeyInput() {
    const pubKeyInputElem = document.getElementById("pub-key-input");
    const pubKeyInputValue = pubKeyInputElem.value;

    localShared = await makeDerivedKey(localKeyPair, pubKeyInputValue);
}

async function encryptText() {
    const inputText = document.getElementById("encrypt-input").value;
    const encryptedMessage64 = await generateEncryptedMessage(localShared, inputText);
    document.getElementById("encrypted-text").innerHTML = encryptedMessage64;
}


async function decryptText() {
    const inputText = document.getElementById("decrypt-input").value;
    const decrypted = await decryptEncryptedMessage(localShared, inputText);
    document.getElementById("result-text").innerText = decrypted;
}

async function main() {
    try {
        localKeyPair = await makeKeys();
        const base64Key = await makeKeyToSend(localKeyPair);
        console.log(base64Key);
        document.getElementById("public-key-text").innerHTML = base64Key;


    } catch (error) {
        console.error(error);
    }
}


async function testEncryptionFlow() {
    const keyPairA = await makeKeys();
    const keyPairB = await makeKeys();

    const pubA = await makeKeyToSend(keyPairA);
    const pubB = await makeKeyToSend(keyPairB);

    const sharedA = await makeDerivedKey(keyPairA, pubB);
    const sharedB = await makeDerivedKey(keyPairB, pubA);

    const encryptedMessage64 = await generateEncryptedMessage(sharedA, "Hello World!");
    console.log("Encrypted (base 64): ", encryptedMessage64);

    const decrypted = await decryptEncryptedMessage(sharedB, encryptedMessage64);
    console.log("Decrypted: ", decrypted);
}





main();

//testEncryptionFlow();