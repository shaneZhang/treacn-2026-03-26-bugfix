import {
  MonitoredAccount,
  NotificationSettings,
  MastodonCredentials,
  OAuthApp,
  StorageData,
} from '../types';

const DEFAULT_POLL_INTERVAL = 5;

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
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

export async function getMonitoredAccounts(): Promise<MonitoredAccount[]> {
  const result = await chrome.storage.local.get('monitoredAccounts');
  return result.monitoredAccounts || [];
}

export async function setMonitoredAccounts(accounts: MonitoredAccount[]): Promise<void> {
  await chrome.storage.local.set({ monitoredAccounts: accounts });
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const result = await chrome.storage.local.get('notificationSettings');
  return result.notificationSettings || DEFAULT_NOTIFICATION_SETTINGS;
}

export async function setNotificationSettings(settings: NotificationSettings): Promise<void> {
  await chrome.storage.local.set({ notificationSettings: settings });
}

export async function getPollInterval(): Promise<number> {
  const result = await chrome.storage.local.get('pollInterval');
  return result.pollInterval || DEFAULT_POLL_INTERVAL;
}

export async function setPollInterval(interval: number): Promise<void> {
  await chrome.storage.local.set({ pollInterval: interval });
}

export async function getCredentials(): Promise<MastodonCredentials | null> {
  const result = await chrome.storage.local.get('credentials');
  return result.credentials || null;
}

export async function setCredentials(credentials: MastodonCredentials | null): Promise<void> {
  await chrome.storage.local.set({ credentials });
}

export async function getOAuthApp(instance: string): Promise<OAuthApp | null> {
  const result = await chrome.storage.local.get('oauthApps');
  const apps: Record<string, OAuthApp> = result.oauthApps || {};
  return apps[instance] || null;
}

export async function setOAuthApp(instance: string, app: OAuthApp): Promise<void> {
  const result = await chrome.storage.local.get('oauthApps');
  const apps: Record<string, OAuthApp> = result.oauthApps || {};
  apps[instance] = app;
  await chrome.storage.local.set({ oauthApps: apps });
}

export async function getAllSettings(): Promise<StorageData> {
  const result = await chrome.storage.local.get([
    'monitoredAccounts',
    'notificationSettings',
    'pollInterval',
    'credentials',
    'oauthApps',
  ]);

  return {
    monitoredAccounts: result.monitoredAccounts || [],
    notificationSettings: result.notificationSettings || DEFAULT_NOTIFICATION_SETTINGS,
    pollInterval: result.pollInterval || DEFAULT_POLL_INTERVAL,
    credentials: result.credentials || null,
    oauthApps: result.oauthApps || {},
  };
}

export async function clearCredentials(): Promise<void> {
  await chrome.storage.local.remove('credentials');
}
