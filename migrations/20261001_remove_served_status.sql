-- ============================================================================
-- REMOVE SERVED STATUS MIGRATION
-- Normalizes any 'SERVED' status to 'READY' and updates trigger
-- ============================================================================

BEGIN;

-- 1. Convert existing 'SERVED' order_items to 'READY'
UPDATE order_items 
SET status = 'READY',
    ready_at = COALESCE(ready_at, NOW())
WHERE status = 'SERVED';

-- 2. Convert existing 'SERVED' orders to 'READY'
UPDATE orders
SET status = 'READY',
    ready_at = COALESCE(ready_at, NOW())
WHERE status = 'SERVED';

-- 3. Replace trigger function to never output 'SERVED'
CREATE OR REPLACE FUNCTION update_order_status_from_items()
RETURNS TRIGGER AS $$
DECLARE
    v_order_id UUID;
    v_new_status VARCHAR(30);
    v_total_count INT;
    v_cancelled_count INT;
    v_ready_count INT;
    v_preparing_count INT;
BEGIN
    v_order_id := COALESCE(NEW.order_id, OLD.order_id);

    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'CANCELLED' OR status = 'REJECTED'),
        COUNT(*) FILTER (WHERE status = 'PREPARING'),
        COUNT(*) FILTER (WHERE status = 'READY' OR status = 'SERVED')
    INTO 
        v_total_count, 
        v_cancelled_count, 
        v_preparing_count, 
        v_ready_count
    FROM order_items
    WHERE order_id = v_order_id;

    -- If no items or all items are cancelled/rejected
    IF v_total_count = 0 OR v_total_count = v_cancelled_count THEN
        v_new_status := 'CANCELLED';
    -- If any item is actively being prepared
    ELSIF v_preparing_count > 0 THEN
        v_new_status := 'PREPARING';
    -- If all active non-cancelled items are ready
    ELSIF v_ready_count = (v_total_count - v_cancelled_count) THEN
        v_new_status := 'READY';
    ELSE
        -- Partial progress: some items ready, others still pending
        IF v_ready_count > 0 THEN
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

-- 4. Re-attach trigger
DROP TRIGGER IF EXISTS trigger_update_order_status ON order_items;
CREATE TRIGGER trigger_update_order_status
AFTER INSERT OR UPDATE OF status OR DELETE ON order_items
FOR EACH ROW EXECUTE FUNCTION update_order_status_from_items();

COMMIT;
