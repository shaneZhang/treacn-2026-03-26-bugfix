import {
  MastodonStatus,
  MastodonAccount,
  PostStatusOptions,
  MastodonMediaAttachment,
} from '../types';

export async function getAccountId(instance: string, username: string): Promise<string | null> {
  const url = `https://${instance}/api/v1/accounts/lookup?acct=${encodeURIComponent(username)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data: MastodonAccount = await response.json();
    return data.id;
  } catch (error) {
    console.error(`Failed to get account ID for @${username}@${instance}:`, error);
    return null;
  }
}

export async function getAccountInfo(
  instance: string,
  username: string
): Promise<MastodonAccount | null> {
  const url = `https://${instance}/api/v1/accounts/lookup?acct=${encodeURIComponent(username)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
  } catch (error) {
    console.error(`Failed to get account info for @${username}@${instance}:`, error);
    return null;
  }
}

export async function fetchUserStatuses(
  instance: string,
  accountId: string,
  sinceId: string | null = null,
  accessToken?: string
): Promise<MastodonStatus[]> {
  let url = `https://${instance}/api/v1/accounts/${accountId}/statuses?limit=20`;
  if (sinceId) {
    url += `&since_id=${sinceId}`;
  }

  const headers: Record<string, string> = {};
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

export async function postStatus(
  instance: string,
  accessToken: string,
  options: PostStatusOptions
): Promise<MastodonStatus> {
  const url = `https://${instance}/api/v1/statuses`;

  const body: Record<string, unknown> = {
    status: options.status,
  };

  if (options.visibility) {
    body.visibility = options.visibility;
  }
  if (options.sensitive !== undefined) {
    body.sensitive = options.sensitive;
  }
  if (options.spoiler_text) {
    body.spoiler_text = options.spoiler_text;
  }
  if (options.media_ids && options.media_ids.length > 0) {
    body.media_ids = options.media_ids;
  }
  if (options.in_reply_to_id) {
    body.in_reply_to_id = options.in_reply_to_id;
  }
  if (options.language) {
    body.language = options.language;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.error) {
        errorMessage = errorJson.error;
      }
    } catch {
      errorMessage = errorText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

export async function uploadMedia(
  instance: string,
  accessToken: string,
  file: File,
  description?: string
): Promise<MastodonMediaAttachment> {
  const url = `https://${instance}/api/v2/media`;

  const formData = new FormData();
  formData.append('file', file);
  if (description) {
    formData.append('description', description);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to upload media: ${errorText}`);
  }

  return response.json();
}

export function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}
