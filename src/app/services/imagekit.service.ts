export const MAX_IMAGE_SIZE_BYTES = 250 * 1024; // 250 KB
export const MAX_IMAGE_SIZE_LABEL = '250 KB';

export interface ImageKitUploadResponseData {
  fileId: string;
  name: string;
  url: string;
  thumbnailUrl?: string;
  height?: number;
  width?: number;
  size?: number;
  filePath?: string;
}

export interface ImageKitUploadResult {
  success: boolean;
  data?: ImageKitUploadResponseData;
  error?: string;
  message?: string;
}

class ImageKitService {
  /**
   * Helper to retrieve authorization and slug headers from current context
   */
  private getAuthHeaders(): Record<string, string> {
    if (typeof window === 'undefined') return {};
    let token: string | null = null;
    const path = window.location.pathname;

    if (path.startsWith('/admin') || path.includes('/admin')) {
      token = localStorage.getItem('admin_token');
    } else if (path.includes('/staff')) {
      token = localStorage.getItem('staff_token') || localStorage.getItem('admin_token');
    } else {
      token = localStorage.getItem('auth_token');
    }

    if (!token) {
      token = localStorage.getItem('admin_token') || localStorage.getItem('auth_token') || localStorage.getItem('staff_token');
    }

    // Extract slug from URL: /[slug]/...
    const segments = path.split('/').filter(Boolean);
    let slug = segments[0];

    if (slug === 'staff') {
      const staffToken = localStorage.getItem('staff_token');
      if (staffToken) {
        try {
          const payloadPart = staffToken.split('.')[1];
          if (payloadPart) {
            const payload = JSON.parse(atob(payloadPart));
            if (payload.restaurantSlug) {
              slug = payload.restaurantSlug;
            }
          }
        } catch (e) {
          console.error('Error decoding staff token in ImageKitService:', e);
        }
      }
    }

    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (slug) headers['x-restaurant-slug'] = slug;

    return headers;
  }

  /**
   * Validates file size (max 250 KB) and format before upload
   */
  validateImage(file: File): { valid: boolean; error?: string } {
    if (!file) {
      return { valid: false, error: 'Please select a file to upload.' };
    }

    if (!file.type || !file.type.startsWith('image/')) {
      return { valid: false, error: 'Only image files (JPG, PNG, WEBP, GIF, SVG) are allowed.' };
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      const actualKb = (file.size / 1024).toFixed(1);
      return {
        valid: false,
        error: `Image size (${actualKb} KB) exceeds the maximum allowed limit of 250 KB. Please choose a smaller image or compress it.`,
      };
    }

    return { valid: true };
  }

  /**
   * Uploads an image file to ImageKit via Next.js backend API
   */
  async uploadImage(file: File, folder?: string): Promise<ImageKitUploadResult> {
    const validation = this.validateImage(file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (folder) {
        formData.append('folder', folder);
      }

      const res = await fetch('/api/imagekit/upload', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        return {
          success: false,
          error: data.error || `Upload failed with status ${res.status}`,
        };
      }

      return {
        success: true,
        data: data.data,
        message: data.message,
      };
    } catch (err: any) {
      console.error('[ImageKitService] Upload error:', err);
      return {
        success: false,
        error: err?.message || 'Network error while uploading image',
      };
    }
  }

  /**
   * Utility to format an ImageKit URL with real-time transformations
   */
  getOptimizedUrl(
    url: string,
    transforms: { width?: number; height?: number; quality?: number; format?: string } = {}
  ): string {
    if (!url || !url.includes('imagekit.io')) return url;

    const parts: string[] = [];
    if (transforms.width) parts.push(`w-${transforms.width}`);
    if (transforms.height) parts.push(`h-${transforms.height}`);
    if (transforms.quality) parts.push(`q-${transforms.quality}`);
    if (transforms.format) parts.push(`f-${transforms.format}`);

    if (parts.length === 0) return url;

    const joinChar = url.includes('?') ? '&' : '?';
    return `${url}${joinChar}tr=${parts.join(',')}`;
  }
}

export const imageKitService = new ImageKitService();
