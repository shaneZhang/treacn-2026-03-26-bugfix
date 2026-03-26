import { MonitoredAccount, NotificationSettings, MastodonAccount, MastodonCredentials } from '../types';
import {
  getMonitoredAccounts,
  setMonitoredAccounts,
  getNotificationSettings,
  setNotificationSettings,
  getPollInterval,
  setPollInterval,
  getCredentials,
} from '../utils/storage';
import { getAccountInfo } from '../utils/api';

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
let pollInterval = 5;
let currentAccount: MastodonAccount | null = null;
let credentials: MastodonCredentials | null = null;

const statusDiv = document.getElementById('status') as HTMLDivElement;

const loginSection = document.getElementById('login-section') as HTMLElement;
const loginInstanceInput = document.getElementById('login-instance') as HTMLInputElement;
const loginBtn = document.getElementById('login-btn') as HTMLButtonElement;
const logoutBtn = document.getElementById('logout-btn') as HTMLButtonElement;
const userInfoDiv = document.getElementById('user-info') as HTMLDivElement;
const userAvatar = document.getElementById('user-avatar') as HTMLImageElement;
const userName = document.getElementById('user-name') as HTMLSpanElement;
const userInstance = document.getElementById('user-instance') as HTMLSpanElement;

const postSection = document.getElementById('post-section') as HTMLElement;
const postContent = document.getElementById('post-content') as HTMLTextAreaElement;
const postVisibility = document.getElementById('post-visibility') as HTMLSelectElement;
const spoilerText = document.getElementById('spoiler-text') as HTMLInputElement;
const spoilerWrapper = document.getElementById('spoiler-wrapper') as HTMLDivElement;
const cwToggle = document.getElementById('cw-toggle') as HTMLInputElement;
const postBtn = document.getElementById('post-btn') as HTMLButtonElement;
const charCount = document.getElementById('char-count') as HTMLSpanElement;
const MAX_CHARS = 500;

const instanceInput = document.getElementById('mastodon-instance') as HTMLInputElement;
const usernameInput = document.getElementById('mastodon-username') as HTMLInputElement;
const addAccountBtn = document.getElementById('add-account') as HTMLButtonElement;
const monitoredList = document.getElementById('monitored-list') as HTMLDivElement;

const notificationEnabled = document.getElementById('notification-enabled') as HTMLInputElement;
const notificationMethod = document.getElementById('notification-method') as HTMLSelectElement;
const apiSettings = document.getElementById('api-settings') as HTMLElement;
const smtpSettings = document.getElementById('smtp-settings') as HTMLElement;

const apiUrlInput = document.getElementById('api-url') as HTMLInputElement;
const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;

const smtpHostInput = document.getElementById('smtp-host') as HTMLInputElement;
const smtpPortInput = document.getElementById('smtp-port') as HTMLInputElement;
const smtpSecureInput = document.getElementById('smtp-secure') as HTMLInputElement;
const smtpUsernameInput = document.getElementById('smtp-username') as HTMLInputElement;
const smtpPasswordInput = document.getElementById('smtp-password') as HTMLInputElement;
const smtpFromInput = document.getElementById('smtp-from') as HTMLInputElement;
const smtpToInput = document.getElementById('smtp-to') as HTMLInputElement;

const pollIntervalInput = document.getElementById('poll-interval') as HTMLInputElement;
const saveSettingsBtn = document.getElementById('save-settings') as HTMLButtonElement;
const checkNowBtn = document.getElementById('check-now') as HTMLButtonElement;

function showStatus(message: string, isError = false): void {
  statusDiv.textContent = message;
  statusDiv.classList.add('show');
  statusDiv.style.color = isError ? '#dc3545' : '#28a745';

  setTimeout(() => {
    statusDiv.classList.remove('show');
  }, 3000);
}

function updateCharCount(): void {
  const length = postContent.value.length;
  charCount.textContent = `${length}/${MAX_CHARS}`;
  charCount.style.color = length > MAX_CHARS ? '#dc3545' : '#666';
}

function updateLoginUI(): void {
  if (currentAccount && credentials) {
    loginSection.style.display = 'none';
    userInfoDiv.style.display = 'flex';
    userAvatar.src = currentAccount.avatar;
    userName.textContent = currentAccount.display_name || currentAccount.username;
    userInstance.textContent = `@${currentAccount.username}@${credentials.instance}`;
    logoutBtn.style.display = 'inline-block';
    postSection.style.display = 'block';
  } else {
    loginSection.style.display = 'block';
    userInfoDiv.style.display = 'none';
    logoutBtn.style.display = 'none';
    postSection.style.display = 'none';
  }
}

async function loadSettings(): Promise<void> {
  monitoredAccounts = await getMonitoredAccounts();
  notificationSettings = await getNotificationSettings();
  pollInterval = await getPollInterval();
  credentials = await getCredentials();

  renderMonitoredList();
  populateSettings();

  if (credentials) {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getCredentials' });
      if (response.success && response.account) {
        currentAccount = response.account;
      } else {
        credentials = null;
      }
    } catch {
      credentials = null;
    }
  }

  updateLoginUI();
}

function populateSettings(): void {
  instanceInput.value = '';
  usernameInput.value = '';

  notificationEnabled.checked = notificationSettings.enabled;
  notificationMethod.value = notificationSettings.method;

  apiUrlInput.value = notificationSettings.apiUrl || '';
  apiKeyInput.value = notificationSettings.apiKey || '';

  smtpHostInput.value = notificationSettings.smtp?.host || '';
  smtpPortInput.value = String(notificationSettings.smtp?.port || 587);
  smtpSecureInput.checked = notificationSettings.smtp?.secure || false;
  smtpUsernameInput.value = notificationSettings.smtp?.username || '';
  smtpPasswordInput.value = notificationSettings.smtp?.password || '';
  smtpFromInput.value = notificationSettings.smtp?.from || '';
  smtpToInput.value = notificationSettings.smtp?.to || '';

  pollIntervalInput.value = String(pollInterval);

  updateNotificationSettings();
}

function updateNotificationSettings(): void {
  const method = notificationMethod.value;
  apiSettings.style.display = method === 'api' ? 'block' : 'none';
  smtpSettings.style.display = method === 'smtp' ? 'block' : 'none';
}

function renderMonitoredList(): void {
  monitoredList.innerHTML = '';

  if (monitoredAccounts.length === 0) {
    monitoredList.innerHTML = '<p class="empty-message">暂无监控用户</p>';
    return;
  }

  monitoredAccounts.forEach((account, index) => {
    const div = document.createElement('div');
    div.className = 'monitored-item';
    div.innerHTML = `
      <div class="monitored-info">
        <span class="username">@${account.username}@${account.instance}</span>
        <span class="status">${account.enabled ? '✅' : '⏸️'}</span>
      </div>
      <div class="monitored-actions">
        <button class="btn-icon toggle-btn" data-index="${index}" title="${account.enabled ? '暂停' : '启用'}">
          ${account.enabled ? '⏸️' : '▶️'}
        </button>
        <button class="btn-icon delete-btn" data-index="${index}" title="删除">
          🗑️
        </button>
      </div>
    `;
    monitoredList.appendChild(div);
  });

  document.querySelectorAll('.toggle-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const index = parseInt((e.target as HTMLElement).dataset.index!);
      monitoredAccounts[index].enabled = !monitoredAccounts[index].enabled;
      await setMonitoredAccounts(monitoredAccounts);
      renderMonitoredList();
      showStatus('设置已更新');
    });
  });

  document.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const index = parseInt((e.target as HTMLElement).dataset.index!);
      monitoredAccounts.splice(index, 1);
      await setMonitoredAccounts(monitoredAccounts);
      renderMonitoredList();
      showStatus('已删除监控');
    });
  });
}

async function addAccount(): Promise<void> {
  const instance = instanceInput.value.trim();
  const username = usernameInput.value.trim().replace(/^@/, '');

  if (!instance || !username) {
    showStatus('请填写实例和用户名', true);
    return;
  }

  const existing = monitoredAccounts.find((a) => a.instance === instance && a.username === username);

  if (existing) {
    showStatus('该用户已在监控列表中', true);
    return;
  }

  try {
    const accountData = await getAccountInfo(instance, username);

    if (!accountData) {
      throw new Error('User not found');
    }

    monitoredAccounts.push({
      instance,
      username,
      accountId: accountData.id,
      displayName: accountData.display_name || username,
      avatar: accountData.avatar,
      enabled: true,
      lastStatusId: null,
      addedAt: new Date().toISOString(),
    });

    await setMonitoredAccounts(monitoredAccounts);

    instanceInput.value = '';
    usernameInput.value = '';

    renderMonitoredList();
    showStatus('用户已添加');
  } catch (error) {
    showStatus('无法找到用户，请检查实例和用户名', true);
    console.error(error);
  }
}

function saveSettings(): void {
  notificationSettings = {
    enabled: notificationEnabled.checked,
    method: notificationMethod.value as 'browser' | 'api' | 'smtp',
    apiUrl: apiUrlInput.value.trim(),
    apiKey: apiKeyInput.value.trim(),
    smtp: {
      enabled: notificationMethod.value === 'smtp',
      host: smtpHostInput.value.trim(),
      port: parseInt(smtpPortInput.value) || 587,
      secure: smtpSecureInput.checked,
      username: smtpUsernameInput.value.trim(),
      password: smtpPasswordInput.value,
      from: smtpFromInput.value.trim(),
      to: smtpToInput.value.trim(),
    },
  };

  pollInterval = parseInt(pollIntervalInput.value) || 5;

  setNotificationSettings(notificationSettings);
  setPollInterval(pollInterval);

  chrome.alarms.get('feedCheck', (alarm) => {
    if (alarm) {
      chrome.alarms.create('feedCheck', {
        delayInMinutes: pollInterval,
        periodInMinutes: pollInterval,
      });
    }
  });

  showStatus('设置已保存');
}

async function checkNow(): Promise<void> {
  showStatus('正在检查...');

  try {
    await chrome.runtime.sendMessage({ action: 'checkNow' });
    showStatus('检查完成');
  } catch (error) {
    console.error('Check failed:', error);
    showStatus('检查失败: ' + (error instanceof Error ? error.message : 'Unknown error'), true);
  }
}

async function handleLogin(): Promise<void> {
  const instance = loginInstanceInput.value.trim().toLowerCase();

  if (!instance) {
    showStatus('请输入 Mastodon 实例地址', true);
    return;
  }

  let cleanInstance = instance.replace(/^https?:\/\//, '').replace(/\/$/, '');

  loginBtn.disabled = true;
  loginBtn.textContent = '登录中...';

  try {
    const response = await chrome.runtime.sendMessage({ action: 'login', instance: cleanInstance });

    if (response.success) {
      showStatus('登录成功！');
      loginInstanceInput.value = '';
      await loadSettings();
    } else {
      showStatus('登录失败: ' + (response.error || '未知错误'), true);
    }
  } catch (error) {
    showStatus('登录失败: ' + (error instanceof Error ? error.message : 'Unknown error'), true);
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = '登录';
  }
}

async function handleLogout(): Promise<void> {
  logoutBtn.disabled = true;
  logoutBtn.textContent = '退出中...';

  try {
    const response = await chrome.runtime.sendMessage({ action: 'logout' });

    if (response.success) {
      showStatus('已退出登录');
      currentAccount = null;
      credentials = null;
      updateLoginUI();
    } else {
      showStatus('退出失败: ' + (response.error || '未知错误'), true);
    }
  } catch (error) {
    showStatus('退出失败: ' + (error instanceof Error ? error.message : 'Unknown error'), true);
  } finally {
    logoutBtn.disabled = false;
    logoutBtn.textContent = '退出登录';
  }
}

async function handlePost(): Promise<void> {
  const content = postContent.value.trim();

  if (!content) {
    showStatus('请输入要发布的内容', true);
    return;
  }

  if (content.length > MAX_CHARS) {
    showStatus(`内容超过 ${MAX_CHARS} 字符限制`, true);
    return;
  }

  if (!credentials) {
    showStatus('请先登录', true);
    return;
  }

  postBtn.disabled = true;
  postBtn.textContent = '发布中...';

  try {
    const tokenResponse = await chrome.runtime.sendMessage({ action: 'getValidToken' });

    if (!tokenResponse.success || !tokenResponse.token) {
      showStatus('登录已过期，请重新登录', true);
      currentAccount = null;
      credentials = null;
      updateLoginUI();
      return;
    }

    const body: Record<string, unknown> = {
      status: content,
      visibility: postVisibility.value,
    };

    if (cwToggle.checked && spoilerText.value.trim()) {
      body.spoiler_text = spoilerText.value.trim();
      body.sensitive = true;
    }

    const response = await fetch(`https://${credentials.instance}/api/v1/statuses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenResponse.token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    showStatus('发布成功！');
    postContent.value = '';
    spoilerText.value = '';
    cwToggle.checked = false;
    spoilerWrapper.style.display = 'none';
    updateCharCount();
  } catch (error) {
    showStatus('发布失败: ' + (error instanceof Error ? error.message : 'Unknown error'), true);
  } finally {
    postBtn.disabled = false;
    postBtn.textContent = '发布';
  }
}

postContent.addEventListener('input', updateCharCount);

cwToggle.addEventListener('change', () => {
  spoilerWrapper.style.display = cwToggle.checked ? 'block' : 'none';
});

loginBtn.addEventListener('click', handleLogin);
logoutBtn.addEventListener('click', handleLogout);
addAccountBtn.addEventListener('click', addAccount);
saveSettingsBtn.addEventListener('click', saveSettings);
checkNowBtn.addEventListener('click', checkNow);
postBtn.addEventListener('click', handlePost);

notificationMethod.addEventListener('change', updateNotificationSettings);

loginInstanceInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    handleLogin();
  }
});

postContent.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    handlePost();
  }
});

loadSettings();
updateCharCount();
