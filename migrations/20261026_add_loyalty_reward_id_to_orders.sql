-- Migration: Add loyalty_reward_id to orders table
-- Supports tracking catalog loyalty rewards (UUID) and punch card rewards ('PUNCH_CARD_REWARD') on orders

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS loyalty_reward_id VARCHAR(255) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_loyalty_reward_id 
ON orders (loyalty_reward_id) 
WHERE loyalty_reward_id IS NOT NULL;
