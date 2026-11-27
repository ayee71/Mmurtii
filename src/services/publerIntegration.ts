/**
 * Publer Integration Service Layer for SeeraAI
 * Securely publishes synthesized legal documents, summaries, and proclamations
 * to the Publer API (https://publer.com) with proper authentication headers and payload formatting.
 */

export interface PublerPublishOptions {
  content: string;
  title?: string;
  accounts?: string[]; // Social account IDs (Facebook, Telegram, LinkedIn, X, etc.)
  scheduledTime?: string; // ISO string for scheduled posting or leave empty for immediate
  postType?: 'text' | 'article' | 'announcement';
}

export interface PublerPublishResult {
  success: boolean;
  postId?: string;
  scheduledTime?: string;
  message: string;
}

const PUBLER_API_BASE = 'https://api.publer.io/v1';

export function getPublerCredentials() {
  try {
    const apiKey = localStorage.getItem('seera_publer_api_key') || '';
    const workspaceId = localStorage.getItem('seera_publer_workspace_id') || '';
    const isConnected = Boolean(localStorage.getItem('seera_publer_connected') && apiKey);
    return { apiKey, workspaceId, isConnected };
  } catch {
    return { apiKey: '', workspaceId: '', isConnected: false };
  }
}

/**
 * Publishes synthesized legal documents or summaries to the Publer API.
 */
export async function publishToPubler(options: PublerPublishOptions): Promise<PublerPublishResult> {
  const { apiKey, workspaceId, isConnected } = getPublerCredentials();

  if (!isConnected || !apiKey) {
    throw new Error('Publer API is not connected. Please configure your Publer API Key in settings or integration menu.');
  }

  const payload = {
    text: options.title ? `📜 ${options.title}\n\n${options.content}` : options.content,
    workspace_id: workspaceId || undefined,
    accounts: options.accounts && options.accounts.length > 0 ? options.accounts : ['default'],
    media_urls: [],
    scheduled_at: options.scheduledTime || null,
    metadata: {
      platform: 'SeeraAI - Trilingual Ethiopian Legal Platform',
      source: 'www.saiethio.com',
      timestamp: new Date().toISOString()
    }
  };

  const response = await fetch(`${PUBLER_API_BASE}/posts/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...(workspaceId ? { 'X-Workspace-ID': workspaceId } : {})
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => `HTTP ${response.status}`);
    throw new Error(`Publer API request failed (${response.status}): ${errText}`);
  }

  const data = await response.json();

  return {
    success: true,
    postId: data.post_id || data.id,
    scheduledTime: options.scheduledTime || new Date().toISOString(),
    message: 'Legal document/summary successfully dispatched to Publer API for cross-platform publishing.'
  };
}

/**
 * Fetches connected social accounts from Publer API workspace.
 */
export async function fetchPublerAccounts(): Promise<Array<{ id: string; name: string; type: string }>> {
  const { apiKey, workspaceId, isConnected } = getPublerCredentials();
  if (!isConnected || !apiKey) return [];

  const response = await fetch(`${PUBLER_API_BASE}/accounts${workspaceId ? `?workspace_id=${workspaceId}` : ''}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      ...(workspaceId ? { 'X-Workspace-ID': workspaceId } : {})
    }
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => `HTTP ${response.status}`);
    throw new Error(`Failed to fetch Publer accounts (${response.status}): ${errText}`);
  }
  const data = await response.json();
  return Array.isArray(data.accounts) ? data.accounts : [];
}
