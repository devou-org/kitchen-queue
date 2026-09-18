# 📱 Admin Mobile, Laptop Layout & Veg/Non-Veg Filtering

## What was changed
Updated `AdminPageHeader.tsx`, `InventoryNav.tsx`, `DietaryFilter.tsx`, `menu/page.tsx`, `staff/menu/page.tsx`, `admin/orders/page.tsx`, and `admin/products/page.tsx` to add dynamic **Veg / Non-Veg / All** dietary filtering across Customer, Staff POS, and Admin screens, alongside complete mobile & laptop layout responsiveness.

## Main Features
1. **Veg / Non-Veg / All Dietary Filter (`DietaryFilter.tsx`)**:
   - Created reusable `<DietaryFilter />` toggle component (🟢 **Veg**, 🔴 **Non-Veg**, 🔘 **All**).
   - Integrated dynamic, real-time filtering (without page reloads) across:
     - Customer Digital Menu (`/[slug]/menu`)
     - Staff POS Counter Menu (`/[slug]/staff/menu`)
     - Admin Products Catalog (`/[slug]/admin/products`)
   - Food items without explicit dietary preference default safely to `'NON_VEG'` when filtering by Non-Veg, and are included under `'ALL'`.
2. **Small Laptop & Tablet Layout Support ($\le 1280\text{px}$)**:
   - On small laptop screens (such as 1024px MacBooks/tablets with sidebars open), the Orders page header automatically splits the filter toolbar and action buttons into 2 clean horizontal rows.
3. **Zero-Overlap Mobile Page Headers ($\le 640\text{px}$)**:
   - Page titles (`h1`) resize smoothly to `20px` with `whiteSpace: normal` and `word-break: break-word`, preventing title text from overlapping action buttons (`Refresh`, `Receive Stock`, `Add Product`, etc.).
4. **100% Full-Width Mobile Search & Dropdowns ($\le 640\text{px}$)**:
   - On mobile screens ($\le 640\text{px}$), the Search Bar, Status Dropdown (`PENDING`), Order Type Dropdown (`All Order Types`), and Counter Dropdown (`All Counters`) stack vertically and stretch 100% full width edge-to-edge.
5. **Adaptive Action Button Labels**:
   - Displays `"Counters"` on mobile screens and `"Counters & Hardware"` on desktop screens.
6. **Unified Header Button Color Palette**:
   - Styled `BOM Recipes` and `Counters` buttons on Admin Products page with the primary theme color (`var(--primary)`) matching `Upload Menu` and `Add Product`.

## Database Changes
- None (Uses existing `dietary_preference` column on `products` table).

## How to run/test it
1. Start dev server: `npm run dev`
2. Open `http://localhost:3000/demo/menu`, `http://localhost:3000/demo/staff/menu`, or `http://localhost:3000/demo/admin/products` in your browser.
3. Click **Veg** 🟢 $\rightarrow$ Verify only Vegetarian items display dynamically.
4. Click **Non-Veg** 🔴 $\rightarrow$ Verify only Non-Vegetarian items display dynamically.
5. Click **All** 🔘 $\rightarrow$ Verify all items display.
