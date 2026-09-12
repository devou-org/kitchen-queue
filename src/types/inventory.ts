export interface InventoryCategory {
  id: string;
  restaurant_id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryUnit {
  id: string;
  restaurant_id: string;
  name: string;
  short_code: string;
}

export interface Supplier {
  id: string;
  restaurant_id: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  gst_number?: string;
  outstanding_balance: number;
  is_active: boolean;
  total_purchases?: number;
  products_count?: number;
  last_purchase_date?: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  restaurant_id: string;
  name: string;
  category_id?: string;
  category_name?: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  max_stock?: number;
  cost_per_unit: number;
  supplier_id?: string;
  supplier_name?: string;
  storage_location?: string;
  track_batches: boolean;
  track_expiry: boolean;
  is_active: boolean;
  stock_status?: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  total_value?: number;
  created_at: string;
  updated_at: string;
}

export interface InventoryBatch {
  id: string;
  restaurant_id: string;
  item_id: string;
  item_name?: string;
  batch_number: string;
  initial_quantity: number;
  current_quantity: number;
  cost_per_unit: number;
  expiry_date?: string;
  received_date: string;
  supplier_id?: string;
  supplier_name?: string;
  status: 'ACTIVE' | 'DEPLETED' | 'EXPIRED';
  days_until_expiry?: number;
  created_at: string;
}

export type MovementType = 'PURCHASE' | 'CONSUMPTION' | 'WASTAGE' | 'ADJUSTMENT' | 'RETURN' | 'INITIAL';

export interface StockMovement {
  id: string;
  restaurant_id: string;
  item_id: string;
  item_name?: string;
  unit?: string;
  batch_id?: string;
  batch_number?: string;
  movement_type: MovementType;
  quantity: number;
  balance_after: number;
  unit_cost: number;
  total_cost: number;
  reference_type?: string;
  reference_id?: string;
  reason?: string;
  notes?: string;
  created_at: string;
}

export interface PurchaseOrderItem {
  id?: string;
  item_id: string;
  item_name?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  tax_rate?: number;
  total_price: number;
  batch_number?: string;
  expiry_date?: string;
}

export interface PurchaseOrder {
  id: string;
  restaurant_id: string;
  supplier_id?: string;
  supplier_name?: string;
  po_number: string;
  invoice_number?: string;
  received_date: string;
  status: 'DRAFT' | 'RECEIVED' | 'CANCELLED';
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  payment_status: 'PAID' | 'PARTIAL' | 'UNPAID';
  notes?: string;
  items?: PurchaseOrderItem[];
  created_at: string;
}

export type WastageReason =
  | 'SPOILAGE'
  | 'EXPIRED'
  | 'DAMAGED'
  | 'OVERPRODUCTION'
  | 'WRONG_PREPARATION'
  | 'STAFF_CONSUMPTION'
  | 'OTHER';

export interface WastageRecord {
  id: string;
  restaurant_id: string;
  item_id: string;
  item_name?: string;
  category_name?: string;
  batch_id?: string;
  batch_number?: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  reason: WastageReason;
  notes?: string;
  logged_at: string;
  created_at: string;
}

export interface StockAdjustment {
  id: string;
  restaurant_id: string;
  item_id: string;
  item_name?: string;
  unit?: string;
  system_stock: number;
  physical_stock: number;
  adjusted_quantity: number;
  reason: string;
  adjusted_at: string;
  created_at: string;
}

export interface RecipeItem {
  id?: string;
  recipe_id?: string;
  item_id: string;
  item_name?: string;
  unit?: string;
  cost_per_unit?: number;
  quantity: number;
  notes?: string;
}

export interface Recipe {
  id: string;
  restaurant_id: string;
  product_id: string;
  product_name?: string;
  product_price?: number;
  instructions?: string;
  yield_servings: number;
  items: RecipeItem[];
  total_cost?: number;
  created_at: string;
  updated_at: string;
}

export interface InventoryDashboardSummary {
  stock_value: number;
  total_items: number;
  low_stock_count: number;
  out_of_stock_count: number;
  expiring_soon_count: number;
  today_consumption: number;
  today_wastage: number;
  low_stock_items: {
    id: string;
    name: string;
    current_stock: number;
    min_stock: number;
    unit: string;
  }[];
  expiring_soon: {
    id: string;
    item_id: string;
    item_name: string;
    batch_number: string;
    current_quantity: number;
    unit: string;
    expiry_date: string;
    days_left: number;
  }[];
  recent_movements: StockMovement[];
}
