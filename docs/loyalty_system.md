# Loyalty & Rewards System Implementation

This document details the architectural design, database migrations, API surfaces, Super Admin feature controls, order status earning hooks, and POS checkout redemption mechanics for the Kitchen Queue Loyalty & Rewards System.

---

## 📑 Feature Overview

The Loyalty System provides a full CRM-integrated points and visit punch card program for restaurants on Kitchen Queue:
1. **Super Admin Control**: Per-restaurant toggle (`LOYALTY_PROGRAM`) enabling or disabling loyalty features without losing customer historical data.
2. **CRM Integration**: Seamlessly links customer phone numbers to existing `users` profiles without creating duplicate customer tables.
3. **Points Earning Program**: Earning rate calculation (`floor(amount_spent * points_rate)`) on paid net bill amounts with configurable minimum order thresholds.
4. **Visit Punch Card Mechanics**: Tracks +1 visit per paid order, featuring automatic milestone rewards (e.g., every 5th visit) with configurable reward values.
5. **Rewards Catalog**: Full CRUD management ("Add New Reward") supporting Free Items, Discount Amounts (₹), Discount Percentages (%), Product Pickers, Minimum Purchase Thresholds, and Expiration Dates.
6. **POS Checkout Redemption Drawer**: Automatic customer lookup by 10-digit phone number in POS checkout, displaying member points balance, visit progress, and one-click discount redemptions.
7. **Idempotent Order Completion & Refund Hooks**: Points/visits credit automatically upon `PAID` or `COMPLETED` order status. Order cancellations or refunds trigger atomic `REVERSAL_REFUND` point deductions.

---

## 🗄️ Database Schema & Migrations

**Migration File**: `migrations/20260926_loyalty_system.sql`

```sql
-- 1. Loyalty Settings (Per-Restaurant Configuration)
CREATE TABLE IF NOT EXISTS loyalty_settings (
  restaurant_id UUID PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT true,
  points_earning_rate DECIMAL(10, 4) DEFAULT 0.1000,
  points_redemption_rate_points INT DEFAULT 100,
  points_redemption_rate_amount DECIMAL(10, 2) DEFAULT 50.00,
  points_expiry_type VARCHAR(50) DEFAULT 'NEVER',
  points_expiry_days INT DEFAULT 365,
  min_order_amount DECIMAL(10, 2) DEFAULT 0.00,
  visit_milestone_count INT DEFAULT 5,
  visit_reward_type VARCHAR(50) DEFAULT 'DISCOUNT_AMOUNT',
  visit_reward_value VARCHAR(255) DEFAULT '100',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Loyalty Rewards Catalog ("Add New Reward" Form)
CREATE TABLE IF NOT EXISTS loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  points_required INT NOT NULL,
  reward_type VARCHAR(50) NOT NULL, -- 'FREE_ITEM', 'DISCOUNT_AMOUNT', 'DISCOUNT_PERCENTAGE'
  discount_value DECIMAL(10, 2) DEFAULT 0.00,
  selected_product_ids JSONB DEFAULT '[]'::jsonb,
  min_purchase_amount DECIMAL(10, 2) DEFAULT 0.00,
  valid_until TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Customer Loyalty Ledger (Links existing users table)
CREATE TABLE IF NOT EXISTS customer_loyalty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  points_balance DECIMAL(10, 2) DEFAULT 0.00,
  total_points_earned DECIMAL(10, 2) DEFAULT 0.00,
  total_points_redeemed DECIMAL(10, 2) DEFAULT 0.00,
  total_visits INT DEFAULT 0,
  visit_progress INT DEFAULT 0,
  rewards_unlocked INT DEFAULT 0,
  total_spent DECIMAL(10, 2) DEFAULT 0.00,
  last_visit_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_customer_restaurant_loyalty UNIQUE (restaurant_id, user_id)
);

-- 4. Loyalty Transactions Audit Log
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_loyalty_id UUID NOT NULL REFERENCES customer_loyalty(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  reward_id UUID REFERENCES loyalty_rewards(id) ON DELETE SET NULL,
  transaction_type VARCHAR(50) NOT NULL, -- 'EARN_POINTS', 'REDEEM_POINTS', 'EARN_VISIT', 'CLAIM_REWARD', 'REVERSAL_REFUND', 'MANUAL_ADJUSTMENT', 'POINTS_EXPIRED'
  points_delta DECIMAL(10, 2) DEFAULT 0.00,
  visit_delta INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 🛠️ Modified & New Files

| File Path | Description of Changes |
|---|---|
| `migrations/20260926_loyalty_system.sql` | SQL schema migration defining all 4 loyalty system tables and composite unique indexes. |
| `run_migration_loyalty_system.js` | Migration runner script with PostgreSQL SSL fallback connection logic. |
| `src/lib/db.ts` | Added `LOYALTY_PROGRAM` module defaults, `runAutoMigration` tables, customer phone lookups, earning calculations, refund reversals, and reward CRUD helpers. |
| `src/app/api/super-admin/restaurants/[id]/route.ts` | Added `LOYALTY_PROGRAM` to `ALL_MODULE_KEYS`. |
| `src/app/api/setup/route.ts` | Added `LOYALTY_PROGRAM` to `ALL_MODULES`. |
| `src/app/super-admin/page.tsx` | Added `LOYALTY_PROGRAM` module card with Gift icon in Super Admin Dashboard. |
| `src/app/super-admin/restaurants/[id]/page.tsx` | Added `LOYALTY_PROGRAM` module toggle switch in Super Admin Restaurant Details page. |
| `src/app/[slug]/admin/layout.tsx` | Enforced sidebar link visibility (`showLoyalty`) and `/admin/loyalty` route protection redirect when module is disabled. |
| `src/app/api/admin/loyalty/customers/route.ts` | GET search customer profiles; POST manual point adjustments (+/-) with audit reasons. |
| `src/app/api/admin/loyalty/settings/route.ts` | GET and POST program rules, rates, expiry policy, and punch card milestone targets. |
| `src/app/api/admin/loyalty/rewards/route.ts` | GET, POST, PUT, DELETE endpoints for custom store rewards catalog. |
| `src/app/api/admin/loyalty/transactions/route.ts` | GET audit transaction log with ticket number traceability. |
| `src/app/[slug]/admin/loyalty/page.tsx` | Complete Admin Dashboard with KPI Metrics Bar, Customer Directory, Program Settings, Rewards Catalog, and Audit Log tabs. |
| `src/app/[slug]/admin/pos/page.tsx` | POS Terminal checkout drawer with auto-search 10-digit phone lookup, Member Loyalty Card banner, and one-click discount redemption. |

---

## 🧪 Verification & QA Coverage

- **Automated Type Check**: `npx tsc --noEmit` verified with 0 compilation errors.
- **QA Test Suite**: 85 test cases covering Super Admin control, CRM registration, points rounding, visit punch cards, rewards catalog, POS checkout, order status hooks, and refund reversals.
