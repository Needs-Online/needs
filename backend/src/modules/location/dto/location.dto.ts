import { z } from 'zod';

export const updateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
  longitude: z.number().min(-180).max(180, 'Longitude must be between -180 and 180'),
  city: z.string().min(1).default('Dhaka'),
});

export type UpdateLocationDto = z.infer<typeof updateLocationSchema>;

export const getNearbyProvidersSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
  longitude: z.coerce.number().min(-180).max(180, 'Longitude must be between -180 and 180'),
  radiusMeters: z.coerce.number().min(100).max(50000).default(5000),
  categoryId: z.string().uuid().optional(),
  city: z.string().default('Dhaka'),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type GetNearbyProvidersDto = z.infer<typeof getNearbyProvidersSchema>;
