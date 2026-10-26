-- Migration: Allow orders and queues without phone and user (e.g. POS walk-in orders)
-- Idempotent drop of NOT NULL constraints on phone and user_id columns

ALTER TABLE orders ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE queues ALTER COLUMN user_id DROP NOT NULL;
