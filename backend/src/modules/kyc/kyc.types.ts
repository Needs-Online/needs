import { KycStatus } from '@/common/enums';

export interface ProviderKycResponse {
  id: string;
  providerId: string;
  maskedNid: string;
  nidFrontUrl: string;
  nidBackUrl: string;
  tradeLicenseNumber?: string | null;
  tradeLicenseUrl?: string | null;
  certificates?: unknown;
  status: KycStatus;
  rejectionReason?: string | null;
  reviewedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
