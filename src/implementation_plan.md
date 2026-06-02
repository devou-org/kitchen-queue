# Staff Management & Ordering Implementation Plan

This document outlines the proposed architecture and APIs for the new **Staff Management Dashboard** and **Staff Ordering (POS)** functionalities.

## User Review Required

> [!IMPORTANT]  
> Please review the proposed database changes and API endpoints. Specifically, do we want to create a new `staff` table, or modify the existing `admins` table to support role-based access (e.g., `SUPER_ADMIN`, `CASHIER`, `KITCHEN_STAFF`)? The plan currently proposes creating a new `staff` table to keep things cleanly separated.

## Open Questions

> [!WARNING]  
> 1. **Authentication:** Should staff members log in via an email/password, or via a PIN code for faster access at the counter?
> 2. **Role-Based Access Control (RBAC):** What specific roles do we need? (e.g., Cashier, Kitchen, Manager, Admin)
> 3. **Ordering:** Will staff be taking payments directly through the platform, or just marking orders as `PAID`?

## Proposed Changes

### 1. Database Schema Additions

To support staff management, we will need to add a new table to the database.

#### [NEW] `staff` table
- `id` (UUID, Primary Key)
- `name` (String)
- `email` (String, Unique)
- `phone` (String, Optional)
- `role` (Enum: `ADMIN`, `CASHIER`, `KITCHEN`)
- `pin` (String, Optional - for quick login)
- `is_active` (Boolean, Default: true)
- `created_at` / `updated_at` (Timestamps)

*(Note: We will need to update `src/lib/db.ts` to include the queries for this new table).*

---

### 2. Staff Management Dashboard APIs

These APIs will be consumed by the Super Admin dashboard to manage the restaurant staff.

#### [NEW] `GET /api/admin/staff`
- **Purpose:** Fetch a list of all staff members.
- **Parameters:** Optional filters (e.g., `?role=CASHIER`, `?active=true`).
- **Response:** Array of staff objects.

#### [NEW] `POST /api/admin/staff`
- **Purpose:** Create a new staff member.
- **Payload:** `{ name, email, phone, role, pin }`
- **Response:** The newly created staff object.

#### [NEW] `PUT /api/admin/staff/[id]`
- **Purpose:** Update a staff member's details or role.
- **Payload:** `{ name, email, phone, role, is_active, pin }`
- **Response:** The updated staff object.

#### [NEW] `DELETE /api/admin/staff/[id]`
- **Purpose:** Soft delete (deactivate) a staff member.
- **Response:** Success confirmation.

---

### 3. Staff Ordering (POS) APIs

For the ordering side, staff will use a Point of Sale (POS) style interface to take orders from customers at the counter. We can largely reuse the existing APIs, ensuring they handle staff-authenticated requests.

#### [EXISTING] `GET /api/products` & `GET /api/categories`
- **Purpose:** Fetch the menu items and categories for the POS interface. Staff can browse or search products to add to the cart.

#### [EXISTING] `POST /api/orders`
- **Purpose:** Create an order on behalf of a customer.
- **Modifications:** We may need to pass an optional `staff_id` in the payload to track which staff member created the order. 
- **Payload:** `{ customer_name, phone, items: [...], total_price, notes, party_size, staff_id }`

#### [EXISTING] `PUT /api/orders/[id]`
- **Purpose:** Update an order (e.g., mark as `PAID`, edit items, or update the status to `PREPARING` or `COMPLETED`).
- **Modifications:** Ensure the API allows staff to easily toggle the `is_paid` status or alter the order items if a customer changes their mind before the kitchen starts preparing it.

#### [EXISTING] `GET /api/orders`
- **Purpose:** Fetch the active orders for the Kitchen Display System (KDS) or the Cashier's dashboard.
- **Modifications:** Filter by `status` (e.g., `PENDING` for cashiers, `PREPARING` for kitchen).

## Verification Plan

### Automated Tests
- N/A - Verify locally.

### Manual Verification
1. **Staff Management:** Create, edit, and deactivate a staff member from the admin panel. Ensure the data persists in the database.
2. **Staff Ordering:** Log in as a staff member (e.g., Cashier), add items to the cart, and submit an order via `POST /api/orders`. Verify the order appears in the Kitchen Queue correctly.
3. **Tracking:** Confirm that orders placed by staff correctly log the staff member's details (if tracking is implemented).
