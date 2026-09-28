# Public Restaurant Onboarding API Documentation

This documentation details the **Public Restaurant Onboarding API** designed for your external landing page, marketing site, or onboarding funnel.

Unlike the internal Super Admin endpoints, this API is **completely public (requires zero tokens or authentication)**, supports **Cross-Origin Resource Sharing (CORS)** from any domain, and atomically creates the restaurant, initial store owner (admin account), queue state, and default staff roles in a single request.

---

## 1. Quick Reference

| Property           | Value                                                  |
| :----------------- | :----------------------------------------------------- |
| **Endpoint URL**   | `/api/public/restaurants` _(Alias: `/api/onboarding`)_ |
| **HTTP Method**    | `POST`                                                 |
| **Authentication** | **None (Public)**                                      |
| **Content-Type**   | `application/json`                                     |
| **CORS Support**   | Enabled (`*` all origins, `POST, OPTIONS`)             |

---

## 2. Request Parameters

Send a JSON payload with the following fields:

### 2.1 Required Fields

| Field            | Type     | Validation / Rules        | Description                                 | Example                     |
| :--------------- | :------- | :------------------------ | :------------------------------------------ | :-------------------------- |
| `name`           | `string` | **Required**, non-empty   | Official name of the restaurant / café      | `"The Coastal Bistro"`      |
| `admin_email`    | `string` | **Required**, valid email | Email address for the store owner to log in | `"owner@coastalbistro.com"` |
| `admin_password` | `string` | **Required**, min 6 chars | Password for the owner's Admin Portal login | `"Secret@12345"`            |

---

### 2.2 Optional Fields

| Field              | Type       | Default                                                   | Description                                                            | Example                                                                |
| :----------------- | :--------- | :-------------------------------------------------------- | :--------------------------------------------------------------------- | :--------------------------------------------------------------------- |
| `slug`             | `string`   | Auto-generated from `name`                                | Unique URL handle (`[a-z0-9-]` only). Used for portal and QR menu URLs | `"coastal-bistro"`                                                     |
| `admin_name`       | `string`   | `"{name} Owner"`                                          | Full name of the store owner                                           | `"Rahul Sharma"`                                                       |
| `phone`            | `string`   | `null`                                                    | Primary restaurant or owner contact number                             | `"+91 9876543210"`                                                     |
| `address`          | `string`   | `null`                                                    | Physical street address of the outlet                                  | `"12 Marine Drive, Kochi"`                                             |
| `logo_url`         | `string`   | `null`                                                    | Public image URL for the restaurant logo                               | `"https://example.com/logo.png"`                                       |
| `primary_color`    | `string`   | `"#971345"`                                               | Brand HEX color used for buttons, badges, and QR menu                  | `"#2563EB"`                                                            |
| `secondary_color`  | `string`   | `"#EC7951"`                                               | Secondary accent HEX color                                             | `"#F59E0B"`                                                            |
| `menu_layout`      | `string`   | `"LIST"`                                                  | Display format for the customer QR menu (`"LIST"` or `"GRID"`)         | `"GRID"`                                                               |
| `menu_title`       | `string`   | `"Today's Specials"`                                      | Headline displayed atop the digital menu                               | `"Chef's Daily Selection"`                                             |
| `menu_description` | `string`   | Preset text                                               | Subtitle description for the customer menu                             | `"Fresh ingredients prepared daily"`                                   |
| `timezone`         | `string`   | `"Asia/Kolkata"`                                          | Standard IANA timezone string                                          | `"Asia/Kolkata"`                                                       |
| `opening_time`     | `string`   | `"09:00:00"`                                              | Daily opening time (`HH:mm:ss`)                                        | `"10:00:00"`                                                           |
| `closing_time`     | `string`   | `"22:00:00"`                                              | Daily closing time (`HH:mm:ss`)                                        | `"23:00:00"`                                                           |
| `gst_type`         | `string`   | `"NONE"`                                                  | Tax model: `"NONE"`, `"REGULAR"`, or `"COMPOSITION"`                   | `"REGULAR"`                                                            |
| `gst_number`       | `string`   | `null`                                                    | Official 15-character GSTIN identifier                                 | `"32AAAAA0000A1Z5"`                                                    |
| `gst_rate`         | `number`   | `5.0`                                                     | Applicable GST percentage                                              | `5.0`                                                                  |
| `modules`          | `string[]` | `['DIGITAL_MENU', 'ONLINE_ORDERING', 'QUEUE_MANAGEMENT']` | Array of modules enabled for this restaurant                           | `['DIGITAL_MENU', 'ONLINE_ORDERING', 'QUEUE_MANAGEMENT', 'INVENTORY']` |

---

## 3. What Happens Under the Hood?

When you call this API, the system atomically completes 5 operations:

1. **Creates Restaurant Record**: Stores the restaurant in PostgreSQL with billing tier, colors, timing, and address.
2. **Generates Unique Slug**: If `slug` was omitted, creates a clean URL slug from the restaurant name (e.g. `"The Coastal Bistro"` -> `"the-coastal-bistro"`).
3. **Creates Owner Account**: Hashes `admin_password` with bcrypt and registers the admin record linked directly to this restaurant.
4. **Seeds Default Staff Roles**: Automatically provisions the 4 core staff roles in the database:
   - `Waiter` (`pos`, `orders`, `tables`)
   - `Kitchen Staff` (`orders`)
   - `Cashier` (`pos`, `orders`, `tables`, `analytics`)
   - `Manager` (`pos`, `orders`, `tables`, `products`, `inventory`, `analytics`, `staff`)
5. **Initializes Live Queue & Modules**: Pre-populates `queue_state` and enables digital menu & online ordering.

---

## 4. Responses

### 4.1 Success Response (`201 Created`)

```json
{
  "success": true,
  "message": "Restaurant and admin owner account created successfully",
  "data": {
    "restaurant": {
      "id": "7b8f9e20-3329-44cb-8a4e-d0f98317a102",
      "name": "The Coastal Bistro",
      "slug": "the-coastal-bistro",
      "phone": "+91 9876543210",
      "address": "12 Marine Drive, Kochi",
      "primary_color": "#971345",
      "menu_layout": "LIST",
      "created_at": "2026-09-22T08:30:00.000Z"
    },
    "admin": {
      "email": "owner@coastalbistro.com",
      "name": "Rahul Sharma"
    },
    "urls": {
      "admin_portal": "/the-coastal-bistro/admin/login",
      "digital_menu": "/the-coastal-bistro/menu",
      "pos_terminal": "/the-coastal-bistro/admin/pos"
    }
  }
}
```

---

### 4.2 Error Responses

#### `400 Bad Request` (Missing required parameters or invalid formatting)

```json
{
  "success": false,
  "error": "Admin password (admin_password) must be at least 6 characters long"
}
```

#### `409 Conflict` (Email or Slug already in use)

```json
{
  "success": false,
  "error": "An account with this admin email already exists. Please use a different email or log in."
}
```

or

```json
{
  "success": false,
  "error": "The store slug 'coastal-bistro' is already taken. Please choose another."
}
```

#### `500 Internal Server Error`

```json
{
  "success": false,
  "error": "Failed to onboard restaurant"
}
```

---

## 5. Code Integration Examples

### 5.1 JavaScript (`fetch`)

```javascript
async function onboardNewRestaurant() {
  const payload = {
    name: "The Coastal Bistro",
    admin_email: "owner@coastalbistro.com",
    admin_password: "SecurePassword123",
    admin_name: "Rahul Sharma",
    phone: "+91 9876543210",
    address: "12 Marine Drive, Kochi",
    primary_color: "#971345",
  };

  try {
    const response = await fetch(
      "https://your-domain.com/api/public/restaurants",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    const result = await response.json();

    if (response.ok && result.success) {
      console.log("Restaurant created!", result.data);
      // Redirect user directly to their new admin login portal
      window.location.href = `https://your-domain.com${result.data.urls.admin_portal}`;
    } else {
      alert("Registration failed: " + (result.error || "Unknown error"));
    }
  } catch (error) {
    console.error("Network error:", error);
  }
}
```

---

### 5.2 React Form Example

```tsx
import React, { useState } from "react";

export function OnboardingForm() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    admin_email: "",
    admin_password: "",
    phone: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(
        "https://your-domain.com/api/public/restaurants",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        },
      );
      const data = await res.json();

      if (res.ok && data.success) {
        // Automatically redirect to the created admin portal
        window.location.href = `https://your-domain.com${data.data.urls.admin_portal}`;
      } else {
        alert(data.error || "Failed to create restaurant");
      }
    } catch (err) {
      alert("Network error connecting to onboarding service");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Restaurant Name"
        required
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
      />
      <input
        type="email"
        placeholder="Your Email Address"
        required
        value={formData.admin_email}
        onChange={(e) =>
          setFormData({ ...formData, admin_email: e.target.value })
        }
      />
      <input
        type="password"
        placeholder="Password (min 6 characters)"
        required
        minLength={6}
        value={formData.admin_password}
        onChange={(e) =>
          setFormData({ ...formData, admin_password: e.target.value })
        }
      />
      <input
        type="tel"
        placeholder="Phone Number (optional)"
        value={formData.phone}
        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
      />
      <button type="submit" disabled={loading}>
        {loading ? "Creating Your Restaurant..." : "Get Started Free"}
      </button>
    </form>
  );
}
```

---

### 5.3 cURL Command

```bash
curl -X POST https://your-domain.com/api/public/restaurants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "The Coastal Bistro",
    "admin_email": "owner@coastalbistro.com",
    "admin_password": "Password@123",
    "phone": "+91 9876543210",
    "address": "12 Marine Drive, Kochi",
    "primary_color": "#971345"
  }'
```

---

## 6. Post-Registration Workflow

Once the API returns `201 Created`:

1. **Admin Portal Login**: The owner can log in at `https://your-domain.com/{slug}/admin/login` using their `admin_email` and `admin_password`.
2. **Customer QR Menu**: Live immediately at `https://your-domain.com/{slug}/menu`.
3. **POS Terminal**: Live immediately at `https://your-domain.com/{slug}/admin/pos`.
4. **Staff Roles**: 4 default roles (`Waiter`, `Kitchen Staff`, `Cashier`, `Manager`) are already initialized and ready for staff assignment under `/admin/staff`.
