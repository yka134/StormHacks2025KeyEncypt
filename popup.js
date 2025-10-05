// popup.js

import {
  localKeyPair,
  localShared,
  makeKeys,
  makeKeyToSend,
  makeDerivedKey,
} from "./encrypt.js";

// toast system
function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.style.opacity = "1";
  setTimeout(() => {
    toast.style.opacity = "0";
  }, 2500);
}

// Generate / load local keypair
async function loadOrGenerateKeys() {
  const data = await chrome.storage.local.get(["privateKeyJwk", "publicKeyJwk"]);
  if (data.privateKeyJwk && data.publicKeyJwk) {
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
    const keyPair = await makeKeys();
    const privateKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
    const publicKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    await chrome.storage.local.set({ privateKeyJwk, publicKeyJwk });
    localKeyPair.value = keyPair;
    console.log("Generated new keypair and saved.");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadOrGenerateKeys();
  } catch (err) {
    console.error("Error generating key pair:", err);
    showToast("Key generation failed");
  }

  const decryptButton = document.getElementById("decryptButton");
  const copyKeyButton = document.getElementById("copyKeyButton");
  const readKeyButton = document.getElementById("readKeyButton");
  const publicKeyInput = document.getElementById("publicKeyInput");

  // Ensure elements exist
  if (!decryptButton || !copyKeyButton || !readKeyButton || !publicKeyInput) {
    console.error("Popup elements missing.");
    return;
  }

  // Copy public key
  copyKeyButton.addEventListener("click", async () => {
    if (!localKeyPair.value) {
      showToast("Generate keypair first.");
      return;
    }

// Get base64 public key
    const base64Key = await makeKeyToSend(localKeyPair.value);
    await navigator.clipboard.writeText(base64Key);
    showToast("Public key copied!");
  });


  //Read friend's public key
  readKeyButton.addEventListener("click", async () => {
    const theirKey = publicKeyInput.value.trim();
    if (!theirKey) return showToast("Paste a public key first!");

    try {
      const derivedKey = await makeDerivedKey(localKeyPair.value, theirKey);
      localShared.value = derivedKey;

      const raw = await crypto.subtle.exportKey("raw", derivedKey);
      const base64Key = btoa(String.fromCharCode(...new Uint8Array(raw)));
      await chrome.storage.local.set({ sharedKey: base64Key });

      console.log("Shared key stored successfully.");
      showToast("Shared key saved!");
    } catch (err) {
      console.error("Error deriving key:", err);
      showToast("Failed to derive key.");
    }
  });


  // refresh decrypt (no toggle)
  decryptButton.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.url.startsWith("chrome://")) {
      showToast("Cannot run on this page!");
      return;
    }

    decryptButton.textContent = "Decrypting...";
    decryptButton.disabled = true;

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: scanAndDecrypt,
      });
    } catch (err) {
      console.error("Error running decrypt:", err);
      showToast("Decryption failed.");
    } finally {
      decryptButton.textContent = "Decrypt Text on Screen";
      decryptButton.disabled = false;
    }
  });
});

// Function injected into the page
// Scans for ENCRYPTED[...] patterns and decrypts them
async function scanAndDecrypt() {
  const encryptedPattern = /ENCRYPTED\[([^\]]+)\]/g;

  const { sharedKey: base64Key } = await chrome.storage.local.get("sharedKey");
  if (!base64Key) {
    injectToast("No shared key found! Please input friend's key first.");
    return;
  }

  // Import the shared AES-GCM key
  const raw = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
  const sharedKey = await crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM" },
    true,
    ["decrypt"]
  );

  // Decrypts a single base64-encoded encrypted string
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
    } catch {
      return "[DECRYPTION_FAILED]";
    }
  }

  // Process text nodes
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

  // Walk the DOM tree (for message body)
  function walk(node) {
    let child = node.firstChild;
    while (child) {
      const next = child.nextSibling;
      if (child.nodeType === 3) handleText(child);
      else if (child.nodeType === 1 && !["SCRIPT", "STYLE", "IFRAME"].includes(child.tagName))
        walk(child);
      child = next;
    }
  }

  //  Start walking from body of message
  walk(document.body);
  injectToast("Decryption complete! All ENCRYPTED[…] texts processed.");

  //Toast shown in page context
  function injectToast(message) {
    const existing = document.getElementById("decrypt-toast");
    if (existing) existing.remove();

    // Create toast element
    const toast = document.createElement("div");
    toast.id = "decrypt-toast";
    toast.textContent = message;
    Object.assign(toast.style, {
      position: "fixed",
      bottom: "30px",
      right: "30px",
      background: "rgba(40,40,40,0.95)",
      color: "#fff",
      padding: "10px 16px",
      borderRadius: "8px",
      fontFamily: "system-ui, sans-serif",
      fontSize: "14px",
      zIndex: 2147483647,
      boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
      opacity: "0",
      transition: "opacity 0.4s ease",
    });

    // Append and show
    document.body.appendChild(toast);
    requestAnimationFrame(() => (toast.style.opacity = "1"));
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 400);
    }, 2000);
  }
}
