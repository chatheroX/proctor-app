
'use client';

export function isSebEnvironment(): boolean {
  if (typeof window !== 'undefined' && window.navigator) {
    // Common SEB user agent substrings. This might need adjustment based on SEB versions.
    const sebKeywords = ['SEB', 'SafeExamBrowser'];
    const userAgent = window.navigator.userAgent;
    return sebKeywords.some(keyword => userAgent.includes(keyword));
  }
  return false;
}

export function isOnline(): boolean {
  if (typeof window !== 'undefined' && window.navigator) {
    return window.navigator.onLine;
  }
  return false; // Assume offline if not in browser
}

// Basic attempt to detect if developer tools might be open.
// This is NOT foolproof and can be easily bypassed. SEB's own protection is key.
export function areDevToolsLikelyOpen(): boolean {
  if (typeof window !== 'undefined') {
    const threshold = 160; // Arbitrary threshold
    return (window.outerWidth - window.innerWidth > threshold) ||
           (window.outerHeight - window.innerHeight > threshold);
  }
  return false;
}

export function isWebDriverActive(): boolean {
  if (typeof window !== 'undefined' && window.navigator) {
    return !!(navigator as any).webdriver;
  }
  return false;
}


export function attemptBlockShortcuts(event: KeyboardEvent): boolean {
  // Block Ctrl, Alt, Cmd (Meta) combinations with common keys
  // This is a basic attempt. SEB's configuration is more robust.
  if (event.ctrlKey || event.altKey || event.metaKey) {
    const forbiddenKeys = ['c', 'v', 'x', 'a', 'p', 's', 'f', 'r', 't', 'w', 'q', 'Tab', 'Escape'];
    if (forbiddenKeys.includes(event.key) || (event.key >= 'F1' && event.key <= 'F12')) {
      console.warn(`[SEB Utils] Blocked shortcut: ${event.key} with modifier`);
      event.preventDefault();
      return true;
    }
  }
  if ((event.key >= 'F1' && event.key <= 'F12') || event.key === 'Escape' || event.key === 'Tab') {
      console.warn(`[SEB Utils] Blocked key: ${event.key}`);
      event.preventDefault();
      return true;
  }

  // For MCQ, typically only mouse input is allowed. This function is more for general blocking.
  // If strict A-Z, arrow, mouse is needed, it's better handled by SEB config.
  // This example allows basic typing.
  const allowedRegex = /^[a-zA-Z0-9\s.,!?'"$%^&*()-_=+;:/<>@[\]{}`~]$/; // More permissive for general input
  const specialAllowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', 'Shift', ' '];

  if (!specialAllowedKeys.includes(event.key) && !allowedRegex.test(event.key) && !event.ctrlKey && !event.altKey && !event.metaKey) {
    // console.warn(`[SEB Utils] Blocked non-alphanumeric/special key: ${event.key}`);
    // event.preventDefault(); // Commented out to allow numbers, symbols etc.
    // return true;
  }

  return false;
}

export function disableContextMenu(event: MouseEvent): void {
  console.warn('[SEB Utils] Context menu blocked.');
  event.preventDefault();
}

export function disableCopyPaste(event: ClipboardEvent): void {
  console.warn(`[SEB Utils] ${event.type} event blocked.`);
  event.preventDefault();
}
    