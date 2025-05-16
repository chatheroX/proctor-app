
// /src/lib/crypto-utils.ts
'use client';

// WARNING: THIS IS A DEMONSTRATION AND USES A HARDCODED KEY.
// DO NOT USE THIS IN PRODUCTION WITHOUT A PROPER KEY MANAGEMENT STRATEGY.
// A securely managed, non-extractable key is crucial for real security.
const VERY_INSECURE_HARDCODED_KEY = 'your-very-insecure-32-byte-key!'; // Must be 16, 24, or 32 bytes for AES

async function getKeyMaterial(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyData = enc.encode(VERY_INSECURE_HARDCODED_KEY);
  if (keyData.byteLength !== 32) {
    console.error("Key material is not 32 bytes. Ensure it's a valid length for AES-256.");
    // Fallback to a generated key if the hardcoded one is invalid, though this won't allow decryption across sessions.
    return crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );
  }
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
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
    return null;
  }
}
