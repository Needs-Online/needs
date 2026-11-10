import { z } from 'zod';
import { bdLatitudeSchema, bdLongitudeSchema } from '@/modules/users/dto/user.dto';

export const updateLocationSchema = z.object({
  latitude: bdLatitudeSchema,
  longitude: bdLongitudeSchema,
  city: z.string().min(1).default('Dhaka'),
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().min(0).optional(),
  accuracy: z.number().min(0).optional(),
});

export type UpdateLocationDto = z.infer<typeof updateLocationSchema>;

export const getNearbyProvidersSchema = z.object({
  latitude: bdLatitudeSchema,
  longitude: bdLongitudeSchema,
  radiusMeters: z.coerce.number().min(100).max(50000).default(5000),
  categoryId: z.string().uuid().optional(),
  city: z.string().default('Dhaka'),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type GetNearbyProvidersDto = z.infer<typeof getNearbyProvidersSchema>;
