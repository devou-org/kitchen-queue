/**
 * Centralized Kitchen Workflow Module (Qdine KOT / KDS Architecture)
 * ===================================================================
 * Defines the state machines, lifecycles, and transition rules for both
 * KOT (Kitchen Order Ticket) and KDS (Kitchen Display System) modes.
 *
 * Lifecycles:
 * - KOT Mode: PENDING → PREPARING → SERVED → CLOSED
 * - KDS Mode: PENDING → PREPARING → READY → SERVED → CLOSED
 * ===================================================================
 */

export type KitchenMode = 'KOT' | 'KDS';

export type OrderStatus =
  | 'PENDING'
  | 'PREPARING'
  | 'READY'
  | 'SERVED'
  | 'CLOSED'
  | 'CANCELLED'
  | 'EXPIRED';

export type OrderItemStatus =
  | 'PENDING'
  | 'PREPARING'
  | 'READY'
  | 'SERVED'
  | 'CANCELLED'
  | 'REJECTED';

export interface KitchenWorkflowConfig {
  kitchenMode: KitchenMode;
  kitchenCompletionStatus: OrderItemStatus; // 'SERVED' for KOT, 'READY' for KDS
  usesReadyState: boolean;                  // false for KOT, true for KDS
  shouldPrintKotOnPreparing: boolean;       // true for KOT, false for KDS
  orderLifecycle: OrderStatus[];
  itemLifecycle: OrderItemStatus[];
  allowedOrderTransitions: Record<OrderStatus, OrderStatus[]>;
  allowedItemTransitions: Record<OrderItemStatus, OrderItemStatus[]>;
}

export const KITCHEN_WORKFLOWS: Record<KitchenMode, KitchenWorkflowConfig> = {
  KOT: {
    kitchenMode: 'KOT',
    kitchenCompletionStatus: 'SERVED',
    usesReadyState: false,
    shouldPrintKotOnPreparing: true,
    orderLifecycle: ['PENDING', 'PREPARING', 'SERVED', 'CLOSED'],
    itemLifecycle: ['PENDING', 'PREPARING', 'SERVED'],
    allowedOrderTransitions: {
      PENDING: ['PREPARING', 'CANCELLED', 'EXPIRED'],
      PREPARING: ['SERVED', 'CANCELLED', 'EXPIRED'],
      READY: ['SERVED', 'CANCELLED'], // Graceful compatibility if old orders have READY
      SERVED: ['CLOSED'],
      CLOSED: [],
      CANCELLED: ['PENDING'],
      EXPIRED: ['PENDING'],
    },
    allowedItemTransitions: {
      PENDING: ['PREPARING', 'CANCELLED', 'REJECTED'],
      PREPARING: ['SERVED', 'CANCELLED', 'REJECTED'],
      READY: ['SERVED', 'CANCELLED'],
      SERVED: [],
      CANCELLED: ['PENDING'],
      REJECTED: ['PENDING'],
    },
  },
  KDS: {
    kitchenMode: 'KDS',
    kitchenCompletionStatus: 'READY',
    usesReadyState: true,
    shouldPrintKotOnPreparing: false,
    orderLifecycle: ['PENDING', 'PREPARING', 'READY', 'SERVED', 'CLOSED'],
    itemLifecycle: ['PENDING', 'PREPARING', 'READY', 'SERVED'],
    allowedOrderTransitions: {
      PENDING: ['PREPARING', 'CANCELLED', 'EXPIRED'],
      PREPARING: ['READY', 'CANCELLED', 'EXPIRED'],
      READY: ['SERVED', 'CANCELLED', 'EXPIRED'],
      SERVED: ['CLOSED'],
      CLOSED: [],
      CANCELLED: ['PENDING'],
      EXPIRED: ['PENDING'],
    },
    allowedItemTransitions: {
      PENDING: ['PREPARING', 'CANCELLED', 'REJECTED'],
      PREPARING: ['READY', 'CANCELLED', 'REJECTED'],
      READY: ['SERVED', 'CANCELLED'],
      SERVED: [],
      CANCELLED: ['PENDING'],
      REJECTED: ['PENDING'],
    },
  },
};

/**
 * Normalizes input mode string to a valid KitchenMode ('KOT' | 'KDS'). Defaults to 'KOT'.
 */
export function normalizeKitchenMode(mode?: string | null): KitchenMode {
  if (mode && typeof mode === 'string' && mode.trim().toUpperCase() === 'KDS') {
    return 'KDS';
  }
  return 'KOT';
}

/**
 * Returns the workflow configuration for the specified kitchen mode.
 */
export function getKitchenWorkflow(mode?: string | null): KitchenWorkflowConfig {
  const normalized = normalizeKitchenMode(mode);
  return KITCHEN_WORKFLOWS[normalized];
}

/**
 * Checks whether a given status is a recognized OrderStatus.
 * NOTE: 'PAID' is explicitly NOT an order status.
 */
export function isValidOrderStatus(status: string): status is OrderStatus {
  const valid: OrderStatus[] = ['PENDING', 'PREPARING', 'READY', 'SERVED', 'CLOSED', 'CANCELLED', 'EXPIRED'];
  return valid.includes(status.toUpperCase() as OrderStatus);
}

/**
 * Checks whether a given item status is a recognized OrderItemStatus.
 */
export function isValidOrderItemStatus(status: string): status is OrderItemStatus {
  const valid: OrderItemStatus[] = ['PENDING', 'PREPARING', 'READY', 'SERVED', 'CANCELLED', 'REJECTED'];
  return valid.includes(status.toUpperCase() as OrderItemStatus);
}

/**
 * Checks if a transition between two order statuses is permitted for a kitchen mode.
 */
export function canTransitionOrder(
  currentStatus: string,
  targetStatus: string,
  mode: string | null = 'KOT'
): boolean {
  const cur = (currentStatus || '').toUpperCase() as OrderStatus;
  const target = (targetStatus || '').toUpperCase() as OrderStatus;
  if (!isValidOrderStatus(cur) || !isValidOrderStatus(target)) return false;
  if (cur === target) return true;

  const config = getKitchenWorkflow(mode);
  const allowed = config.allowedOrderTransitions[cur] || [];
  return allowed.includes(target);
}

/**
 * Checks if a transition between two item statuses is permitted for a kitchen mode.
 */
export function canTransitionItem(
  currentStatus: string,
  targetStatus: string,
  mode: string | null = 'KOT'
): boolean {
  const cur = (currentStatus || '').toUpperCase() as OrderItemStatus;
  const target = (targetStatus || '').toUpperCase() as OrderItemStatus;
  if (!isValidOrderItemStatus(cur) || !isValidOrderItemStatus(target)) return false;
  if (cur === target) return true;

  const config = getKitchenWorkflow(mode);
  const allowed = config.allowedItemTransitions[cur] || [];
  return allowed.includes(target);
}

/**
 * Returns the next logical status in the kitchen workflow.
 */
export function getNextOrderStatus(currentStatus: string, mode: string | null = 'KOT'): OrderStatus | null {
  const config = getKitchenWorkflow(mode);
  const cur = (currentStatus || '').toUpperCase() as OrderStatus;
  const idx = config.orderLifecycle.indexOf(cur);
  if (idx !== -1 && idx < config.orderLifecycle.length - 1) {
    return config.orderLifecycle[idx + 1];
  }
  return null;
}

/**
 * Returns the next logical status for an individual order item.
 */
export function getNextItemStatus(currentStatus: string, mode: string | null = 'KOT'): OrderItemStatus | null {
  const config = getKitchenWorkflow(mode);
  const cur = (currentStatus || '').toUpperCase() as OrderItemStatus;
  const idx = config.itemLifecycle.indexOf(cur);
  if (idx !== -1 && idx < config.itemLifecycle.length - 1) {
    return config.itemLifecycle[idx + 1];
  }
  return null;
}

/**
 * Resolves the parent order status based on its items and the restaurant kitchen mode.
 *
 * Rules:
 * 1. Terminal states (CLOSED, CANCELLED, EXPIRED) are never automatically overwritten.
 * 2. If no items or all items cancelled/rejected -> CANCELLED.
 * 3. If any item is PREPARING, or if progress is mixed (some done/ready and some pending) -> PREPARING.
 * 4. If all active items are PENDING -> PENDING.
 * 5. When all active items are completed:
 *    - In KOT: all active are READY or SERVED -> Order becomes SERVED.
 *    - In KDS: all active must be SERVED to become SERVED. If active are READY (or mix of READY & SERVED) -> Order becomes READY.
 * 6. An order NEVER automatically becomes CLOSED. CLOSED only occurs through the close/billing operation!
 */
export function resolveOrderStatusFromItems(
  items: Array<{ status?: string }>,
  mode: string | null = 'KOT',
  currentOrderStatus?: string
): OrderStatus {
  const cur = (currentOrderStatus || '').toUpperCase() as OrderStatus;
  if (['CLOSED', 'CANCELLED', 'EXPIRED'].includes(cur)) {
    return cur;
  }

  const activeItems = (items || []).filter((i) => {
    const st = (i.status || 'PENDING').toUpperCase();
    return st !== 'CANCELLED' && st !== 'REJECTED';
  });

  if (activeItems.length === 0) {
    return (items || []).length > 0 ? 'CANCELLED' : cur || 'PENDING';
  }

  const counts = {
    PENDING: 0,
    PREPARING: 0,
    READY: 0,
    SERVED: 0,
  };

  activeItems.forEach((item) => {
    const st = (item.status || 'PENDING').toUpperCase() as keyof typeof counts;
    if (counts[st] !== undefined) {
      counts[st] += 1;
    } else {
      counts.PENDING += 1;
    }
  });

  const totalActive = activeItems.length;

  // Active items are preparing OR there's partial progress (some ready/served, some pending)
  if (counts.PREPARING > 0 || (counts.PENDING > 0 && (counts.READY > 0 || counts.SERVED > 0))) {
    return 'PREPARING';
  }

  // All active items are still pending
  if (counts.PENDING === totalActive) {
    return 'PENDING';
  }

  const config = getKitchenWorkflow(mode);

  if (config.usesReadyState) {
    // KDS Mode:
    // Only when all active items are marked SERVED does the order become SERVED
    if (counts.SERVED === totalActive) {
      return 'SERVED';
    }
    // All active are READY (or mixture of READY & SERVED)
    if (counts.READY + counts.SERVED === totalActive) {
      return 'READY';
    }
    return 'PREPARING';
  } else {
    // KOT Mode:
    // Kitchen completion advances directly to SERVED (KOT does not use READY)
    if (counts.READY + counts.SERVED === totalActive) {
      return 'SERVED';
    }
    return 'PREPARING';
  }
}

/**
 * Checks whether an order status is terminal.
 */
export function isOrderTerminal(status?: string): boolean {
  const s = (status || '').toUpperCase();
  return s === 'CLOSED' || s === 'CANCELLED' || s === 'EXPIRED';
}

/**
 * Checks whether an order has reached SERVED or CLOSED.
 */
export function isOrderServedOrClosed(status?: string): boolean {
  const s = (status || '').toUpperCase();
  return s === 'SERVED' || s === 'CLOSED';
}

/**
 * Validates whether an order can be closed.
 */
export function canCloseOrder(order: {
  status?: string;
  is_paid?: boolean;
}): { canClose: boolean; reason?: string } {
  const st = (order.status || '').toUpperCase();
  if (st === 'CLOSED') {
    return { canClose: false, reason: 'Order is already closed' };
  }
  if (st === 'CANCELLED') {
    return { canClose: false, reason: 'Cancelled order cannot be closed' };
  }
  if (st === 'EXPIRED') {
    return { canClose: false, reason: 'Expired order cannot be closed' };
  }
  return { canClose: true };
}
