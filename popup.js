document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("toggleButton");

  if (!button) {
    console.error("Button with id 'toggleButton' not found in popup.html.");
    return;
  }

  let isActive = false;

  button.addEventListener("click", async () => {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Prevent running on restricted Chrome URLs
    if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) {
      alert("This extension cannot run on Chrome internal pages.");
      return;
    }

    isActive = !isActive;
    button.textContent = isActive ? "Turn OFF" : "Turn ON";
    button.classList.toggle("active", isActive);

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scanAndDecrypt,
      args: [isActive]
    });
  });
});

function scanAndDecrypt(enable) {
  if (!enable) return;

  const encryptedPattern = /ENCRYPTED\[([^\]]*)\]/g;

  function fakeDecrypt(str) {
    const length = str.length;
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    return result;
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

  function handleText(textNode) {
    const text = textNode.nodeValue;
    if (!text.includes("ENCRYPTED[")) return;

    const newText = text.replace(encryptedPattern, (match, inner) => {
      const decrypted = fakeDecrypt(inner);
      return decrypted;
    });

    if (newText !== text) {
      textNode.nodeValue = newText;
    }
  }

  walk(document.body);
}
