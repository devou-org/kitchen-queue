// ============================================
// CONSTANTS
// ============================================

export const ORDER_STATUSES = {
  PENDING: 'PENDING',
  PREPARING: 'PREPARING',
  READY: 'READY',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
} as const;

export const PRODUCT_STATUSES = {
  AVAILABLE: 'AVAILABLE',
  LOW_STOCK: 'LOW_STOCK',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
} as const;

export const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['PREPARING', 'READY', 'PAID', 'CANCELLED', 'EXPIRED'],
  PREPARING: ['READY', 'PAID', 'CANCELLED', 'PENDING', 'EXPIRED'],
  READY: ['PAID', 'CANCELLED', 'PENDING', 'PREPARING', 'EXPIRED'],
  PAID: ['PENDING', 'CANCELLED', 'PREPARING', 'READY', 'EXPIRED'],
  CANCELLED: ['PENDING'],
  EXPIRED: ['PENDING'],
};

export const TAX_RATE = 0; // Tax removed

export const ITEMS_PER_PAGE = 20;
export const ORDERS_PER_PAGE = 50;

export const OTP_EXPIRY_SECONDS = 600; // 10 minutes
export const OTP_MAX_ATTEMPTS = 3;
export const OTP_RATE_LIMIT_SECONDS = 60;

export const JWT_CUSTOMER_EXPIRY = '7d';
export const JWT_ADMIN_EXPIRY = '8h';

export const CURRENCY_SYMBOL = '₹';

export const STATUS_COLORS: Record<string, string> = {
  PENDING: '#FFA500',
  PREPARING: '#3B82F6',
  READY: '#06A77D',
  PAID: '#6B7280',
  CANCELLED: '#C1272D',
  EXPIRED: '#6B7280',
  AVAILABLE: '#06A77D',
  LOW_STOCK: '#FFA500',
  OUT_OF_STOCK: '#C1272D',
};

export const STATUS_BG: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PREPARING: 'bg-blue-100 text-blue-800',
  READY: 'bg-green-100 text-green-800',
  PAID: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-800',
  EXPIRED: 'bg-gray-100 text-gray-600',
};
