-- Migration: Add Default Bill Printer Settings to restaurants table
ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS bill_printer_name VARCHAR(255) DEFAULT 'POS-80C',
ADD COLUMN IF NOT EXISTS bill_printer_type VARCHAR(50) DEFAULT 'DEFAULT',
ADD COLUMN IF NOT EXISTS bill_printer_address VARCHAR(255);
