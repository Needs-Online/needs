export enum Role {
  CUSTOMER = 'CUSTOMER',
  PROVIDER = 'PROVIDER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
  OPERATIONS = 'OPERATIONS',
  SUPPORT = 'SUPPORT',
  FINANCE = 'FINANCE',
}

export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DELETED = 'DELETED',
}

export enum ProviderStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED',
}

export enum KycStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum PricingType {
  FIXED = 'FIXED',
  HOURLY = 'HOURLY',
  CUSTOM_QUOTE = 'CUSTOM_QUOTE',
}

export enum BookingStatus {
  DRAFT = 'DRAFT',
  REQUESTED = 'REQUESTED',
  MATCHING = 'MATCHING',
  ASSIGNED = 'ASSIGNED',
  PROVIDER_EN_ROUTE = 'PROVIDER_EN_ROUTE',
  PROVIDER_ARRIVED = 'PROVIDER_ARRIVED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum AssignmentStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  TIMEOUT = 'TIMEOUT',
  CANCELLED = 'CANCELLED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentMethod {
  BKASH = 'BKASH',
  NAGAD = 'NAGAD',
  SSLCOMMERZ = 'SSLCOMMERZ',
  WALLET = 'WALLET',
  CASH = 'CASH',
}

export enum TransactionType {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
}

export enum TransactionReason {
  BOOKING_PAYMENT = 'BOOKING_PAYMENT',
  PROVIDER_EARNING = 'PROVIDER_EARNING',
  COMMISSION_FEE = 'COMMISSION_FEE',
  WITHDRAWAL = 'WITHDRAWAL',
  REFUND = 'REFUND',
  WALLET_TOPUP = 'WALLET_TOPUP',
}

export enum PayoutStatus {
  REQUESTED = 'REQUESTED',
  PROCESSING = 'PROCESSING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
}

export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

export enum TicketStatus {
  OPEN = 'OPEN',
  IN_REVIEW = 'IN_REVIEW',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum NotificationChannel {
  PUSH = 'PUSH',
  SMS = 'SMS',
  IN_APP = 'IN_APP',
}
