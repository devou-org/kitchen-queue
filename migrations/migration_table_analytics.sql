-- Migration script for Table Analytics & Sessions

CREATE TABLE IF NOT EXISTS table_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    table_id UUID NOT NULL REFERENCES restaurant_tables(id) ON DELETE CASCADE,

    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMPTZ,

    party_size INT,

    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    -- OPEN, CLOSED

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_table_sessions_restaurant_date
ON table_sessions(restaurant_id, started_at);

CREATE INDEX IF NOT EXISTS idx_table_sessions_table
ON table_sessions(table_id, started_at);

CREATE INDEX IF NOT EXISTS idx_table_sessions_status
ON table_sessions(restaurant_id, table_id, status);

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS table_session_id UUID
REFERENCES table_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_table_session
ON orders(table_session_id);
