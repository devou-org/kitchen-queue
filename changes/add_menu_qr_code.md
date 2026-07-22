# Changes: Add Menu QR Code Feature

## Description
This update introduces a new "QR Code" section in the Restaurant Admin Settings page, allowing restaurant administrators to generate, manage, and download a digital menu QR code for their customers.

## Modified Files

### `package.json`
- Installed `qrcode.react` package to easily generate and render QR Codes natively using React Canvas/SVG elements.

### `src/components/QRCodeGenerator.tsx` (New File)
- Created a highly modular, reusable QR Code generator component.
- **Key Features:**
  - Uses `QRCodeCanvas` with high resolution (1024x1024) but scales it down in the UI using CSS, providing a high-quality asset suitable for printing while keeping the UI clean.
  - Generates an instant preview of the QR code with customizable foreground colors.
  - Implemented the ability to download the QR Code directly as a PNG file.
  - Implemented a "Regenerate" button using React state (`generateKey`) to force re-renders.
  - Added a one-click clipboard copy feature for the underlying destination URL.

### `src/app/[slug]/admin/settings/page.tsx`
- Imported and rendered the `QRCodeGenerator` component in the right-side configuration panel (below the Brand Preview).
- Dynamically generates the destination URL using `window.location.origin` appended with `/{restaurant_slug}/menu`.
- Passes the currently selected primary brand color into the QR code to keep things visually consistent.
