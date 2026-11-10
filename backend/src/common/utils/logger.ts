import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  transport: !isProduction
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  redact: {
    paths: [
      'req.headers.authorization',
      'password',
      '*.password',
      'token',
      '*.token',
      'refreshToken',
      '*.refreshToken',
      'otp',
      '*.otp',
      'rawOtp',
      '*.rawOtp',
      'startOtp',
      '*.startOtp',
      'endOtp',
      '*.endOtp',
      'nidNumber',
      '*.nidNumber',
      'tradeLicenseNumber',
      '*.tradeLicenseNumber',
      'nidFrontUrl',
      '*.nidFrontUrl',
      'nidBackUrl',
      '*.nidBackUrl',
      'creditCard',
      '*.creditCard',
      'cardNumber',
      '*.cardNumber',
      'cvv',
      '*.cvv',
      'accountNumber',
      '*.accountNumber',
    ],
    censor: '***REDACTED***',
  },
});
