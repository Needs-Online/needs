import crypto from 'crypto';
import { env } from '@/config/env';
import { BadRequestError } from '@/common/errors/app-error';

// Derive 32-byte master encryption key from JWT secret + salt
const MASTER_KEY = crypto.scryptSync(env.JWT_ACCESS_SECRET, 'needs-kyc-aes-256-salt', 32);
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM

/**
 * Encrypts sensitive string data (e.g. NID number) using AES-256-GCM.
 * Output format: "iv:authTag:ciphertext" in hex.
 */
export function encryptSensitiveData(plainText: string): string {
  if (!plainText) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, MASTER_KEY, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts data previously encrypted by encryptSensitiveData using AES-256-GCM.
 */
export function decryptSensitiveData(encryptedData: string): string {
  if (!encryptedData) return '';
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    // If plaintext or legacy unencrypted string, return as is safely
    return encryptedData;
  }

  const [ivHex, authTagHex, cipherHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, MASTER_KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Masks a sensitive NID number, revealing only the last 4 digits (e.g. "******1234").
 */
export function maskNid(nid: string): string {
  if (!nid) return '';
  const clean = nid.trim();
  if (clean.length <= 4) {
    return '****';
  }
  const lastFour = clean.slice(-4);
  const maskedPrefix = '*'.repeat(clean.length - 4);
  return `${maskedPrefix}${lastFour}`;
}

/**
 * Validates Bangladesh National ID number format:
 * - 10 digits (Smart NID)
 * - 13 digits (Old NID)
 * - 17 digits (Old NID with 4-digit birth year prefix)
 */
export function validateBangladeshNid(nid: string): boolean {
  if (!nid || typeof nid !== 'string') return false;
  const clean = nid.trim();
  return /^(?:\d{10}|\d{13}|\d{17})$/.test(clean);
}

/**
 * Asserts valid Bangladesh NID or throws BadRequestError.
 */
export function assertValidBangladeshNid(nid: string): void {
  if (!validateBangladeshNid(nid)) {
    throw new BadRequestError(
      'Invalid Bangladesh National ID format. Must be 10 digits (Smart Card), 13 digits, or 17 digits (with birth year).'
    );
  }
}
