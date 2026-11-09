import { Role } from '@/common/enums';

export interface OtpSessionData {
  phone: string;
  otpHash: string;
  attempts: number;
  createdAt: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    phone: string;
    fullName: string | null;
    role: Role;
    avatarUrl: string | null;
    language: string;
  };
}
