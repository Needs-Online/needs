import { BadRequestError } from '@/common/errors/app-error';

/**
 * Bangladesh mobile operators pattern:
 * 013, 017 (Grameenphone)
 * 014, 019 (Banglalink)
 * 015 (Teletalk)
 * 016, 018 (Robi / Airtel)
 * Total national digits: 11 (e.g. 01712345678)
 * Canonical E.164 format: +8801XXXXXXXXX (14 characters)
 */
const BD_PHONE_REGEX = /^(?:\+8801|8801|01)[3-9]\d{8}$/;
const BD_E164_REGEX = /^\+8801[3-9]\d{8}$/;

/**
 * Normalizes any valid Bangladesh mobile number into canonical E.164 format (+8801XXXXXXXXX).
 * Throws BadRequestError if the input format is invalid.
 */
export function normalizeBangladeshPhone(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new BadRequestError('Phone number is required');
  }

  // Strip whitespace, hyphens, and parentheses
  const cleaned = input.trim().replace(/[\s\-()]/g, '');

  if (!BD_PHONE_REGEX.test(cleaned)) {
    throw new BadRequestError(
      'Invalid Bangladesh mobile number. Must be an 11-digit number starting with 013-019 (e.g. 017XXXXXXXX) or E.164 (+8801XXXXXXXXX)'
    );
  }

  if (cleaned.startsWith('+880')) {
    return cleaned;
  }
  if (cleaned.startsWith('880')) {
    return `+${cleaned}`;
  }
  if (cleaned.startsWith('01')) {
    return `+88${cleaned}`;
  }

  throw new BadRequestError('Invalid phone number format');
}

/**
 * Validates whether a given string is in canonical E.164 Bangladesh mobile format.
 */
export function isValidBangladeshE164(phone: string): boolean {
  return BD_E164_REGEX.test(phone);
}
