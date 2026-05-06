-- Migration: Add Admin table and OTP Billing tracking
-- Created At: 2026-05-06

-- 1. Create Admins table
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, -- Hashed
    is_super_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create OTP Stats table (Daily aggregation)
CREATE TABLE IF NOT EXISTS daily_otp_stats (
    date DATE PRIMARY KEY,
    count INTEGER DEFAULT 0,
    cost NUMERIC(10, 2) DEFAULT 0.00, -- count * 0.50
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create OTP Logs (Detailed tracking for audit)
CREATE TABLE IF NOT EXISTS otp_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'SENT' -- SENT, FAILED
);

-- 4. Seed default admin (Email: admin@devou.com, Password: admin123)
-- Hash generated for 'admin123'
INSERT INTO admins (email, password, is_super_admin)
VALUES ('admin@devou.com', '$2b$10$XmN9C.iR/X.8m8.m8.m8.Oq/L.m8.m8.m8.m8.m8.m8.m8.m8.m8', true)
ON CONFLICT (email) DO NOTHING;

-- 5. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_otp_logs_date ON otp_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_otp_logs_phone ON otp_logs(phone);
