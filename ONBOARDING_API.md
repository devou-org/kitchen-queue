# Qdine – Public Onboarding & Subscription API Documentation

This documentation provides the complete technical specification for the **Qdine Public Onboarding & Subscription API** (`/api/public/restaurants` / `/api/onboarding`).

It supports onboarding for all three independent products (**POS**, **Digital Menu**, and **Q Management System**), automated **14-day full Premium Free Trial** provisioning for POS, configurable **Monthly / Annual** billing cycles, and a **100% data-driven** plan & pricing architecture.

---

## 1. Executive Summary & Product Architecture

Qdine operates three independent software products. During onboarding, a customer chooses **exactly one** product:

| Product Option | ID | Default Onboarding Mode | Features / Scope |
| :--- | :--- | :--- | :--- |
| **POS** | `POS` | **14-Day Free Trial** (All Premium features unlocked, 30 AI Analyst credits, no credit card required) | Full restaurant POS, Table Management, QR Ordering, Inventory, Loyalty, AI Analyst, Finance Management. |
| **Digital Menu** | `DIGITAL_MENU` | **Standalone Product** | QR-based digital menu, catalogue management, and brand presentation (view-only digital menu; online ordering, POS & Table Management are disabled). |
| **Q Management** | `QUEUE_MANAGEMENT` | **Standalone Product** | Waitlist queue management, token generation, live display screen & customer SMS/OTP paging. |

---

## 2. POS Subscription Plans & Features (Post-Trial)

When the 14-day free trial concludes, POS customers select one of two plans:

### A. Essential Plan (₹6,999/year or ₹699/month, customizable)
- **POS & Table Management**: Complete control over floor plans, active orders, split payments, and checkout.
- **Digital Menu & QR Ordering**: Diners scan QR codes at tables or counters to place instant orders.
- **Menu Management**: Manage catalogue, categories, item variants, add-ons, and prices.
- **Sales & Statements**: Granular daily closing statements, tax summaries, and revenue analytics.
- **Customised Profile & Branding**: Personalize themes, colors, logos, and digital menu headers.
- **AI Analyst Credits**: **10 AI Analyst credits** / month for asking natural language questions about sales trends, peak hours, and top items.

### B. Premium Plan (₹9,999/year or ₹999/month, customizable)
Includes **all features from Essential Plan**, plus:
- **Comprehensive Inventory**: Recipe management, batch stock tracking, supplier management, and low-stock alerts.
- **Customisable Loyalty Points**: Tiered customer reward programs, points earning and redemption at checkout.
- **AI Analyst Credits**: **30 AI Analyst credits** / month for advanced forecasting, inventory insights, and business analysis.
- **Inbuilt Finance Management**: Expense logging, vendor payouts, cash flow balances, and profit/loss statements.
- **Free Access to New Features**: Automatic zero-cost rollout of upcoming platform capabilities.

---

## 3. Data-Driven Architecture (Zero Hardcoding)

All products, plan tiers, billing cycles, pricing, AI credits, and features are stored in relational database tables rather than hardcoded logic.

### 3.1 Relational Schema Diagram

```
+------------------+       +-------------------+       +-----------------------+
|  saas_products   | 1---* |    saas_plans     | 1---* |   saas_plan_pricing   |
|------------------|       |-------------------|       |-----------------------|
| id (PK)          |       | id (PK)           |       | id (PK)               |
| name             |       | product_id (FK)   |       | plan_id (FK)          |
| has_trial        |       | tier              |       | billing_cycle         |
| trial_days       |       | monthly_ai_credits|       | price                 |
+------------------+       | is_default_trial  |       | currency              |
                           +-------------------+       +-----------------------+
                                     | 1
                                     |
                                     *
                           +-------------------+
                           |saas_plan_features |
                           |-------------------|
                           | id (PK)           |
                           | plan_id (FK)      |
                           | feature_code      |
                           | is_included       |
                           +-------------------+
```

### 3.2 Tenant Provisioning in `restaurants` Table
When a restaurant is created:
- `selected_product`: `'POS' | 'DIGITAL_MENU' | 'QUEUE_MANAGEMENT'`
- `billing_tier`: `'PREMIUM'` (during trial) or `'ESSENTIAL'` / `'STANDALONE'`
- `billing_status`: `'TRIAL'` (for POS) or `'ACTIVE'` (for standalone)
- `billing_period`: `'ANNUALLY'` or `'MONTHLY'`
- `is_trial`: `true` (for POS) or `false`
- `trial_ends_at`: `NOW() + INTERVAL '14 days'` (for POS)
- `monthly_ai_credits`: `30` (trial/premium) or `10` (essential) or `0`
- `restaurant_modules`: Tenant-specific feature flags dynamically synced to active plan features.
  - **POS Premium**: All modules enabled (`DIGITAL_MENU`, `ONLINE_ORDERING`, `TABLE_MANAGEMENT`, `QUEUE_MANAGEMENT`, `INVENTORY`, `LOYALTY_PROGRAM`, `FINANCE_MANAGEMENT`, `ANALYTICS`, `REPORTS`), 30 AI credits.
  - **POS Essential**: Only core modules enabled (`DIGITAL_MENU`, `ONLINE_ORDERING`, `TABLE_MANAGEMENT`, `ANALYTICS`, `REPORTS`), 10 AI credits. Advanced modules (`FINANCE_MANAGEMENT`, `INVENTORY`, `LOYALTY_PROGRAM`, `QUEUE_MANAGEMENT`) are explicitly neglected / disabled (`false`).
  - **Standalone Digital Menu**: Only `DIGITAL_MENU` enabled. All other modules including `ONLINE_ORDERING` and `TABLE_MANAGEMENT` are disabled (`false`).
  - **Standalone Q Management**: Only `QUEUE_MANAGEMENT` enabled with default states (`PENDING`, `SEATED`, `CANCELLED`). All other modules including `ONLINE_ORDERING` and `TABLE_MANAGEMENT` are disabled (`false`).

---

## 4. API Specification

### 4.1 Endpoint Details

| Attribute | Specification |
| :--- | :--- |
| **URL** | `/api/public/restaurants` _(Alias: `/api/onboarding`)_ |
| **HTTP Method** | `POST` |
| **Authentication** | **None (Public Onboarding)** |
| **Content-Type** | `application/json` |
| **CORS** | `*` (Any origin permitted for landing pages, web apps, mobile apps) |

---

### 4.2 Request Body Parameters

#### Required Parameters
| Parameter | Type | Valid Values | Description |
| :--- | :--- | :--- | :--- |
| `name` | `string` | Non-empty string | Name of the restaurant or food brand. |
| `admin_email` | `string` | Valid email format | Primary email for store owner portal login. Must be unique. |
| `admin_password` | `string` | Min 6 characters | Initial password for the owner account. |
| `email_verification_otp` | `string` | 6-digit numeric OTP | Verification code sent to `admin_email` via `/api/auth/send-verification-otp`. Email verification is mandatory for onboarding. |

#### Product & Plan Selection (Data-Driven)
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `product` | `string` | `"POS"` | Target product: `"POS"`, `"DIGITAL_MENU"`, or `"QUEUE_MANAGEMENT"`. |
| `plan` | `string` | `"PREMIUM"` | Desired post-trial plan for POS: `"ESSENTIAL"` or `"PREMIUM"`. Ignored for standalone. |
| `billing_cycle`| `string` | `"ANNUALLY"` | Billing interval: `"ANNUALLY"` or `"MONTHLY"`. |

#### Store Profile & Branding (Optional)
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `slug` | `string` | Auto-slug from `name` | Unique URL handle (`[a-z0-9-]` only) for menus and admin portal. |
| `admin_name` | `string` | `"{name} Owner"` | Full name of the business owner. |
| `phone` | `string` | `null` | Store contact phone number. |
| `address` | `string` | `null` | Physical street address. |
| `logo_url` | `string` | `null` | Hosted image URL for the brand logo. |
| `primary_color` | `string` | `"#971345"` | Primary brand hex code for buttons, QR menus, and badges. |
| `secondary_color`| `string` | `"#ffffff"` | Secondary accent color. |
| `menu_layout` | `string` | `"LIST"` | Display format for QR menu: `"LIST"` or `"GRID"`. |
| `timezone` | `string` | `"Asia/Kolkata"` | IANA timezone string. |
| `opening_time` | `string` | `"09:00:00"` | Daily outlet opening time (`HH:mm:ss`). |
| `closing_time` | `string` | `"22:00:00"` | Daily outlet closing time (`HH:mm:ss`). |
| `gst_type` | `string` | `"NONE"` | Tax model: `"NONE"`, `"REGULAR"`, or `"COMPOSITION"`. |
| `gst_number` | `string` | `null` | 15-character GSTIN. |
| `gst_rate` | `number` | `5.0` | Default GST percentage (e.g. 5.0, 18.0). |

---

### 4.3 Email Verification & Password Recovery Endpoints

To ensure valid store ownership and secure credential recovery, Qdine provides dedicated endpoints powered by a **Dependency Injection Email Service** (defaulting to the **Resend API** via `RESEND_API_KEY`):

#### 1. Request Email Verification OTP (Pre-Onboarding)
- **URL**: `/api/auth/send-verification-otp`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "email": "owner@restaurant.com",
    "restaurant_name": "Spice Garden Bistro"
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Verification code sent to owner@restaurant.com"
  }
  ```

#### 2. Request Password Reset OTP
- **URL**: `/api/auth/forgot-password`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "email": "owner@restaurant.com"
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "If an account exists with this email address, a password reset code has been sent."
  }
  ```

#### 3. Complete Password Reset
- **URL**: `/api/auth/reset-password`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "email": "owner@restaurant.com",
    "otp": "491823",
    "new_password": "NewSecurePassword123"
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Password has been successfully updated. You may now log in with your new password.",
    "data": {
      "email": "owner@restaurant.com",
      "login_url": "/spice-garden-bistro/admin/login"
    }
  }
  ```

---

## 5. Request & Response Examples

### Example 1: POS Onboarding (Default 14-Day Free Trial)

#### Request:
```bash
POST /api/public/restaurants
Content-Type: application/json

{
  "name": "Spice Garden Bistro",
  "admin_email": "admin@spicegarden.com",
  "admin_password": "SecurePassword123",
  "email_verification_otp": "481920",
  "product": "POS",
  "plan": "PREMIUM",
  "billing_cycle": "ANNUALLY",
  "phone": "+91 9876543210",
  "primary_color": "#059669"
}
```

#### Response (`201 Created`):
```json
{
  "success": true,
  "message": "Restaurant onboarded successfully with a 14-day full-featured Premium free trial",
  "data": {
    "restaurant": {
      "id": "c1f7a188-3481-42ab-8e01-140b991d6f1a",
      "name": "Spice Garden Bistro",
      "slug": "spice-garden-bistro",
      "phone": "+91 9876543210",
      "address": null,
      "primary_color": "#059669",
      "menu_layout": "LIST",
      "created_at": "2026-11-05T14:30:00.000Z"
    },
    "admin": {
      "email": "admin@spicegarden.com",
      "name": "Spice Garden Bistro Owner"
    },
    "subscription": {
      "product": "POS",
      "is_trial": true,
      "trial_days": 14,
      "trial_ends_at": "2026-11-19T14:30:00.000Z",
      "tier": "PREMIUM",
      "billing_cycle": "ANNUALLY",
      "monthly_ai_credits": 30,
      "unlocked_tier": "PREMIUM"
    },
    "urls": {
      "admin_portal": "/spice-garden-bistro/admin/login",
      "digital_menu": "/spice-garden-bistro/menu",
      "pos_terminal": "/spice-garden-bistro/admin/pos",
      "queue_screen": "/spice-garden-bistro/queue"
    }
  }
}
```

---

### Example 2: Standalone Digital Menu Onboarding

#### Request:
```bash
POST /api/public/restaurants
Content-Type: application/json

{
  "name": "Artisan Bakery Café",
  "admin_email": "hello@artisanbakery.com",
  "admin_password": "SecurePassword123",
  "email_verification_otp": "928371",
  "product": "DIGITAL_MENU",
  "billing_cycle": "ANNUALLY",
  "primary_color": "#D97706"
}
```

#### Response (`201 Created`):
```json
{
  "success": true,
  "message": "Restaurant onboarded successfully with standalone Digital Menu",
  "data": {
    "restaurant": {
      "id": "e4a29c12-7811-4712-bf91-9c88219ad334",
      "name": "Artisan Bakery Café",
      "slug": "artisan-bakery-cafe",
      "primary_color": "#D97706",
      "created_at": "2026-11-05T14:30:00.000Z"
    },
    "admin": {
      "email": "hello@artisanbakery.com",
      "name": "Artisan Bakery Café Owner"
    },
    "subscription": {
      "product": "DIGITAL_MENU",
      "is_trial": false,
      "trial_days": 0,
      "trial_ends_at": null,
      "tier": "STANDALONE",
      "billing_cycle": "ANNUALLY",
      "monthly_ai_credits": 0,
      "unlocked_tier": "STANDALONE"
    },
    "urls": {
      "admin_portal": "/artisan-bakery-cafe/admin/login",
      "digital_menu": "/artisan-bakery-cafe/menu"
    }
  }
}
```

---

### Example 3: Standalone Q Management System Onboarding

#### Request:
```bash
POST /api/public/restaurants
Content-Type: application/json

{
  "name": "Downtown Express Food Court",
  "admin_email": "ops@expresscourt.com",
  "admin_password": "SecurePassword123",
  "email_verification_otp": "610294",
  "product": "QUEUE_MANAGEMENT",
  "billing_cycle": "MONTHLY"
}
```

#### Response (`201 Created`):
```json
{
  "success": true,
  "message": "Restaurant onboarded successfully with standalone Q Management",
  "data": {
    "restaurant": {
      "id": "18f99e4b-9c44-46aa-b2b9-e48f729fcf91",
      "name": "Downtown Express Food Court",
      "slug": "downtown-express-food-court",
      "created_at": "2026-11-05T14:30:00.000Z"
    },
    "admin": {
      "email": "ops@expresscourt.com",
      "name": "Downtown Express Food Court Owner"
    },
    "subscription": {
      "product": "QUEUE_MANAGEMENT",
      "is_trial": false,
      "trial_days": 0,
      "trial_ends_at": null,
      "tier": "STANDALONE",
      "billing_cycle": "MONTHLY",
      "monthly_ai_credits": 0,
      "unlocked_tier": "STANDALONE"
    },
    "urls": {
      "admin_portal": "/downtown-express-food-court/admin/login",
      "digital_menu": "/downtown-express-food-court/menu",
      "pos_terminal": "/downtown-express-food-court/admin/pos",
      "queue_screen": "/downtown-express-food-court/queue"
    }
  }
}
```

---

## 6. Error Responses

| HTTP Status | Error Case | Response Body |
| :--- | :--- | :--- |
| **`400 Bad Request`** | Missing restaurant name | `{"success": false, "error": "Restaurant name is required"}` |
| **`400 Bad Request`** | Invalid email format | `{"success": false, "error": "Invalid email address format"}` |
| **`400 Bad Request`** | Short password | `{"success": false, "error": "Admin password (admin_password) must be at least 6 characters long"}` |
| **`400 Bad Request`** | Invalid product option | `{"success": false, "error": "Invalid product 'KIOSK'. Must be one of: POS, DIGITAL_MENU, QUEUE_MANAGEMENT."}` |
| **`400 Bad Request`** | Invalid billing cycle | `{"success": false, "error": "Invalid billing_cycle 'WEEKLY'. Must be either 'ANNUALLY' or 'MONTHLY'."}` |
| **`409 Conflict`** | Email already registered | `{"success": false, "error": "An account with this admin email already exists. Please use a different email or log in."}` |
| **`409 Conflict`** | Custom slug already taken | `{"success": false, "error": "The store slug 'spice-garden' is already taken. Please choose another."}` |
| **`500 Internal Error`**| Unexpected server failure | `{"success": false, "error": "Failed to onboard restaurant"}` |

---

## 7. Frontend Integration Example (React / TypeScript)

```tsx
import React, { useState } from 'react';

type ProductChoice = 'POS' | 'DIGITAL_MENU' | 'QUEUE_MANAGEMENT';

export function OnboardingForm() {
  const [product, setProduct] = useState<ProductChoice>('POS');
  const [plan, setPlan] = useState<'ESSENTIAL' | 'PREMIUM'>('PREMIUM');
  const [cycle, setCycle] = useState<'MONTHLY' | 'ANNUALLY'>('ANNUALLY');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/public/restaurants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          admin_email: email,
          admin_password: password,
          product,
          plan: product === 'POS' ? plan : undefined,
          billing_cycle: cycle,
        }),
      });

      const resData = await response.json();
      if (response.ok && resData.success) {
        // Redirect directly to store owner's admin portal
        window.location.href = resData.data.urls.admin_portal;
      } else {
        alert(resData.error || 'Onboarding failed');
      }
    } catch (err) {
      alert('Network error while connecting to Qdine onboarding');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto p-6 bg-white rounded-xl shadow">
      <h2 className="text-xl font-bold">Get Started with Qdine</h2>

      {/* Product Selection */}
      <div className="grid grid-cols-3 gap-2">
        {(['POS', 'DIGITAL_MENU', 'QUEUE_MANAGEMENT'] as const).map((prod) => (
          <button
            key={prod}
            type="button"
            onClick={() => setProduct(prod)}
            className={`p-3 rounded-lg border text-xs font-semibold ${
              product === prod ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200'
            }`}
          >
            {prod === 'POS' ? 'POS System' : prod === 'DIGITAL_MENU' ? 'Digital Menu' : 'Q Management'}
          </button>
        ))}
      </div>

      {product === 'POS' && (
        <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-xs">
          🎉 <strong>14-Day Free Trial:</strong> All Premium features & 30 AI Analyst credits unlocked! No credit card required.
        </div>
      )}

      {/* Basic Inputs */}
      <input
        type="text"
        placeholder="Restaurant Name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full p-2 border rounded"
      />
      <input
        type="email"
        placeholder="Email Address"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full p-2 border rounded"
      />
      <input
        type="password"
        placeholder="Password (min 6 characters)"
        required
        minLength={6}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full p-2 border rounded"
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700"
      >
        {loading ? 'Setting up...' : product === 'POS' ? 'Start 14-Day Free Trial' : 'Create Account'}
      </button>
    </form>
  );
}
```
