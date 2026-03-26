import {
  MonitoredAccount,
  NotificationSettings,
  MastodonCredentials,
  OAuthApp,
  MastodonStatus,
} from '../types';
import {
  getMonitoredAccounts,
  setMonitoredAccounts,
  getNotificationSettings,
  getPollInterval,
  getCredentials,
  setCredentials,
  getOAuthApp,
  setOAuthApp,
  clearCredentials,
} from '../utils/storage';
import {
  createOAuthApp,
  getAuthorizationUrl,
  getAccessToken,
  verifyCredentials,
  revokeToken,
  isTokenExpired,
  refreshAccessToken,
} from '../utils/oauth';
import { fetchUserStatuses, stripHtml } from '../utils/api';

let pollInterval = 5;
let monitoredAccounts: MonitoredAccount[] = [];
let notificationSettings: NotificationSettings = {
  enabled: true,
  method: 'browser',
  apiUrl: '',
  apiKey: '',
  smtp: {
    enabled: false,
    host: '',
    port: 587,
    secure: false,
    username: '',
    password: '',
    from: '',
    to: '',
  },
};

async function loadSettings(): Promise<void> {
  monitoredAccounts = await getMonitoredAccounts();
  notificationSettings = await getNotificationSettings();
  pollInterval = await getPollInterval();
}

async function sendBrowserNotification(title: string, body: string, icon?: string): Promise<void> {
  if (!notificationSettings.enabled || notificationSettings.method !== 'browser') {
    return;
  }

  await chrome.notifications.create({
    type: 'basic',
    iconUrl: icon || 'icons/icon.svg',
    title: title,
    message: body,
    priority: 1,
  });
}

async function sendApiNotification(status: MastodonStatus, account: MonitoredAccount): Promise<void> {
  if (!notificationSettings.enabled || notificationSettings.method !== 'api' || !notificationSettings.apiUrl) {
    return;
  }

  try {
    const payload = {
      username: account.username,
      display_name: account.displayName,
      content: stripHtml(status.content),
      url: status.url,
      created_at: status.created_at,
      instance: account.instance,
    };

    await fetch(notificationSettings.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${notificationSettings.apiKey}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error('Failed to send API notification:', error);
  }
}

async function sendSmtpNotification(status: MastodonStatus, account: MonitoredAccount): Promise<void> {
  if (!notificationSettings.enabled || notificationSettings.method !== 'smtp') {
    return;
  }

  const smtp = notificationSettings.smtp;
  if (!smtp.host || !smtp.from || !smtp.to) {
    console.error('SMTP not configured');
    return;
  }

  const emailSubject = `[Mastodon] @${account.username} 发布了新帖子`;
  const emailBody = `
Mastodon 新帖子通知

用户: @${account.username}@${account.instance}
显示名称: ${account.displayName}
发布时间: ${new Date(status.created_at).toLocaleString()}

内容:
${stripHtml(status.content)}

链接: ${status.url}
  `.trim();

  const payload = {
    from: smtp.from,
    to: smtp.to,
    subject: emailSubject,
    text: emailBody,
    smtp: {
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: {
        user: smtp.username,
        pass: smtp.password,
      },
    },
  };

  try {
    const response = await fetch('http://localhost:3000/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log('SMTP email sent:', result);
  } catch (error) {
    console.error('Failed to send SMTP email:', error);
  }
}

async function checkAccount(account: MonitoredAccount): Promise<void> {
  try {
    const credentials = await getCredentials();
    const accessToken = credentials?.instance === account.instance ? credentials.accessToken : undefined;

    const statuses = await fetchUserStatuses(
      account.instance,
      account.accountId,
      account.lastStatusId,
      accessToken || undefined
    );

    if (statuses && statuses.length > 0) {
      const latestStatus = statuses[0];

      if (!account.lastStatusId || latestStatus.id !== account.lastStatusId) {
        account.lastStatusId = latestStatus.id;
        await setMonitoredAccounts(monitoredAccounts);

        const notificationBody =
          stripHtml(latestStatus.content).substring(0, 100) +
          (stripHtml(latestStatus.content).length > 100 ? '...' : '');

        await sendBrowserNotification(
          `@${account.username} 发布了新帖子`,
          notificationBody,
          account.avatar || 'icons/icon.svg'
        );

        await sendApiNotification(latestStatus, account);
        await sendSmtpNotification(latestStatus, account);
      }
    }
  } catch (error) {
    console.error(`Error checking account ${account.username}@${account.instance}:`, error);
  }
}

async function checkAllAccounts(): Promise<void> {
  console.log('Checking all monitored accounts...');

  for (const account of monitoredAccounts) {
    if (account.enabled) {
      await checkAccount(account);
    }
  }
}

async function startPolling(): Promise<void> {
  await loadSettings();

  await chrome.alarms.create('feedCheck', {
    delayInMinutes: pollInterval,
    periodInMinutes: pollInterval,
  });

  checkAllAccounts();
}

async function handleLogin(instance: string): Promise<{ success: boolean; error?: string }> {
  try {
    let oauthApp = await getOAuthApp(instance);

    if (!oauthApp) {
      oauthApp = await createOAuthApp(instance);
      await setOAuthApp(instance, oauthApp);
    }

    const authUrl = getAuthorizationUrl(instance, oauthApp.client_id);

    return new Promise((resolve) => {
      chrome.identity.launchWebAuthFlow(
        {
          url: authUrl,
          interactive: true,
        },
        async (redirectUrl) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message });
            return;
          }

          if (!redirectUrl) {
            resolve({ success: false, error: 'No redirect URL received' });
            return;
          }

          try {
            const url = new URL(redirectUrl);
            const code = url.searchParams.get('code');

            if (!code) {
              resolve({ success: false, error: 'No authorization code received' });
              return;
            }

            const tokenResponse = await getAccessToken(
              instance,
              oauthApp!.client_id,
              oauthApp!.client_secret,
              code
            );

            const accountInfo = await verifyCredentials(instance, tokenResponse.access_token);

            const credentials: MastodonCredentials = {
              instance,
              clientId: oauthApp!.client_id,
              clientSecret: oauthApp!.client_secret,
              accessToken: tokenResponse.access_token,
              refreshToken: tokenResponse.refresh_token || null,
              tokenType: tokenResponse.token_type,
              scope: tokenResponse.scope,
              createdAt: tokenResponse.created_at,
              expiresIn: tokenResponse.expires_in || null,
            };

            await setCredentials(credentials);

            resolve({ success: true });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            resolve({ success: false, error: errorMessage });
          }
        }
      );
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

async function handleLogout(): Promise<{ success: boolean; error?: string }> {
  try {
    const credentials = await getCredentials();

    if (credentials) {
      try {
        await revokeToken(
          credentials.instance,
          credentials.clientId,
          credentials.clientSecret,
          credentials.accessToken!
        );
      } catch (error) {
        console.warn('Failed to revoke token:', error);
      }
    }

    await clearCredentials();
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

async function ensureValidToken(): Promise<string | null> {
  const credentials = await getCredentials();

  if (!credentials || !credentials.accessToken) {
    return null;
  }

  if (isTokenExpired(credentials) && credentials.refreshToken) {
    try {
      const tokenResponse = await refreshAccessToken(
        credentials.instance,
        credentials.clientId,
        credentials.clientSecret,
        credentials.refreshToken
      );

      const updatedCredentials: MastodonCredentials = {
        ...credentials,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token || credentials.refreshToken,
        createdAt: tokenResponse.created_at,
        expiresIn: tokenResponse.expires_in || null,
      };

      await setCredentials(updatedCredentials);
      return updatedCredentials.accessToken;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      await clearCredentials();
      return null;
    }
  }

  return credentials.accessToken;
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'feedCheck') {
    checkAllAccounts();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'checkNow') {
    loadSettings().then(() => {
      checkAllAccounts();
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.action === 'login') {
    handleLogin(message.instance).then(sendResponse);
    return true;
  }

  if (message.action === 'logout') {
    handleLogout().then(sendResponse);
    return true;
  }

  if (message.action === 'getCredentials') {
    getCredentials().then((credentials) => {
      if (credentials) {
        verifyCredentials(credentials.instance, credentials.accessToken!)
          .then((account) => {
            sendResponse({ success: true, credentials, account });
          })
          .catch((error) => {
            sendResponse({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          });
      } else {
        sendResponse({ success: false, error: 'Not logged in' });
      }
    });
    return true;
  }

  if (message.action === 'getValidToken') {
    ensureValidToken().then((token) => {
      sendResponse({ success: !!token, token });
    });
    return true;
  }

  return false;
});

chrome.runtime.onInstalled.addListener(() => {
  startPolling();
});

chrome.runtime.onStartup.addListener(() => {
  startPolling();
});

startPolling();
