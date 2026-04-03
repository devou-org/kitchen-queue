// ============================================
// CULINARY CONDUCTOR - TypeScript Types
// ============================================

export type ProductStatus = 'AVAILABLE' | 'LOW_STOCK' | 'OUT_OF_STOCK';
export type OrderStatus = 'PENDING' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';

export interface User {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  is_admin: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  stock_quantity: number;
  buffer_quantity: number;
  status: ProductStatus;
  category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price_at_purchase: number;
  product_name?: string;
  product_image?: string;
}

export interface Order {
  id: string;
  ticket_number: number;
  customer_name: string;
  phone: string;
  total_price: number;
  status: OrderStatus;
  is_paid: boolean;
  notes?: string;
  party_size?: number;
  created_at: string;
  completed_at: string | null;
  updated_at: string;
  items?: OrderItem[];
}

export interface QueueState {
  id: number;
  current_queue_number: number;
  last_served_number: number;
  created_at: string;
  updated_at: string;
}

export interface QueueHistory {
  id: string;
  action: string;
  queue_number: number | null;
  details_json: Record<string, unknown> | null;
  created_at: string;
}

export interface AnalyticsDaily {
  id: string;
  date: string;
  total_orders: number;
  revenue: number;
  avg_wait_time: number;
  peak_hour: number | null;
  created_at: string;
}

export interface CartItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  image_url: string;
  status: ProductStatus;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  per_page: number;
}

// SSE Event types
export interface QueueUpdateEvent {
  type: 'queue_update' | 'product_update' | 'heartbeat';
  queue_number?: number;
  last_served_number?: number;
  timestamp: string;
  product_id?: string;
  product_status?: ProductStatus;
}

// Analytics types
export interface PeakHourData {
  hour: number;
  order_count: number;
  revenue: number;
}

export interface TopProductData {
  product_id: string;
  name: string;
  total_units: number;
  revenue: number;
  percentage: number;
}

export interface QueueMetricData {
  date: string;
  avg_wait_time: number;
  customers_served: number;
}

export interface DashboardStats {
  revenue_today: number;
  orders_today: number;
  avg_order_value: number;
  current_queue_number: number;
  pending_orders: number;
  low_stock_items: number;
  peak_hour: string;
}
