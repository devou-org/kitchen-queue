# Multi-Tenant Modular SaaS Migration Status

This file tracks the ongoing transition of the kitchen-queue application from a single-tenant system to a multi-tenant, modular SaaS platform.

## Architecture Decisions
- **Routing**: Subdomain-based (e.g., `[restaurant_slug].devou.com/menu`).
- **Data Isolation**: `restaurant_id` on every major table.

## Checklist

### Phase 1: Database Redesign (Multi-Tenant Architecture)
- [x] Create `migration_saas_phase1.sql` script.
- [x] Create `restaurants` table.
- [x] Create `restaurant_modules` table for feature toggles.
- [x] Migrate existing data into a default 'Devou Kitchen' restaurant (`slug='demo'`).
- [x] Add `restaurant_id` to `products`, `orders`, `admins`, `queue_state`, `otp_logs`.
- [x] **Run the SQL Migration in Neon**.

### Phase 2: Super Admin Dashboard
- [ ] Create Super Admin middleware check.
- [ ] Create Tenants list page (`/admin/tenants`).
- [ ] Create Module Manager page (`/admin/tenants/[id]/modules`).
- [ ] Display global SaaS overview.

### Phase 3: Routing & Middleware Updates (Subdomain)
- [x] Update `middleware.ts` to detect subdomains (`req.headers.get('host')`).
- [x] Store active `restaurant_slug` and `restaurant_id` in request context or headers.
- [ ] Implement checks: If `module_name` is disabled for a restaurant, block access to those routes.

### Phase 4: Refactoring API & Database Queries
- [x] Update `src/lib/db.ts`: `getProducts`, `createProduct`, etc. must accept and filter by `restaurant_id`.
- [ ] Update `src/lib/db.ts`: `getOrders`, `createOrder`, etc. must accept and filter by `restaurant_id`.
- [ ] Update Queue Socket Service to use Socket.IO rooms partitioned by `restaurant_id`.

### Phase 5: UI Modularization
- [ ] Create a centralized `useModules()` hook to fetch enabled modules for the current subdomain.
- [ ] Dynamically render bottom navigation based on modules (e.g., hide Cart if Online Ordering is off).
- [ ] Hide/Show features in Admin Sidebar based on modules.
