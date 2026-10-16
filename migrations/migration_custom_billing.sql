-- Migration: Add custom billing overrides to restaurants table

ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS custom_subscription_charge DECIMAL(10,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS custom_otp_charge DECIMAL(10,2) DEFAULT NULL;
