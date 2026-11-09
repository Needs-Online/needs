import { env } from './env';

export interface JwtConfig {
  accessSecret: string;
  refreshSecret: string;
  accessExpirySeconds: number;
  refreshExpirySeconds: number;
}

export const jwtConfig: JwtConfig = {
  accessSecret: env.JWT_ACCESS_SECRET,
  refreshSecret: env.JWT_REFRESH_SECRET,
  accessExpirySeconds: env.JWT_ACCESS_EXPIRY,
  refreshExpirySeconds: env.JWT_REFRESH_EXPIRY,
};
