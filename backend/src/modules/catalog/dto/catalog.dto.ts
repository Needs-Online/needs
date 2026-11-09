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
