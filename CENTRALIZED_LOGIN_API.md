# Centralized Login API Documentation

The **Centralized Login API** allows users (Super Admins, Restaurant Admins / Owners, and Staff members) to authenticate through a single, unified entry point (such as a central landing page or main domain login portal) using only their **email** and **password**.

The endpoint dynamically identifies the user's role and associated restaurant, provisions session cookies and JWT access/refresh tokens, and returns the target redirection URL for the user's specific restaurant dashboard or staff portal.

---

## 1. Endpoint Overview

* **Method**: `POST`
* **Path**: `/api/auth/centralized-login`
* **Content-Type**: `application/json`
* **Authentication**: None (Public)
* **Server Implementation**: `src/app/api/auth/centralized-login/route.ts`

---

## 2. Request Specification

### Headers
```http
POST /api/auth/centralized-login HTTP/1.1
Host: your-domain.com
Content-Type: application/json
```

### Request Body Parameters

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `email` | `string` | **Yes** | User's registered email address (case-insensitive). |
| `password` | `string` | **Yes** | Account password in plaintext. |

### Example Request Body
```json
{
  "email": "manager@restaurant.com",
  "password": "Password123!"
}
```

---

## 3. Account Hierarchy & Redirection Rules

The API verifies credentials against user roles in the following order:

| Role Category | Source Table / Condition | Redirect URL | Cookies Set |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admins` table (`is_super_admin: true`) | `/super-admin` | `super_admin_token` |
| **Restaurant Admin / Owner** | `admins` table | `/{slug}/admin/orders` | `admin_token`, `admin_logged_in`, `admin_refresh_token` |
| **Kitchen / Chef** | `staff` table (`role: 'KITCHEN'` or Chef) | `/{slug}/admin/orders` | `staff_token`, `admin_token`, `admin_logged_in`, `admin_refresh_token` |
| **Manager / Admin Staff** | `staff` table (with `*` or admin permissions) | `/{slug}/admin/orders` | `staff_token`, `admin_token`, `admin_logged_in`, `admin_refresh_token` |
| **Floor Staff / Waiter** | `staff` table (service / POS permissions) | `/{slug}/staff/menu` | `staff_token`, `admin_token`, `admin_logged_in`, `admin_refresh_token` |

> **Note**: For staff accounts, the system automatically checks `is_active !== false`. Deactivated staff cannot log in.

---

## 4. Response Specifications

### A. Restaurant Admin / Owner (HTTP 200 OK)
Returned when a restaurant administrator or owner logs in.
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "slug": "grand-bistro",
  "redirect_url": "/grand-bistro/admin/orders",
  "user": {
    "id": "e28b8cf5-730f-4889-b145-d81995ec2605",
    "email": "admin@grandbistro.com",
    "name": "Grand Bistro Admin",
    "role": "ADMIN",
    "permissions": ["*"],
    "is_admin": true,
    "restaurant_id": "9701a5dc-424a-463e-a745-f09dfebba96e",
    "restaurant_slug": "grand-bistro",
    "restaurant_name": "Grand Bistro"
  }
}
```

### B. Staff Member (HTTP 200 OK)
Returned when a staff member (waiter, cashier, kitchen chef, manager) logs in.
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "slug": "grand-bistro",
  "redirect_url": "/grand-bistro/staff/menu",
  "user": {
    "id": "98e4f1a2-5813-43bb-8a02-53ec38152342",
    "email": "waiter1@grandbistro.com",
    "name": "Rahul Verma",
    "role": "Waiter",
    "role_id": "7832a884-a1e4-4a27-be08-59c439162985",
    "permissions": ["pos", "orders", "tables"],
    "is_admin": false,
    "is_staff": true,
    "restaurant_id": "9701a5dc-424a-463e-a745-f09dfebba96e",
    "restaurant_slug": "grand-bistro",
    "restaurant_name": "Grand Bistro"
  }
}
```

### C. Super Admin (HTTP 200 OK)
Returned when a platform super-admin logs in.
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "role": "SUPER_ADMIN",
  "redirect_url": "/super-admin",
  "user": {
    "id": "admin-system",
    "email": "superadmin@devou.com",
    "name": "Super Admin",
    "role": "SUPER_ADMIN",
    "is_super_admin": true,
    "is_admin": true
  }
}
```

---

## 5. Error Responses

### 400 Bad Request
Returned when either `email` or `password` is missing or empty.
```json
{
  "success": false,
  "error": "Email and password are required"
}
```

### 401 Unauthorized
Returned when the email does not exist, the password does not match, or the account is deactivated.
```json
{
  "success": false,
  "error": "Invalid email or password"
}
```

### 500 Internal Server Error
Returned if an unexpected database or server failure occurs.
```json
{
  "success": false,
  "error": "An unexpected error occurred during login"
}
```

---

## 6. Cookies Automatically Set by the Response

The API automatically sets the following cookies on the response header (`Set-Cookie`), meaning browser-based clients do not need to manually parse or set cookie headers:

| Cookie Name | Purpose | HttpOnly | SameSite | Max Age |
| :--- | :--- | :--- | :--- | :--- |
| `admin_token` | Main JWT session token for Admin & Staff operations | `true` | `Lax` | 24 Hours |
| `staff_token` | Explicit staff session token | `true` | `Lax` | 24 Hours |
| `super_admin_token`| Super-admin portal session token | `true` | `Lax` | 8 Hours |
| `admin_logged_in` | Client-readable flag for fast UI state detection | `false` | `Lax` | 90 Days |
| `admin_refresh_token`| Long-lived token for silent session renewal | `true` | `Lax` | 90 Days |

---

## 7. Frontend Code Integration Example

### Vanilla JS / Fetch
```javascript
async function loginUser(email, password) {
  const response = await fetch('/api/auth/centralized-login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Login failed');
  }

  // 1. Optionally save user info and token to localStorage
  if (data.token) {
    localStorage.setItem('admin_token', data.token);
    localStorage.setItem('admin_user', JSON.stringify(data.user));
  }

  // 2. Redirect user to their restaurant or super-admin dashboard
  window.location.href = data.redirect_url;
}
```

### React / Next.js Form Handler
```tsx
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CentralizedLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/centralized-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Invalid credentials');
      }

      // Store local authentication state
      if (result.token) {
        localStorage.setItem('admin_token', result.token);
        localStorage.setItem('admin_user', JSON.stringify(result.user));
      }

      // Navigate to the determined dashboard URL
      router.push(result.redirect_url);
    } catch (err: any) {
      setError(err.message || 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error-alert">{error}</div>}
      <input
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Enter your password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Logging in...' : 'Sign In'}
      </button>
    </form>
  );
}
```

---

## 8. Summary Checklist for Developers

1. **Endpoint**: `POST /api/auth/centralized-login`
2. **Payload**: `{ "email": "...", "password": "..." }`
3. **Key Result**:
   - `data.redirect_url`: Where the browser should navigate.
   - `data.slug`: The restaurant slug associated with the user.
   - `data.user`: User profile, permissions, and restaurant details.
4. **Cookies**: Automatically managed by the browser response.
