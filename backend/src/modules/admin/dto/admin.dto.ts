import { z } from 'zod';
import { ProviderStatus } from '@/common/enums';

export const reviewProviderSchema = z.object({
  status: z.enum([ProviderStatus.APPROVED, ProviderStatus.REJECTED]),
  reason: z.string().min(3).max(500).optional(),
});

export type ReviewProviderDto = z.infer<typeof reviewProviderSchema>;

export const suspendProviderSchema = z.object({
  isSuspended: z.boolean(),
  reason: z.string().min(5, 'Reason for suspension/unsuspension is required').max(500),
});

export type SuspendProviderDto = z.infer<typeof suspendProviderSchema>;

export const queryAuditLogsSchema = z.object({
  actorId: z.string().uuid().optional(),
  targetResource: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type QueryAuditLogsDto = z.infer<typeof queryAuditLogsSchema>;
