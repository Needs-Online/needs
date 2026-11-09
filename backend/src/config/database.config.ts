import { env } from './env';

export interface DatabaseConfig {
  url: string;
}

export const databaseConfig: DatabaseConfig = {
  url: env.DATABASE_URL,
};
