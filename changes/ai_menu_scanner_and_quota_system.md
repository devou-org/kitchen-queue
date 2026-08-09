# AI Menu Scanner & Global Gemini Quota Management System

## 1. Overview
The **AI Menu Scanner & Gemini Quota Management System** enables restaurant admins to upload printed menu images (JPEG, PNG, WebP) and automatically extract menu items, categories, prices, and descriptions using Google's Gemini Vision API. It incorporates a global, multi-tenant safety system to monitor, control, and cap Gemini API requests across all Qdine restaurants.

---

## 2. Key Architecture & Features

### A. Global Multi-Tenant Quota Safety System
- **Single Global Configuration**: Quota limits (`rpm_limit`, `tpm_limit`, `rpd_limit`) are stored globally in `gemini_config` without `restaurant_id`.
- **Per-Restaurant Usage Attribution**: Individual requests are logged in `gemini_usage` and `gemini_usage_monthly` with `restaurant_id` for accurate analytics.
- **Daily Usage Window**: Daily token and request totals reset automatically at **00:00 UTC**.

### B. Safety Circuit Breakers & Rate Limits
- **Daily Budget Caps (RPD & TPM)**: If total requests (`rpd_limit`) or total tokens (`tpm_limit`) reach the daily cap, Gemini is safely disabled globally until 00:00 UTC, preventing runaway API charges.
- **5-Minute Burst Rate Limiter (RPM)**: Rolling rate-limit checks verify request volume over the last 5 minutes (`NOW() - INTERVAL '5 minutes'`) to prevent request spikes without triggering daily shutdowns.

---

## 3. Database Schema

```sql
-- 1. Global Configuration Table
CREATE TABLE gemini_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model VARCHAR(100) NOT NULL DEFAULT 'gemini-flash-latest',
    rpm_limit INTEGER NOT NULL DEFAULT 10,
    tpm_limit BIGINT NOT NULL DEFAULT 200000,
    rpd_limit INTEGER NOT NULL DEFAULT 200,
    max_output_tokens INTEGER NOT NULL DEFAULT 1000,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Daily Usage Tracking Table
CREATE TABLE gemini_daily_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usage_date DATE UNIQUE NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0,
    input_tokens BIGINT NOT NULL DEFAULT 0,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    disabled_reason VARCHAR(50) NULL,
    disabled_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Detailed Request Logs Table
CREATE TABLE gemini_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NULL REFERENCES restaurants(id) ON DELETE SET NULL,
    request_type VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    status VARCHAR(30) NOT NULL,
    error_code VARCHAR(100) NULL,
    error_message TEXT NULL,
    response_time_ms INTEGER NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. API Endpoints

- **`POST /api/ai/upload-menu`**: Handles image upload, pre-request token validation via `countTokens()`, and menu item extraction.
- **`GET /api/ai/status`**: Returns global AI availability (`is_enabled`) and disable reason for real-time client UI state updates.
- **`GET /api/super-admin/ai-quota`**: Super Admin dashboard metrics (usage meters, daily progress, per-restaurant breakdown, and recent logs).
- **`PUT /api/super-admin/ai-quota`**: Updates global limits (`RPM`, `RPD`, `TPM`, model selection, global enable/disable toggle).

---

## 5. UI & UX Enhancements

- **React Portals**: Modal rendered via `createPortal` to `document.body` for full-screen backdrop blur and viewport centering.
- **Dynamic Disabled Button**: The "Upload Menu" button automatically disables, changes opacity/color, and displays descriptive tooltips/toasts when AI is turned off by an administrator or daily limit reached.
- **Z-Index Layering**: Toaster notifications configured with `containerStyle={{ zIndex: 999999 }}` to always render in front of all open modals.
- **Icon Indicators**: Pill-shaped "Upload Menu" button with pulsing `Sparkles` icon and right-aligned sidebar `Sparkles` indicator next to Products menu item.
