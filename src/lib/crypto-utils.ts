
// /src/lib/crypto-utils.ts
'use client';

// WARNING: THIS IS A DEMONSTRATION AND USES A HARDCODED KEY.
// DO NOT USE THIS IN PRODUCTION WITHOUT A PROPER KEY MANAGEMENT STRATEGY.
// A securely managed, non-extractable key is crucial for real security.
const VERY_INSECURE_HARDCODED_KEY = 'this-is-a-32-byte-secret-key!!'; // Exactly 32 characters

async function getKeyMaterial(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyData = enc.encode(VERY_INSECURE_HARDCODED_KEY);
  if (keyData.byteLength !== 32) {
    const errorMessage = `CRITICAL: Encryption key is not 32 bytes long. Expected 32, got ${keyData.byteLength}. Please check configuration.`;
    console.error(errorMessage, "Key used:", VERY_INSECURE_HARDCODED_KEY);
    // Fallback to a generated key if the hardcoded one is invalid, though this won't allow decryption across sessions.
    // This fallback is problematic for consistent encryption/decryption, the hardcoded key *must* be correct.
    // For the purpose of this error, the primary issue is the hardcoded key's length.
    // A real application would throw a configuration error or have a more robust key provisioning.
    throw new Error(errorMessage);
  }
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false, // 'extractable' should be false for security unless explicitly needed
    ['encrypt', 'decrypt']
  );
}

export async function encryptData(data: Record<string, any>): Promise<string | null> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    console.error('Web Crypto API not available. Cannot encrypt.');
    return null;
  }
  try {
    const key = await getKeyMaterial();
    const iv = crypto.getRandomValues(new Uint8Array(12)); // Initialization vector
    const encodedData = new TextEncoder().encode(JSON.stringify(data));

    const encryptedContent = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      encodedData
    );

    const encryptedBuffer = new Uint8Array(encryptedContent);
    const resultBuffer = new Uint8Array(iv.length + encryptedBuffer.length);
    resultBuffer.set(iv);
    resultBuffer.set(encryptedBuffer, iv.length);

    // Convert buffer to Base64 string
    return btoa(String.fromCharCode.apply(null, Array.from(resultBuffer)));
  } catch (error) {
    console.error('Encryption failed:', error);
    return null;
  }
}

export async function decryptData<T = Record<string, any>>(encryptedBase64: string): Promise<T | null> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    console.error('Web Crypto API not available. Cannot decrypt.');
    return null;
  }
  try {
    const key = await getKeyMaterial();
    
    // Convert Base64 string back to buffer
    const encryptedDataWithIv = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
    
    const iv = encryptedDataWithIv.slice(0, 12);
    const encryptedContent = encryptedDataWithIv.slice(12);

    const decryptedContent = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      encryptedContent
    );

    const decodedData = new TextDecoder().decode(decryptedContent);
    return JSON.parse(decodedData) as T;
  } catch (error) {
    console.error('Decryption failed:', error);
    // More specific error for token tampering or key mismatch
    if (error instanceof DOMException && error.name === 'OperationError') {
        console.error('Decryption failed: Likely incorrect key or tampered/corrupt data.');
    }
    return null;
  }
}
