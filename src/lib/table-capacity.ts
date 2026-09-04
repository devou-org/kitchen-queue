/**
 * Table Capacity & Party Assignment Logic Utility
 * 
 * Rules:
 * 1. Single party can exceed table capacity (e.g. Party of 6 -> Table capacity 4 ✅).
 *    Allowed when table has NO existing active party.
 * 2. Same party adding more items/orders -> Always Allowed ✅.
 * 3. Multiple parties sharing a table CANNOT exceed physical capacity:
 *    occupied_seats + new_party_size <= capacity -> Allowed as a shared table ✅.
 * 4. Otherwise -> Do NOT allow ❌.
 */

export interface TableOrder {
  id?: string;
  order_type?: string;
  party_size?: number | string;
  phone?: string;
  customer_name?: string;
}

export interface TableInfo {
  id?: string;
  table_number: string;
  capacity: number;
  status?: string;
  active_orders?: TableOrder[];
}

export interface AssignmentCheckResult {
  allowed: boolean;
  isShared: boolean;
  occupiedSeats: number;
  partiesCount: number;
  remainingCapacity: number;
  reason?: string;
}

export function checkTableAssignment(
  table: TableInfo,
  newPartySize: number = 1,
  currentPartyContext?: { orderId?: string; phone?: string; customerName?: string }
): AssignmentCheckResult {
  const capacity = Number(table.capacity) || 0;
  const activeOrders = (table.active_orders || []).filter(
    (o: TableOrder) => o.order_type !== 'TAKEAWAY' && o.order_type !== 'DELIVERY'
  );

  // If editing an existing order, exclude that order from count
  const otherOrders = activeOrders.filter(
    (o: TableOrder) => !currentPartyContext?.orderId || o.id !== currentPartyContext.orderId
  );

  const partiesCount = otherOrders.length;
  const occupiedSeats = otherOrders.reduce(
    (sum: number, o: TableOrder) => sum + (Number(o.party_size) || 1),
    0
  );

  // Rule 1: IF table has no active party -> Allow any party size (even if new_party_size > capacity)
  if (partiesCount === 0) {
    return {
      allowed: true,
      isShared: false,
      occupiedSeats: 0,
      partiesCount: 0,
      remainingCapacity: capacity,
    };
  }

  // Rule 2: ELSE IF table has the same party (non-dummy phone/customer matching) -> Allow
  if (currentPartyContext) {
    const pPhone = (currentPartyContext.phone || '').trim();
    const pName = (currentPartyContext.customerName || '').trim().toLowerCase();

    const isDummyPhone = !pPhone || pPhone.includes('0000000000') || pPhone === '+910000000000';
    const isDummyName = !pName || pName.startsWith('table') || pName.includes('takeaway') || pName === 'customer';

    const isSamePhone = !isDummyPhone && otherOrders.some(o => {
      const op = (o.phone || '').trim();
      return op && op === pPhone && !op.includes('0000000000');
    });

    const isSameCustomer = !isDummyName && otherOrders.some(o => {
      const on = (o.customer_name || '').trim().toLowerCase();
      return on && on === pName && !on.startsWith('table');
    });

    if (isSamePhone || isSameCustomer) {
      return {
        allowed: true,
        isShared: partiesCount > 1,
        occupiedSeats,
        partiesCount,
        remainingCapacity: Math.max(0, capacity - occupiedSeats),
      };
    }
  }

  // Rule 3: ELSE IF occupied_seats + new_party_size <= capacity -> Allow as a shared table
  const projectedTotal = occupiedSeats + (Number(newPartySize) || 1);
  if (projectedTotal <= capacity) {
    return {
      allowed: true,
      isShared: true,
      occupiedSeats,
      partiesCount,
      remainingCapacity: capacity - occupiedSeats,
    };
  }

  // Rule 4: Do not allow
  return {
    allowed: false,
    isShared: true,
    occupiedSeats,
    partiesCount,
    remainingCapacity: Math.max(0, capacity - occupiedSeats),
    reason: `Table already has ${partiesCount} party (${occupiedSeats}/${capacity} seats taken). Adding party of ${newPartySize} would exceed capacity (${projectedTotal}/${capacity}).`
  };
}
