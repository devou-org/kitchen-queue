import ImageKit from 'imagekit';

export interface ImageKitUploadResult {
  fileId: string;
  name: string;
  url: string;
  thumbnailUrl?: string;
  height?: number;
  width?: number;
  size?: number;
  filePath: string;
}

/**
 * Returns an initialized ImageKit client instance using environment variables.
 * Supports both standard and NEXT_PUBLIC_ prefixed keys for public key and URL endpoint.
 */
export function getImageKitClient(): ImageKit {
  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY || process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY;
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT || process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;

  if (!privateKey || !publicKey || !urlEndpoint) {
    throw new Error(
      'ImageKit credentials are not properly configured. Please ensure IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, and IMAGEKIT_URL_ENDPOINT are defined in .env.local.'
    );
  }

  return new ImageKit({
    publicKey,
    privateKey,
    urlEndpoint,
  });
}

/**
 * Upload a binary buffer to ImageKit media library.
 * 
 * @param fileBuffer The image Buffer to upload
 * @param fileName Name of the file with extension
 * @param folder Target folder inside ImageKit (default: '/products')
 */
export async function uploadToImageKit(
  fileBuffer: Buffer,
  fileName: string,
  folder: string = '/products'
): Promise<ImageKitUploadResult> {
  const imagekit = getImageKitClient();

  // Clean filename to remove invalid characters
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');

  const response = await imagekit.upload({
    file: fileBuffer,
    fileName: sanitizedFileName,
    folder,
    useUniqueFileName: true,
  });

  return {
    fileId: response.fileId,
    name: response.name,
    url: response.url,
    thumbnailUrl: response.thumbnailUrl,
    height: response.height,
    width: response.width,
    size: response.size,
    filePath: response.filePath,
  };
}

/**
 * Generates authentication parameters (token, expire, signature) for client-side uploads.
 */
export function getImageKitAuthParameters() {
  const imagekit = getImageKitClient();
  return imagekit.getAuthenticationParameters();
}
