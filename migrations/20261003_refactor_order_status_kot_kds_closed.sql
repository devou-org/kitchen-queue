-- ============================================================================
-- MIGRATION: 20261003_refactor_order_status_kot_kds_closed.sql
-- Refactor Qdine Order Status Workflow for KOT/KDS with CLOSED Status
-- ============================================================================

BEGIN;

-- 1. Add kitchen_mode to restaurants with default 'KOT'
ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS kitchen_mode VARCHAR(20) NOT NULL DEFAULT 'KOT';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_restaurants_kitchen_mode'
  ) THEN
    ALTER TABLE restaurants 
    ADD CONSTRAINT chk_restaurants_kitchen_mode 
    CHECK (kitchen_mode IN ('KOT', 'KDS'));
  END IF;
END $$;

-- 2. Add served_at and closed_at timestamps to orders
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS served_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- 3. Add served_at timestamp to order_items
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS served_at TIMESTAMPTZ;

-- 4. Create/update the trigger function FIRST so it understands CLOSED and prevents overwriting
CREATE OR REPLACE FUNCTION update_order_status_from_items()
RETURNS TRIGGER AS $$
DECLARE
    v_order_id UUID;
    v_restaurant_id UUID;
    v_kitchen_mode VARCHAR(20);
    v_current_status VARCHAR(30);
    v_new_status VARCHAR(30);
    v_total_count INT;
    v_cancelled_count INT;
    v_pending_count INT;
    v_preparing_count INT;
    v_ready_count INT;
    v_served_count INT;
    v_active_count INT;
BEGIN
    v_order_id := COALESCE(NEW.order_id, OLD.order_id);

    -- Get current order status and restaurant kitchen mode
    SELECT o.status, o.restaurant_id, COALESCE(r.kitchen_mode, 'KOT')
    INTO v_current_status, v_restaurant_id, v_kitchen_mode
    FROM orders o
    LEFT JOIN restaurants r ON r.id = o.restaurant_id
    WHERE o.id = v_order_id;

    -- If order does not exist or is already finalized (CLOSED, CANCELLED, EXPIRED), do not alter
    IF v_current_status IS NULL OR v_current_status IN ('CLOSED', 'CANCELLED', 'EXPIRED') THEN
        RETURN NEW;
    END IF;

    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status IN ('CANCELLED', 'REJECTED')),
        COUNT(*) FILTER (WHERE status = 'PENDING'),
        COUNT(*) FILTER (WHERE status = 'PREPARING'),
        COUNT(*) FILTER (WHERE status = 'READY'),
        COUNT(*) FILTER (WHERE status = 'SERVED')
    INTO 
        v_total_count, 
        v_cancelled_count,
        v_pending_count,
        v_preparing_count, 
        v_ready_count,
        v_served_count
    FROM order_items
    WHERE order_id = v_order_id;

    v_active_count := v_total_count - v_cancelled_count;

    -- If no items or all items cancelled/rejected
    IF v_total_count = 0 OR v_active_count = 0 THEN
        v_new_status := 'CANCELLED';
    -- If any item is actively preparing, or if there is partial progress (e.g. some ready/served and some pending)
    ELSIF v_preparing_count > 0 OR (v_pending_count > 0 AND (v_ready_count > 0 OR v_served_count > 0)) THEN
        v_new_status := 'PREPARING';
    ELSIF v_pending_count = v_active_count THEN
        v_new_status := 'PENDING';
    ELSE
        -- All active items are either READY or SERVED
        IF v_kitchen_mode = 'KDS' THEN
            -- In KDS: all active items must be SERVED to advance order to SERVED;
            -- if all are READY (or mixture of READY and SERVED), it is READY
            IF v_served_count = v_active_count THEN
                v_new_status := 'SERVED';
            ELSIF (v_ready_count + v_served_count) = v_active_count THEN
                v_new_status := 'READY';
            ELSE
                v_new_status := 'PREPARING';
            END IF;
        ELSE
            -- In KOT: kitchen completion goes directly to SERVED (KOT does not use READY)
            -- When all active items are ready or served, order reaches SERVED
            IF (v_ready_count + v_served_count) = v_active_count THEN
                v_new_status := 'SERVED';
            ELSE
                v_new_status := 'PREPARING';
            END IF;
        END IF;
    END IF;

    -- If order is currently SERVED, don't revert to READY or PENDING unless new items are preparing
    IF v_current_status = 'SERVED' AND v_new_status = 'READY' THEN
        v_new_status := 'SERVED';
    END IF;

    -- Update parent order status and timestamps (NEVER automatically sets CLOSED)
    UPDATE orders 
    SET status = v_new_status,
        ready_at = CASE WHEN v_new_status = 'READY' AND ready_at IS NULL THEN NOW() ELSE ready_at END,
        served_at = CASE WHEN v_new_status = 'SERVED' AND served_at IS NULL THEN NOW() ELSE served_at END,
        updated_at = NOW()
    WHERE id = v_order_id 
      AND status NOT IN ('CLOSED', 'CANCELLED', 'EXPIRED');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Attach trigger
DROP TRIGGER IF EXISTS trigger_update_order_status ON order_items;
CREATE TRIGGER trigger_update_order_status
AFTER INSERT OR UPDATE OF status OR DELETE ON order_items
FOR EACH ROW EXECUTE FUNCTION update_order_status_from_items();

-- 6. Safe migration of existing orders data:
-- A) For orders with status = 'PAID' where all active items are done (or order has no pending/preparing items):
--    Set status = 'CLOSED', closed_at = COALESCE(paid_at, updated_at, created_at), served_at = COALESCE(ready_at, updated_at, created_at)
UPDATE orders o
SET status = 'CLOSED',
    closed_at = COALESCE(o.paid_at, o.updated_at, o.created_at),
    served_at = COALESCE(o.ready_at, o.updated_at, o.created_at)
WHERE o.status = 'PAID'
  AND NOT EXISTS (
    SELECT 1 FROM order_items oi
    WHERE oi.order_id = o.id
      AND oi.status IN ('PENDING', 'PREPARING')
  );

-- B) For any orders with status = 'PAID' that still have pending or preparing items:
--    Retain their actual kitchen status (PREPARING if any preparing, else PENDING) while keeping is_paid = true
UPDATE orders o
SET status = CASE 
      WHEN EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.status = 'PREPARING') THEN 'PREPARING'
      ELSE 'PENDING'
    END
WHERE o.status = 'PAID';

-- C) Update order_items for CLOSED orders: mark finished items as SERVED with served_at timestamp
UPDATE order_items oi
SET status = 'SERVED',
    served_at = COALESCE(oi.ready_at, oi.prepared_at, NOW())
FROM orders o
WHERE oi.order_id = o.id
  AND o.status = 'CLOSED'
  AND oi.status NOT IN ('CANCELLED', 'REJECTED');

-- D) Normalize any legacy 'WAITING' order statuses to 'PENDING'
UPDATE orders
SET status = 'PENDING'
WHERE status = 'WAITING';

COMMIT;
