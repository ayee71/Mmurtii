/**
 * Courtroom Kiosk Invitation & Real Email Client Dispatch Utility
 */

export interface EmailNotificationResponse {
  success: boolean;
  message: string;
  email: string;
  documentId: string;
  status: string;
  timestamp: string;
}

/**
 * Generates a pre-formatted message for social media/SMS/email sharing.
 */
export function generateTrilingualInvitation(
  link: string,
  institutionName: string,
  accessCode: string
): string {
  return `SEERAAI PRO - Courtroom Session Invitation / Affeerraa / ጥሪ
  
  Institution: ${institutionName}
  Access Link: ${link}
  Access Code: ${accessCode}
  
  [Oromoo] Linkii kana banuun walgahii dhaddachaatti makamaa.
  [Amharic] ይህን ሊንክ በመጫን ወደ ፍርድ ቤት ስብሰባ ይግቡ።
  [English] Please open this link to join the courtroom session.`;
}

export function generateShareableLinkMessage(link: string, institutionName: string): string {
  return `SEERAAI PRO - Legal Kiosk Access
  
  Institution: ${institutionName}
  Access Link: ${link}
  
  Please open this link in your browser to connect to the courtroom session.`;
}

export function buildKioskMailtoUrl(
  email: string,
  link: string,
  recipientName: string,
  accessCode: string = ''
): string {
  const subject = `Courtroom Kiosk Access - ${recipientName}`;
  const body = accessCode
    ? generateTrilingualInvitation(link, recipientName, accessCode)
    : generateShareableLinkMessage(link, recipientName);
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Opens the user's real email client with the prefilled kiosk invitation (no fake background delivery).
 */
export async function sendKioskLinkEmail(
  email: string,
  link: string,
  recipientName: string
): Promise<EmailNotificationResponse> {
  if (!email || !email.includes('@')) {
    throw new Error('Maaloo teessoo imeelii sirrii galchaa / Please enter a valid email address.');
  }

  const mailtoUrl = buildKioskMailtoUrl(email, link, recipientName);
  if (typeof document !== 'undefined') {
    const anchor = document.createElement('a');
    anchor.href = mailtoUrl;
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }

  return {
    success: true,
    message: `Email draft opened for ${email}. Complete sending in your email app.`,
    email,
    documentId: 'kiosk-link',
    status: 'draft_opened',
    timestamp: new Date().toISOString(),
  };
}
