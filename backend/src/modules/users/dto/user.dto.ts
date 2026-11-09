import { z } from 'zod';

export const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  avatarUrl: z.string().url().optional(),
  language: z.enum(['en', 'bn']).optional(),
});

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;

export const createAddressSchema = z.object({
  label: z.string().min(1).max(50).default('Home'),
  addressLine: z.string().min(5).max(255),
  area: z.string().min(2).max(100),
  city: z.string().min(2).max(100),
  postalCode: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  isDefault: z.boolean().default(false),
});

export type CreateAddressDto = z.infer<typeof createAddressSchema>;
