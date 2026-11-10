import { logger } from '@/common/utils/logger';

export interface AnalyticsEvent {
  eventName: string;
  eventType: string;
  anonymousId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

/**
 * ClickHouse Analytics Event Adapter.
 * Prepares events for append-only OLAP streaming while strictly sanitizing PII.
 */
export class ClickHouseAdapter {
  async trackEvent(event: AnalyticsEvent): Promise<void> {
    const sanitized = this.sanitizePII(event);
    logger.info({ event: sanitized }, 'Analytics event buffered for OLAP ingestion');
  }

  private sanitizePII(event: AnalyticsEvent): AnalyticsEvent {
    const sanitizedMeta = { ...(event.metadata || {}) };

    // Strip sensitive fields (case-insensitive substring check)
    const sensitiveKeys = ['nid', 'phone', 'token', 'password', 'otp', 'creditcard', 'account', 'card'];
    for (const key of Object.keys(sanitizedMeta)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
        sanitizedMeta[key] = '[REDACTED]';
      }
    }

    return {
      eventName: event.eventName,
      eventType: event.eventType,
      anonymousId: event.anonymousId,
      userId: event.userId,
      metadata: sanitizedMeta,
      timestamp: event.timestamp || new Date().toISOString(),
    };
  }
}
