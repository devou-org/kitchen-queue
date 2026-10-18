import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { uploadToImageKit } from '@/lib/imagekit';

// 250 KB in bytes (250 * 1024)
export const MAX_IMAGE_SIZE_BYTES = 250 * 1024;
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
];

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication Check
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin or Staff authentication required' },
        { status: 401 }
      );
    }

    // 2. Parse Multipart Form Data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const requestedFolder = formData.get('folder') as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided in upload request' },
        { status: 400 }
      );
    }

    // 3. Validate File Size (Strict 250 KB limit)
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      const sizeInKb = (file.size / 1024).toFixed(1);
      return NextResponse.json(
        {
          success: false,
          error: `File size (${sizeInKb} KB) exceeds the maximum allowed limit of 250 KB. Please compress or resize the image.`,
        },
        { status: 400 }
      );
    }

    // 4. Validate File MIME Type
    if (!file.type || !ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported file type: ${file.type || 'unknown'}. Allowed formats: JPG, PNG, WEBP, GIF, SVG.`,
        },
        { status: 400 }
      );
    }

    // 5. Determine Destination Folder
    const slugHeader = request.headers.get('x-restaurant-slug');
    let targetFolder = requestedFolder?.trim() || '/products';
    if (slugHeader && !targetFolder.includes(slugHeader)) {
      targetFolder = `/products/${slugHeader}`;
    }

    // 6. Convert to Buffer and Upload to ImageKit
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadResult = await uploadToImageKit(buffer, file.name, targetFolder);

    return NextResponse.json({
      success: true,
      data: uploadResult,
      message: 'Image uploaded successfully',
    });
  } catch (error: any) {
    console.error('[ImageKit Upload Error]:', error);
    const errorMessage = error?.message || 'Failed to upload image';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
