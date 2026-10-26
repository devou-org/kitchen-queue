/**
 * Robust PEM sanitizer and normalizer for QZ Tray Security Signing.
 * Handles environment variable quirks in Coolify/Docker/VPS deployments:
 * - Accidental surrounding double/single quotes ("...", '...')
 * - Escaped newlines (\n, \r\n, \\n, \\\\n)
 * - Raw Base64 encoded PEMs
 * - Windows CRLF line breaks
 * - Single-line PEMs with spaces
 * - Standard RFC 7468 64-character line formatting
 */
export function normalizePem(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let text = String(raw).trim();

  // Strip wrapping quotes (single or double) that often get included in Coolify/Docker env vars
  while ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1).trim();
  }

  // If the user pasted the entire PEM as a base64 encoded string
  if (!text.includes('BEGIN') && !text.includes('KEY') && !text.includes('CERTIFICATE')) {
    try {
      const decoded = Buffer.from(text, 'base64').toString('utf8');
      if (decoded.includes('BEGIN')) {
        text = decoded.trim();
      }
    } catch { }
  }

  while ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1).trim();
  }

  // Replace all forms of escaped newlines: \r\n, \n, \\n, \\\\n, etc.
  text = text.replace(/\\+r/g, '').replace(/\\+n/g, '\n').replace(/\r/g, '');

  // Extract header, body, footer using regex (supports PRIVATE KEY, RSA PRIVATE KEY, CERTIFICATE, etc.)
  const match = text.match(/-----BEGIN ([A-Z0-9 ]+)-----([\s\S]+?)-----END ([A-Z0-9 ]+)-----/);
  if (match) {
    const beginTag = match[1];
    const rawBody = match[2].replace(/[\s\r\n\t]+/g, ''); // strip all whitespace from body
    const endTag = match[3];

    // Chunk body into 64-character lines (standard PEM specification)
    const chunkedBody = rawBody.match(/.{1,64}/g)?.join('\n') || rawBody;
    return `-----BEGIN ${beginTag}-----\n${chunkedBody}\n-----END ${endTag}-----\n`;
  }

  // Fallback: split by newlines, trim lines, rejoin with \n
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.length > 0 ? lines.join('\n') + '\n' : null;
}
