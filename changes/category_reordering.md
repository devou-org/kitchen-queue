# 🍔 Food Category Reordering System

## What was changed
Implemented persistent, restaurant-scoped food category reordering across the Admin Panel, Staff POS, and Customer Digital Menu.

## Main Features
1. **Database Schema & Scoping (`migrations/20260918_category_reordering.sql`)**:
   - Added `restaurant_id` and `sort_order` columns to `categories` table.
   - Added unique constraint `(restaurant_id, name)`.
   - Populated `sort_order` for existing categories in increments of 10 (`10, 20, 30...`).
   - Created database index `idx_categories_restaurant_sort` on `(restaurant_id, sort_order)`.

2. **Backend API Endpoints**:
   - **`GET /api/categories`**: Retrieves categories for the active restaurant ordered by `sort_order ASC`.
   - **`POST /api/categories`**: Creates a new category and assigns `sort_order = max(sort_order) + 10` (appends to the end of the list).
   - **`POST /api/categories/reorder`**: Swaps `sort_order` values between neighboring categories inside a single database transaction.

3. **Form Category Control (`AdminProductForm.tsx`)**:
   - Relocated category management into the **Product Form** directly under *Basic Details* next to `Category *`.
   - Features **`⇅ Reorder`** and **`+ Add Category`** triggers right above the category dropdown.
   - Removed standalone button from the main Admin header bar to keep the page layout clean and uncluttered.
   - When categories are reordered or added, the form's category `<select>` dropdown instantly updates to match the new sequence.

4. **Staff POS & Customer Menu Integration (`sortCategoriesByConfig`)**:
   - Created reusable utility `sortCategoriesByConfig` in `src/lib/category-order.ts`.
   - Updated `src/app/[slug]/staff/menu/page.tsx` and `src/app/[slug]/menu/page.tsx` to render category tabs according to the configured `sort_order`.
   - Empty categories remain manageable in Admin but are safely excluded from customer/staff menus if they contain 0 products.

## Files Created / Modified
| File | Action | Description |
|:---|:---|:---|
| `migrations/20260918_category_reordering.sql` | **NEW** | Database migration for restaurant scoping & sort_order |
| `run_migration_category_reordering.js` | **NEW** | Migration runner script |
| `src/lib/category-order.ts` | **NEW** | Reusable category sorting utility |
| `src/components/modules/products/CategoryReorderModal.tsx` | **NEW** | Category reorder modal component |
| `src/app/api/categories/reorder/route.ts` | **NEW** | Transactional category reorder API route |
| `src/lib/db.ts` | **MODIFIED** | Added `reorderCategories`, updated `getCategories` & `createCategory` |
| `src/app/api/categories/route.ts` | **MODIFIED** | Updated to support restaurant scoping & sort_order |
| `src/app/[slug]/admin/products/page.tsx` | **MODIFIED** | Integrated Reorder Categories button and modal |
| `src/app/[slug]/staff/menu/page.tsx` | **MODIFIED** | Applied configured category tab order |
| `src/app/[slug]/menu/page.tsx` | **MODIFIED** | Applied configured category tab order |

## Acceptance Testing & How to Test
1. Start dev server: `npm run dev`
2. Go to **Admin Products**: `http://localhost:3000/test-399/admin/products`.
3. Click **"Reorder Categories"** in the top action bar.
4. Click **▲ Move Up** or **▼ Move Down** next to any category.
5. Verify the order updates instantly and persists after refreshing the page.
6. Open **Staff POS** (`/test-399/staff/menu`) or **Customer Menu** (`/test-399/menu`) — verify the category tabs appear in the exact configured sequence.
7. Add a new category — verify it appends to the end of the sequence without disturbing existing categories.
