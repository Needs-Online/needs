import { z } from 'zod';

// Load .env in local / test runtimes if available
try {
  // Node 20.6.0+ native env file loader
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile();
  }
} catch {
  // Ignore if .env doesn't exist
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3000),
    SOCKET_PORT: z.coerce.number().default(4001),
    APP_URL: z.string().default('http://localhost:3000'),
    CORS_ORIGIN: z.string().default('*'),

    // Database & Redis
    DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/needs_db?schema=public'),
    REDIS_URL: z.string().default('redis://localhost:6379'),

    // JWT
    JWT_ACCESS_SECRET: z.string().default('needs_super_secret_jwt_access_key_min_32_characters_long_2026'),
    JWT_REFRESH_SECRET: z.string().default('needs_super_secret_jwt_refresh_key_min_32_characters_long_2026'),
    JWT_ACCESS_EXPIRY: z.coerce.number().default(900), // 15 min
    JWT_REFRESH_EXPIRY: z.coerce.number().default(604800), // 7 days

    // OTP
    OTP_EXPIRY_SECONDS: z.coerce.number().default(300), // 5 min
    OTP_MAX_RESEND_PER_HOUR: z.coerce.number().default(3),
    OTP_MAX_ATTEMPTS: z.coerce.number().default(5),

    // Payment Gateways
    BKASH_APP_KEY: z.string().optional().default('bkash_sandbox_app_key'),
    BKASH_APP_SECRET: z.string().optional().default('bkash_sandbox_app_secret'),
    BKASH_USERNAME: z.string().optional().default('bkash_sandbox_username'),
    BKASH_PASSWORD: z.string().optional().default('bkash_sandbox_password'),
    BKASH_BASE_URL: z.string().optional().default('https://tokenized.sandbox.bka.sh/v2.0'),

    NAGAD_BASE_URL: z.string().optional().default('https://sandbox.mynagad.com:10080/remote-payment-gateway-1.0/api/dfs'),
    NAGAD_MERCHANT_ID: z.string().optional().default('NAGAD_SANDBOX_MERCHANT'),
    NAGAD_PUBLIC_KEY: z.string().optional().default(''),
    NAGAD_PRIVATE_KEY: z.string().optional().default(''),

    SSLCOMMERZ_STORE_ID: z.string().optional().default('needs_sandbox_store'),
    SSLCOMMERZ_STORE_PASSWORD: z.string().optional().default('needs_sandbox_password'),
    SSLCOMMERZ_IS_SANDBOX: z.coerce.boolean().default(true),

    // Notifications
    FCM_PROJECT_ID: z.string().optional().default('needs-platform'),
    FCM_CLIENT_EMAIL: z.string().optional().default(''),
    FCM_PRIVATE_KEY: z.string().optional().default(''),

    // SMS
    SMS_GATEWAY_URL: z.string().optional().default(''),
    SMS_GATEWAY_API_KEY: z.string().optional().default(''),
    SMS_GATEWAY_SID: z.string().optional().default('NEEDS'),

    // S3 / Storage
    S3_ENDPOINT: z.string().optional().default('http://localhost:9000'),
    S3_BUCKET: z.string().optional().default('needs-storage'),
    S3_ACCESS_KEY: z.string().optional().default('minio_access'),
    S3_SECRET_KEY: z.string().optional().default('minio_secret'),
    S3_REGION: z.string().optional().default('us-east-1'),
  })
  .superRefine((data, ctx) => {
    // In production runtime (excluding static build step), strictly reject default secrets
    const isBuildStep =
      process.env.npm_lifecycle_event === 'build' ||
      process.env.NEXT_PHASE === 'phase-production-build';

    if (data.NODE_ENV === 'production' && !isBuildStep) {
      if (!process.env.DATABASE_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'DATABASE_URL must be explicitly provided in production runtime',
          path: ['DATABASE_URL'],
        });
      }
      if (!process.env.REDIS_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'REDIS_URL must be explicitly provided in production runtime',
          path: ['REDIS_URL'],
        });
      }
      if (
        !process.env.JWT_ACCESS_SECRET ||
        process.env.JWT_ACCESS_SECRET === 'needs_super_secret_jwt_access_key_min_32_characters_long_2026'
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'JWT_ACCESS_SECRET must be explicitly provided in production and cannot be the default development secret',
          path: ['JWT_ACCESS_SECRET'],
        });
      }
      if (
        !process.env.JWT_REFRESH_SECRET ||
        process.env.JWT_REFRESH_SECRET === 'needs_super_secret_jwt_refresh_key_min_32_characters_long_2026'
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'JWT_REFRESH_SECRET must be explicitly provided in production and cannot be the default development secret',
          path: ['JWT_REFRESH_SECRET'],
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment variables:', result.error.format());
    throw new Error('Environment variable validation failed');
  }
  return result.data;
}

export const env = validateEnv();
