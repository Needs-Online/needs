import { env } from './env';

export interface PaymentConfig {
  bkash: {
    appKey: string;
    appSecret: string;
    username: string;
    password: string;
    baseUrl: string;
  };
  nagad: {
    baseUrl: string;
    merchantId: string;
    publicKey: string;
    privateKey: string;
  };
  sslcommerz: {
    storeId: string;
    storePassword: string;
    isSandbox: boolean;
  };
}

export const paymentConfig: PaymentConfig = {
  bkash: {
    appKey: env.BKASH_APP_KEY,
    appSecret: env.BKASH_APP_SECRET,
    username: env.BKASH_USERNAME,
    password: env.BKASH_PASSWORD,
    baseUrl: env.BKASH_BASE_URL,
  },
  nagad: {
    baseUrl: env.NAGAD_BASE_URL,
    merchantId: env.NAGAD_MERCHANT_ID,
    publicKey: env.NAGAD_PUBLIC_KEY,
    privateKey: env.NAGAD_PRIVATE_KEY,
  },
  sslcommerz: {
    storeId: env.SSLCOMMERZ_STORE_ID,
    storePassword: env.SSLCOMMERZ_STORE_PASSWORD,
    isSandbox: env.SSLCOMMERZ_IS_SANDBOX,
  },
};
