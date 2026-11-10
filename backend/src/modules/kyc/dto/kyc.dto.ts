import { z } from 'zod';
import { KycStatus } from '@/common/enums';
import { validateBangladeshNid } from '@/common/utils/crypto.utils';

export const submitKycSchema = z.object({
  nidNumber: z
    .string()
    .min(10, 'NID must be at least 10 characters')
    .max(17, 'NID must be at most 17 characters')
    .refine(
      (val) => validateBangladeshNid(val),
      'Invalid Bangladesh National ID format. Must be 10 digits (Smart Card), 13 digits, or 17 digits (with birth year).'
    ),
  nidFrontUrl: z.string().url('NID Front URL must be a valid URL'),
  nidBackUrl: z.string().url('NID Back URL must be a valid URL'),
  tradeLicenseNumber: z.string().optional(),
  tradeLicenseUrl: z.string().url('Trade License URL must be a valid URL').optional(),
  certificates: z.array(z.string().url('Certificate must be a valid URL')).optional(),
});

export type SubmitKycDto = z.infer<typeof submitKycSchema>;

export const reviewKycSchema = z
  .object({
    status: z.enum([KycStatus.APPROVED, KycStatus.REJECTED]),
    rejectionReason: z.string().min(5).max(500).optional(),
  })
  .refine(
    (data) => {
      if (data.status === KycStatus.REJECTED && !data.rejectionReason) {
        return false;
      }
      return true;
    },
    {
      message: 'Rejection reason is required when rejecting KYC',
      path: ['rejectionReason'],
    }
  );

export type ReviewKycDto = z.infer<typeof reviewKycSchema>;
