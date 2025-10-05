chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "insert_encrypted") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  if (!/^https?:\/\//.test(tab.url)) {
    console.warn("Cannot run on this page:", tab.url);
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: captureAndEncryptUserText,
    });
  } catch (err) {
    console.error("Failed to inject script:", err);
  }
});

// This runs in the page context
async function captureAndEncryptUserText() {
  const active = document.activeElement;

  if (
    !(
      active &&
      (active.tagName === "TEXTAREA" ||
        active.tagName === "INPUT" ||
        active.isContentEditable)
    )
  ) {
    showToast("Click inside a text field first!");
    return;
  }

  // Get text content based on element type
  let text = "";
  if (active.tagName === "TEXTAREA" || active.tagName === "INPUT") {
    text = active.value.trim();
  } else if (active.isContentEditable) {
    text = active.innerText.trim();
  }

  if (!text) {
    showToast("No text found to encrypt!");
    return;
  }

  // Wrap in ENCRYPTED[]
  const encrypted = `ENCRYPTED[${text}]`;

  try {
    await navigator.clipboard.writeText(encrypted);
    showToast("Encrypted text copied to clipboard!");
  } catch (err) {
    console.error("Clipboard write failed:", err);
    showToast("Clipboard access denied. Try again after focusing on the page.");
  }

  // Toast notification helper
  function showToast(message) {
    const existing = document.getElementById("encrypt-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "encrypt-toast";
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

    document.body.appendChild(toast);
    requestAnimationFrame(() => (toast.style.opacity = "1"));
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 400);
    }, 2500);
  }
}
