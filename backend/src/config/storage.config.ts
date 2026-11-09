import { env } from './env';

export interface StorageConfig {
  endpoint: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  region: string;
}

export const storageConfig: StorageConfig = {
  endpoint: env.S3_ENDPOINT,
  bucket: env.S3_BUCKET,
  accessKey: env.S3_ACCESS_KEY,
  secretKey: env.S3_SECRET_KEY,
  region: env.S3_REGION,
};
