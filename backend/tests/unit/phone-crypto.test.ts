import { describe, it, expect } from 'vitest';
import { normalizeBangladeshPhone, isValidBangladeshE164 } from '@/common/utils/phone.utils';
import {
  encryptSensitiveData,
  decryptSensitiveData,
  maskNid,
  validateBangladeshNid,
} from '@/common/utils/crypto.utils';
import { BadRequestError } from '@/common/errors/app-error';

describe('Phone and Crypto Utilities (Unit)', () => {
  describe('normalizeBangladeshPhone', () => {
    it('should normalize local 11-digit mobile numbers', () => {
      expect(normalizeBangladeshPhone('01712345678')).toBe('+8801712345678');
      expect(normalizeBangladeshPhone('01812345678')).toBe('+8801812345678');
      expect(normalizeBangladeshPhone('01912345678')).toBe('+8801912345678');
      expect(normalizeBangladeshPhone('01312345678')).toBe('+8801312345678');
      expect(normalizeBangladeshPhone('01412345678')).toBe('+8801412345678');
      expect(normalizeBangladeshPhone('01512345678')).toBe('+8801512345678');
      expect(normalizeBangladeshPhone('01612345678')).toBe('+8801612345678');
    });

    it('should handle numbers with leading 880 or +880', () => {
      expect(normalizeBangladeshPhone('8801712345678')).toBe('+8801712345678');
      expect(normalizeBangladeshPhone('+8801712345678')).toBe('+8801712345678');
    });

    it('should strip spaces and hyphens', () => {
      expect(normalizeBangladeshPhone('01712-345 678')).toBe('+8801712345678');
      expect(normalizeBangladeshPhone('+880 1712 345678')).toBe('+8801712345678');
    });

    it('should reject invalid mobile operator prefixes', () => {
      expect(() => normalizeBangladeshPhone('01012345678')).toThrow(BadRequestError);
      expect(() => normalizeBangladeshPhone('01112345678')).toThrow(BadRequestError);
      expect(() => normalizeBangladeshPhone('01212345678')).toThrow(BadRequestError);
    });

    it('should reject non-Bangladesh numbers or invalid lengths', () => {
      expect(() => normalizeBangladeshPhone('+12025550143')).toThrow(BadRequestError);
      expect(() => normalizeBangladeshPhone('01712345')).toThrow(BadRequestError);
      expect(() => normalizeBangladeshPhone('')).toThrow(BadRequestError);
    });

    it('should validate canonical E.164 with isValidBangladeshE164', () => {
      expect(isValidBangladeshE164('+8801712345678')).toBe(true);
      expect(isValidBangladeshE164('01712345678')).toBe(false);
      expect(isValidBangladeshE164('+8801012345678')).toBe(false);
    });
  });

  describe('AES-256-GCM Sensitive Data Encryption', () => {
    it('should encrypt and decrypt NID numbers accurately', () => {
      const nid = '19901234567890123';
      const encrypted = encryptSensitiveData(nid);

      expect(encrypted).not.toBe(nid);
      expect(encrypted.split(':')).toHaveLength(3); // iv:authTag:ciphertext

      const decrypted = decryptSensitiveData(encrypted);
      expect(decrypted).toBe(nid);
    });

    it('should produce different ciphertexts for identical plaintext due to random IV', () => {
      const nid = '1234567890';
      const enc1 = encryptSensitiveData(nid);
      const enc2 = encryptSensitiveData(nid);

      expect(enc1).not.toBe(enc2);
      expect(decryptSensitiveData(enc1)).toBe(nid);
      expect(decryptSensitiveData(enc2)).toBe(nid);
    });

    it('should mask NID numbers revealing only the last 4 digits', () => {
      expect(maskNid('1234567890')).toBe('******7890');
      expect(maskNid('19901234567890123')).toBe('*************0123');
      expect(maskNid('1234')).toBe('****');
      expect(maskNid('')).toBe('');
    });

    it('should validate Bangladesh National ID formats', () => {
      // 10 digits (Smart Card)
      expect(validateBangladeshNid('1234567890')).toBe(true);
      // 13 digits (Old NID)
      expect(validateBangladeshNid('1234567890123')).toBe(true);
      // 17 digits (Old NID with birth year)
      expect(validateBangladeshNid('19901234567890123')).toBe(true);

      // Invalid lengths
      expect(validateBangladeshNid('123456789')).toBe(false);
      expect(validateBangladeshNid('12345678901')).toBe(false);
      expect(validateBangladeshNid('12345678901234')).toBe(false);
      expect(validateBangladeshNid('abc1234567890')).toBe(false);
    });
  });
});
