# Changes: Service Toggle Operating Hours

## Description
This update disables the service status toggle during a restaurant's non-operating hours to prevent accidental toggling when the restaurant is closed. It accurately calculates the current time within the restaurant's configured timezone and compares it against its opening and rollover times.

## Modified Files

### `src/app/api/admin/settings/route.ts`
1. **GET Method**:
   - Added logic to fetch `opening_time`, `rollover_time`, and calculate `current_time_in_tz` directly in SQL.
   - Calculated `isOperatingHours` boolean based on whether the current time falls between the opening and rollover times (handling standard days and cross-midnight scenarios).
   - Returned `isOperatingHours` to the frontend client.

2. **POST Method**:
   - Replicated the `isOperatingHours` logic in the update route.
   - Returns a `403 Forbidden` response if there's an attempt to toggle the service status outside of configured operating hours.

### `src/components/ServiceToggle.tsx`
1. Added state for `isOperatingHours` (defaults to `true`).
2. Read the `isOperatingHours` flag from the settings API response.
3. Disabled the toggle input switch when `!isOperatingHours`.
4. Appended a subtle UI text `(Outside operating hours)` under the Service Status label when disabled.
