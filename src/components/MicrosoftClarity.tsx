'use client';

import Script from 'next/script';

interface MicrosoftClarityProps {
  projectId?: string;
}

/**
 * Identify a user in Microsoft Clarity for session tracking.
 * @param customId Unique user ID or email
 * @param sessionId Optional session identifier
 * @param pageId Optional page identifier
 * @param friendlyName Optional friendly name
 */
export function identifyUser(
  customId: string,
  sessionId?: string,
  pageId?: string,
  friendlyName?: string
) {
  if (typeof window !== 'undefined' && (window as any).clarity) {
    (window as any).clarity('identify', customId, sessionId, pageId, friendlyName);
  }
}

/**
 * Send custom event tag or metadata to Microsoft Clarity.
 * @param key Tag key
 * @param value Tag value
 */
export function setClarityTag(key: string, value: string | string[]) {
  if (typeof window !== 'undefined' && (window as any).clarity) {
    (window as any).clarity('set', key, value);
  }
}

/**
 * Microsoft Clarity tracking component for user journey analytics and heatmaps.
 */
export function MicrosoftClarity({
  projectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID || 'z6984x4whx',
}: MicrosoftClarityProps) {
  if (!projectId) return null;

  return (
    <Script
      id="microsoft-clarity"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "${projectId}");
        `,
      }}
    />
  );
}

export default MicrosoftClarity;
