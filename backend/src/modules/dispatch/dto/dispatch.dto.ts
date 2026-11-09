import { z } from 'zod';

export const rejectAssignmentSchema = z.object({
  reason: z.string().max(255).optional(),
});

export type RejectAssignmentDto = z.infer<typeof rejectAssignmentSchema>;
