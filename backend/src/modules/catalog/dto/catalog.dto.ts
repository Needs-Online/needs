import { z } from 'zod';
import { PricingType } from '@/common/enums';

export const createCategorySchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be kebab-case lowercase'),
  description: z.string().optional(),
  iconUrl: z.string().url().optional(),
  sortOrder: z.number().int().default(0),
  parentId: z.string().uuid().optional(),
});

export type CreateCategoryDto = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be kebab-case lowercase').optional(),
  description: z.string().optional(),
  iconUrl: z.string().url().optional(),
  sortOrder: z.number().int().optional(),
  parentId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateCategoryDto = z.infer<typeof updateCategorySchema>;

export const createServiceSchema = z.object({
  categoryId: z.string().uuid('Invalid category ID'),
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be kebab-case lowercase'),
  description: z.string().optional(),
  basePrice: z.number().positive('Base price must be greater than 0'),
  pricingType: z.nativeEnum(PricingType).default(PricingType.FIXED),
  durationMinutes: z.number().int().positive().default(60),
});

export type CreateServiceDto = z.infer<typeof createServiceSchema>;

export const updateServiceSchema = z.object({
  categoryId: z.string().uuid('Invalid category ID').optional(),
  name: z.string().min(2).max(100).optional(),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be kebab-case lowercase').optional(),
  description: z.string().optional(),
  basePrice: z.number().positive('Base price must be greater than 0').optional(),
  pricingType: z.nativeEnum(PricingType).optional(),
  durationMinutes: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateServiceDto = z.infer<typeof updateServiceSchema>;
