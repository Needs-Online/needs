import { z } from 'zod';
import { KycStatus } from '@/common/enums';

export const registerProviderSchema = z.object({
  bio: z.string().max(500).optional(),
  experienceYears: z.number().int().min(0).max(50).default(0),
  serviceIds: z.array(z.string().uuid()).min(1, 'At least one service category must be selected'),
});

export type RegisterProviderDto = z.infer<typeof registerProviderSchema>;

export const applyProviderSchema = registerProviderSchema;
export type ApplyProviderDto = RegisterProviderDto;

export const updateProviderMeSchema = z.object({
  bio: z.string().max(500).optional(),
  experienceYears: z.number().int().min(0).max(50).optional(),
});

export type UpdateProviderMeDto = z.infer<typeof updateProviderMeSchema>;

export const updateProviderServicesSchema = z.object({
  serviceIds: z.array(z.string().uuid()).min(1, 'At least one service must be selected'),
});

export type UpdateProviderServicesDto = z.infer<typeof updateProviderServicesSchema>;

export const submitKycSchema = z.object({
  nidNumber: z.string().min(10, 'NID must be at least 10 characters').max(30),
  nidFrontUrl: z.string().url('NID Front URL must be a valid URL'),
  nidBackUrl: z.string().url('NID Back URL must be a valid URL'),
  tradeLicenseNumber: z.string().optional(),
  tradeLicenseUrl: z.string().url().optional(),
  certificates: z.array(z.string().url()).optional(),
});

export type SubmitKycDto = z.infer<typeof submitKycSchema>;

export const updateAvailabilitySchema = z.object({
  isAvailable: z.boolean(),
});

export type UpdateAvailabilityDto = z.infer<typeof updateAvailabilitySchema>;

export const verifyKycSchema = z.object({
  providerId: z.string().uuid(),
  status: z.enum([KycStatus.APPROVED, KycStatus.REJECTED]),
  rejectionReason: z.string().optional(),
});

export type VerifyKycDto = z.infer<typeof verifyKycSchema>;

export const assignServiceSchema = z.object({
  serviceId: z.string().uuid(),
  customPrice: z.number().positive().optional(),
});

export type AssignServiceDto = z.infer<typeof assignServiceSchema>;
