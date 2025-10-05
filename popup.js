import {
  localKeyPair,
  localShared,
  makeKeys,
  makeKeyToSend,
  makeDerivedKey,
} from "./encrypt.js";


  // Generate and store local keypair
async function loadOrGenerateKeys() {
  const data = await chrome.storage.local.get(["privateKeyJwk", "publicKeyJwk"]);
  if (data.privateKeyJwk && data.publicKeyJwk) {
    // Import stored keys
    const privateKey = await crypto.subtle.importKey(
      "jwk",
      data.privateKeyJwk,
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey"]
    );
    const publicKey = await crypto.subtle.importKey(
      "jwk",
      data.publicKeyJwk,
      { name: "ECDH", namedCurve: "P-256" },
      true,
      []
    );
    localKeyPair.value = { privateKey, publicKey };
    console.log("Loaded existing keypair.");
  } else {
    // Generate and save new keypair
    const keyPair = await makeKeys();
    const privateKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
    const publicKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    await chrome.storage.local.set({ privateKeyJwk, publicKeyJwk });
    localKeyPair.value = keyPair;
    console.log("Generated new keypair and saved.");
  }
}
document.addEventListener("DOMContentLoaded", async () => {
  try{await loadOrGenerateKeys();

  }
  catch (err) {
    console.error("Error generating key pair:", err);
  }

  const decryptButton = document.getElementById("decryptButton");
  const copyKeyButton = document.getElementById("copyKeyButton");
  const readKeyButton = document.getElementById("readKeyButton");
  const publicKeyInput = document.getElementById("publicKeyInput");

  if (!decryptButton || !copyKeyButton || !readKeyButton || !publicKeyInput) {
    console.error("Some popup elements are missing.");
    return;
  }

  // Copy public key
  copyKeyButton.addEventListener("click", async () => {
    if (!localKeyPair.value) return alert("Generate keypair first.");
    const base64Key = await makeKeyToSend(localKeyPair.value);
    await navigator.clipboard.writeText(base64Key);
    alert("Public key copied to clipboard!");
  });

  // Read other user's public key
  readKeyButton.addEventListener("click", async () => {
    const theirKey = publicKeyInput.value.trim();
    if (!theirKey) return alert("Please paste a public key first!");

    try {
      const derivedKey = await makeDerivedKey(localKeyPair.value, theirKey);
      localShared.value = derivedKey;

      // Export and store shared key
      const raw = await crypto.subtle.exportKey("raw", derivedKey);
      const base64Key = btoa(String.fromCharCode(...new Uint8Array(raw)));
      await chrome.storage.local.set({ sharedKey: base64Key });

      console.log("Shared key stored successfully.");
      alert("Shared key derived and saved!");
    } catch (err) {
      console.error("Error deriving key:", err);
      alert("Failed to derive key.");
    }
  });

  // Toggle decryption scanner
  let isActive = false;
  decryptButton.addEventListener("click", async () => {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.url.startsWith("chrome://")) {
      alert("Cannot run on internal Chrome pages.");
      return;
    }

    isActive = !isActive;
    decryptButton.textContent = isActive ? "Turn OFF" : "Turn ON";

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scanAndDecrypt,
      args: [isActive],
    });
  });
});

// Injected into page — scans and decrypts text
async function scanAndDecrypt(enable) {
  if (!enable) return;
  const encryptedPattern = /ENCRYPTED\[([^\]]+)\]/g;

  // Load shared key from storage
  const { sharedKey: base64Key } = await chrome.storage.local.get("sharedKey");
  if (!base64Key) {
    alert("No shared key found! Please exchange keys first.");
    return;
  }

  const raw = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
  const sharedKey = await crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM" },
    true,
    ["decrypt"]
  );

  async function decryptInline(base64Str) {
    try {
      const combined = Uint8Array.from(atob(base64Str), c => c.charCodeAt(0));
      const iv = combined.slice(0, 12);
      const ciphertext = combined.slice(12);
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        sharedKey,
        ciphertext
      );
      return new TextDecoder().decode(decrypted);
    } catch (e) {
      return "[DECRYPTION_FAILED]";
    }
  }

  async function handleText(node) {
    const text = node.nodeValue;
    if (!text.includes("ENCRYPTED[")) return;
    const matches = [...text.matchAll(encryptedPattern)];
    let newText = text;
    for (const match of matches) {
      const dec = await decryptInline(match[1]);
      newText = newText.replace(match[0], dec);
    }
    node.nodeValue = newText;
  }

  function walk(node) {
    let child = node.firstChild;
    while (child) {
      const next = child.nextSibling;
      if (child.nodeType === 3) handleText(child);
      else if (
        child.nodeType === 1 &&
        !["SCRIPT", "STYLE", "IFRAME"].includes(child.tagName)
      )
        walk(child);
      child = next;
    }
  }

  walk(document.body);
  alert("Decryption complete on visible text!");
}
