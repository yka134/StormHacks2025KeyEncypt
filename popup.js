import { localKeyPair, localShared, makeKeys,
  makeKeyToSend, makeDerivedKey, decryptEncryptedMessage } from "./encrypt.js";

document.addEventListener("DOMContentLoaded", async () => {
  // Generate and store the keypair on init
  try {
    const keyPair = await makeKeys();
    localKeyPair.value = keyPair; // assuming localKeyPair is an object with a .value property
    console.log("Key pair generated:", keyPair);
  } catch (err) {
    console.error("Error generating key pair:", err);
  }

  const decryptButton = document.getElementById("decryptButton");
  if (!decryptButton) {
    console.error("Button with id 'decryptButton' not found in popup.html.");
    return;
  }

  const copyKeyButton = document.getElementById("copyKeyButton");
  if (!copyKeyButton) {
    console.error("Button with id 'copyKeyButton' not found in popup.html.");
    return;
  }

  const readKeyButton = document.getElementById("readKeyButton");
  if (!readKeyButton) {
    console.error("Button with id 'readKeyButton' not found in popup.html.");
    return;
  }

  const publicKeyInput = document.getElementById("publicKeyInput");
  if (!publicKeyInput) {
    console.error("Input with id 'publicKeyInput' not found in popup.html.");
    return;
  }

  // When Read Key is pressed
  readKeyButton.addEventListener("click", async () => {
    const theirPublicKey = publicKeyInput.value.trim();
    if (!theirPublicKey) {
      console.error("Public key input is empty.");
      alert("Please paste a public key first!");
      return;
    }

    try {
      const derivedKey = await makeDerivedKey(theirPublicKey);
      localShared.value = derivedKey; // store shared key
      console.log("Derived shared key set:", derivedKey);
      alert("Key successfully read and shared key derived!");
    } catch (err) {
      console.error("Error deriving key:", err);
      alert("Failed to derive key. Check the public key format.");
    }
  });

  // When Copy Public Key is pressed
  copyKeyButton.addEventListener("click", async () => {
    try {
      if (!localKeyPair.value) {
        alert("Key pair not generated yet.");
        return;
      }

      // Get the public key to send
      const base64Key = await makeKeyToSend(localKeyPair.value);

      // Copy to clipboard
      await navigator.clipboard.writeText(base64Key);

      console.log("Copied public key:", base64Key);
      alert("Public key copied to clipboard!");
    } catch (err) {
      console.error("Error copying public key:", err);
      alert("Failed to copy public key.");
    }
  });

  // When Decrypt is pressed
  decryptButton.addEventListener("click", async () => {
    console.log("Decrypt button clicked");
    scanAndDecrypt(true);
  });



});

// Helper: async version of String.replace
async function replaceAsync(str, regex, asyncFn) {
  const promises = [];
  str.replace(regex, (match, ...args) => {
    promises.push(asyncFn(match, ...args));
    return match;
  });
  const data = await Promise.all(promises);
  return str.replace(regex, () => data.shift());
}


function scanAndDecrypt(enable) {
  if (!enable) return;

  const encryptedPattern = /ENCRYPTED\[([^\]]*)\]/g;

  async function handleText(textNode) {
    const text = textNode.nodeValue;
    if (!text.includes("ENCRYPTED[")) return;

    // Replace all encrypted segments with their decrypted form
    const newText = await replaceAsync(text, encryptedPattern, async (match, inner) => {
      try {
        const decrypted = await decryptEncryptedMessage(inner);
        return decrypted;
      } catch (err) {
        console.error("Decryption failed for:", inner, err);
        return "[Decryption Error]";
      }
    });

    if (newText !== text) {
      textNode.nodeValue = newText;
    }
  }

  function walk(node) {
    let child, next;
    switch (node.nodeType) {
      case 1:
      case 9:
      case 11:
        if (["SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "OBJECT"].includes(node.nodeName))
          return;
        child = node.firstChild;
        while (child) {
          next = child.nextSibling;
          walk(child);
          child = next;
        }
        break;
      case 3:
        handleText(node);
        break;
    }
  }

  walk(document.body);
}
