# 📱 Admin Mobile Responsive Filters & Header Layout

## What was changed
Updated `AdminPageHeader.tsx`, `InventoryNav.tsx`, `admin/orders/page.tsx`, and `admin/products/page.tsx` to make search inputs, dropdown filter controls, action bars, and section titles stretch and stack **100% full width** on mobile devices ($\le 768\text{px}$, $\le 640\text{px}$, and $\le 480\text{px}$). Added responsive label display for the Counters trigger button.

## Main Features
1. **Zero-Overlap Mobile Page Headers**:
   - On screens $\le 640\text{px}$, `AdminPageHeader` switches to a clean 2-row vertical stack. Page titles (`h1`) resize smoothly to `20px` with `whiteSpace: normal` and `word-break: break-word`, preventing title text from overlapping action buttons (`Refresh`, `Receive Stock`, `Add Product`, etc.).
2. **100% Full-Width Mobile Search & Dropdowns**:
   - On mobile screens ($\le 480\text{px}$), the Search Bar, Status Dropdown (`PENDING`), Order Type Dropdown (`All Order Types`), and Counter Dropdown (`All Counters`) stack vertically and stretch 100% full width edge-to-edge.
3. **Adaptive Action Button Labels**:
   - Updated the Kitchen Counters button in `admin/orders/page.tsx` to display `"Counters"` on mobile screens and `"Counters & Hardware"` on desktop screens, maintaining visual consistency across all action buttons.
4. **Smooth Touch Tab Navigation (`InventoryNav`)**:
   - Enhanced `InventoryNav` with momentum touch scrolling (`-webkit-overflow-scrolling: touch`), right padding, and clean scrollbar behavior for mobile devices.
5. **Horizontal Table Scroll & Touch Hints**:
   - Retained horizontal viewport touch scrolling (`min-width: 840px`) with `"Swipe left to view all order details"` hint banner.

## Database Changes
- None (UI and responsive CSS layout changes only).

## How to run/test it
1. Start dev server: `npm run dev`
2. Open `http://localhost:3000/demo/admin/orders`, `http://localhost:3000/demo/admin/products`, or `http://localhost:3000/demo/admin/inventory` in your browser.
3. Open Browser Developer Tools (F12) and toggle Device Mode to a narrow mobile view ($\le 480\text{px}$, e.g., 320px / iPhone view).
4. Verify `"Counters"` text label appears alongside the Store icon in the action buttons row.
