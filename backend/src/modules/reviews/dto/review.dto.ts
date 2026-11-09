import { z } from 'zod';

export const createReviewSchema = z.object({
  bookingId: z.string().uuid('Invalid booking ID'),
  rating: z.number().int().min(1).max(5, 'Rating must be between 1 and 5 stars'),
  comment: z.string().max(1000, 'Comment cannot exceed 1000 characters').optional(),
});

export type CreateReviewDto = z.infer<typeof createReviewSchema>;

export const listReviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type ListReviewsQueryDto = z.infer<typeof listReviewsQuerySchema>;
