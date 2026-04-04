// ============================================
// CONSTANTS
// ============================================

export const ORDER_STATUSES = {
  PENDING: 'PENDING',
  READY: 'READY',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export const PRODUCT_STATUSES = {
  AVAILABLE: 'AVAILABLE',
  LOW_STOCK: 'LOW_STOCK',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
} as const;

export const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['READY', 'COMPLETED', 'CANCELLED'],
  READY: ['COMPLETED', 'CANCELLED', 'PENDING'],
  COMPLETED: ['PENDING'],
  CANCELLED: ['PENDING'],
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
  READY: '#06A77D',
  COMPLETED: '#6B7280',
  CANCELLED: '#C1272D',
  AVAILABLE: '#06A77D',
  LOW_STOCK: '#FFA500',
  OUT_OF_STOCK: '#C1272D',
};

export const STATUS_BG: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  READY: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-800',
};
