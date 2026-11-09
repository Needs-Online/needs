import { env } from './env';

export interface AppConfig {
  env: 'development' | 'production' | 'test';
  port: number;
  socketPort: number;
  appUrl: string;
  corsOrigin: string | string[];
}

export const appConfig: AppConfig = {
  env: env.NODE_ENV,
  port: env.PORT,
  socketPort: env.SOCKET_PORT,
  appUrl: env.APP_URL,
  corsOrigin: env.CORS_ORIGIN.includes(',')
    ? env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : env.CORS_ORIGIN,
};
