# ImageKit Integration Guide

See the full documentation in [docs/IMAGEKIT_INTEGRATION.md](file:///c:/Users/A%20lan%20John%20Chacko/OneDrive/Desktop/Devou/kitchen-queue/docs/IMAGEKIT_INTEGRATION.md).

## Quick Summary
- **Product Add/Edit**: Integrated direct file uploading to ImageKit in `src/components/AdminProductForm.tsx`.
- **Max File Limit**: **250 KB** (enforced both client-side and server-side).
- **Service Layer**: `src/app/services/imagekit.service.ts` for clean abstraction.
- **Backend API Routes**:
  - `POST /api/imagekit/upload`: Securely uploads file to ImageKit media library under `/products/{slug}`.
  - `GET /api/imagekit/auth`: Provides client authentication signature parameters.
- **Environment Variables**:
  - `IMAGEKIT_PUBLIC_KEY`
  - `IMAGEKIT_PRIVATE_KEY`
  - `IMAGEKIT_URL_ENDPOINT`
  - `NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY`
  - `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT`
