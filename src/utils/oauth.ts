import { MastodonCredentials, OAuthApp, TokenResponse, MastodonAccount } from '../types';

const REDIRECT_URI = chrome.identity.getRedirectURL();
const SCOPES = 'read write push';

export async function createOAuthApp(instance: string): Promise<OAuthApp> {
  const url = `https://${instance}/api/v1/apps`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_name: 'Mastodon Feed Listener',
      redirect_uris: REDIRECT_URI,
      scopes: SCOPES,
      website: '',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create OAuth app: ${errorText}`);
  }

  const app: OAuthApp = await response.json();
  return app;
}

export function getAuthorizationUrl(instance: string, clientId: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
  });

  return `https://${instance}/oauth/authorize?${params.toString()}`;
}

export async function getAccessToken(
  instance: string,
  clientId: string,
  clientSecret: string,
  code: string
): Promise<TokenResponse> {
  const url = `https://${instance}/oauth/token`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
      code,
      scope: SCOPES,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get access token: ${errorText}`);
  }

  return response.json();
}

export async function refreshAccessToken(
  instance: string,
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<TokenResponse> {
  const url = `https://${instance}/oauth/token`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: SCOPES,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh access token: ${errorText}`);
  }

  return response.json();
}

export async function verifyCredentials(
  instance: string,
  accessToken: string
): Promise<MastodonAccount> {
  const url = `https://${instance}/api/v1/accounts/verify_credentials`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to verify credentials: ${errorText}`);
  }

  return response.json();
}

export async function revokeToken(
  instance: string,
  clientId: string,
  clientSecret: string,
  token: string
): Promise<void> {
  const url = `https://${instance}/oauth/revoke`;

  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      token,
    }),
  });
}

export function isTokenExpired(credentials: MastodonCredentials): boolean {
  if (!credentials.expiresIn) {
    return false;
  }

  const expiresAt = credentials.createdAt + credentials.expiresIn;
  const now = Math.floor(Date.now() / 1000);
  return now >= expiresAt - 60;
}
