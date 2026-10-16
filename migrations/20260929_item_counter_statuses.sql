-- ============================================================================
-- QDINE ITEM & COUNTER LEVEL STATUS ARCHITECTURE MIGRATION
-- ============================================================================

BEGIN;

-- 1. Extend order_items table with status, counter snapshot, and timestamps
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS counter VARCHAR(100),
ADD COLUMN IF NOT EXISTS prepared_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ;

-- 2. Index for rapid counter station and order filtering
CREATE INDEX IF NOT EXISTS idx_order_items_counter_status 
ON order_items(order_id, counter, status);

-- 3. Backfill counter names on existing order items from products
UPDATE order_items oi
SET counter = COALESCE(NULLIF(TRIM(p.counter), ''), 'Kitchen')
FROM products p
WHERE oi.product_id = p.id AND (oi.counter IS NULL OR oi.counter = '');

-- 4. Backfill existing order_items status from parent orders
UPDATE order_items oi
SET status = CASE 
    WHEN o.status IN ('PAID', 'COMPLETED', 'SERVED') THEN 'SERVED'
    WHEN o.status = 'READY' THEN 'READY'
    WHEN o.status = 'PREPARING' THEN 'PREPARING'
    WHEN o.status = 'CANCELLED' THEN 'CANCELLED'
    ELSE 'PENDING'
END
FROM orders o
WHERE oi.order_id = o.id;

-- 5. Trigger function to automatically maintain master order status from items
CREATE OR REPLACE FUNCTION update_order_status_from_items()
RETURNS TRIGGER AS $$
DECLARE
    v_order_id UUID;
    v_new_status VARCHAR(30);
    v_total_count INT;
    v_cancelled_count INT;
    v_ready_count INT;
    v_preparing_count INT;
    v_served_count INT;
BEGIN
    v_order_id := COALESCE(NEW.order_id, OLD.order_id);

    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'CANCELLED' OR status = 'REJECTED'),
        COUNT(*) FILTER (WHERE status = 'PREPARING'),
        COUNT(*) FILTER (WHERE status = 'READY'),
        COUNT(*) FILTER (WHERE status = 'SERVED')
    INTO 
        v_total_count, 
        v_cancelled_count, 
        v_preparing_count, 
        v_ready_count, 
        v_served_count
    FROM order_items
    WHERE order_id = v_order_id;

    -- If no items or all items are cancelled/rejected
    IF v_total_count = 0 OR v_total_count = v_cancelled_count THEN
        v_new_status := 'CANCELLED';
    -- If any item is actively being prepared
    ELSIF v_preparing_count > 0 THEN
        v_new_status := 'PREPARING';
    -- If all active non-cancelled items are ready or served
    ELSIF (v_ready_count + v_served_count) = (v_total_count - v_cancelled_count) THEN
        IF v_ready_count > 0 THEN
            v_new_status := 'READY';
        ELSE
            v_new_status := 'SERVED';
        END IF;
    ELSE
        -- Partial progress: some items ready, others still pending
        IF (v_ready_count + v_served_count) > 0 THEN
            v_new_status := 'PREPARING';
        ELSE
            v_new_status := 'PENDING';
        END IF;
    END IF;

    -- Update parent order status unless it has already been finalized/settled
    UPDATE orders 
    SET status = v_new_status,
        updated_at = NOW()
    WHERE id = v_order_id 
      AND status NOT IN ('PAID', 'CANCELLED', 'EXPIRED');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Attach trigger to order_items
DROP TRIGGER IF EXISTS trigger_update_order_status ON order_items;
CREATE TRIGGER trigger_update_order_status
AFTER INSERT OR UPDATE OF status OR DELETE ON order_items
FOR EACH ROW EXECUTE FUNCTION update_order_status_from_items();

COMMIT;
