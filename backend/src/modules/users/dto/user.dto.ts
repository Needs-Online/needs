import { z } from 'zod';

export const updateProfileSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(100).optional(),
  email: z.string().email('Invalid email address').optional(),
  avatarUrl: z.string().url('Invalid avatar URL').optional(),
  language: z.enum(['en', 'bn']).optional(),
});

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;

export const bdLatitudeSchema = z
  .number({ required_error: 'Latitude is required' })
  .min(20.5, 'Latitude must be within Bangladesh boundaries (20.5 to 26.7)')
  .max(26.7, 'Latitude must be within Bangladesh boundaries (20.5 to 26.7)');

export const bdLongitudeSchema = z
  .number({ required_error: 'Longitude is required' })
  .min(88.0, 'Longitude must be within Bangladesh boundaries (88.0 to 92.7)')
  .max(92.7, 'Longitude must be within Bangladesh boundaries (88.0 to 92.7)');

export const createAddressSchema = z.object({
  label: z.string().min(1).max(50).default('Home'),
  addressLine: z.string().min(3, 'Address line must be at least 3 characters').max(255),
  area: z.string().min(2, 'Area is required').max(100),
  city: z.string().min(2, 'City is required').max(100),
  postalCode: z.string().optional(),
  latitude: bdLatitudeSchema,
  longitude: bdLongitudeSchema,
  isDefault: z.boolean().default(false),
});

export type CreateAddressDto = z.infer<typeof createAddressSchema>;

export const updateAddressSchema = z.object({
  label: z.string().min(1).max(50).optional(),
  addressLine: z.string().min(3).max(255).optional(),
  area: z.string().min(2).max(100).optional(),
  city: z.string().min(2).max(100).optional(),
  postalCode: z.string().optional(),
  latitude: bdLatitudeSchema.optional(),
  longitude: bdLongitudeSchema.optional(),
  isDefault: z.boolean().optional(),
});

export type UpdateAddressDto = z.infer<typeof updateAddressSchema>;
