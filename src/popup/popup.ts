import '../styles/popup.css';
import { MonitoredAccount, NotificationSettings, MastodonAccount, MastodonCredentials, MediaFile, CustomEmoji, PollData } from '../types';
import {
  getMonitoredAccounts,
  setMonitoredAccounts,
  getNotificationSettings,
  setNotificationSettings,
  getPollInterval,
  setPollInterval,
  getCredentials,
} from '../utils/storage';
import { getAccountInfo, uploadMedia, getCustomEmojis } from '../utils/api';
import { emojiCategories, EmojiCategory, emojiKeywords } from '../utils/emojiData';

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

const mediaInput = document.getElementById('media-input') as HTMLInputElement;
const mediaPreviewContainer = document.getElementById('media-preview-container') as HTMLDivElement;

let mediaFiles: MediaFile[] = [];
let customEmojis: CustomEmoji[] = [];
let pollData: PollData | null = null;
let currentEmojiCategory = '表情';
let allEmojis: { type: 'standard' | 'custom'; content: string; shortcode?: string }[] = [];

const emojiBtn = document.getElementById('emoji-btn') as HTMLButtonElement;
const pollBtn = document.getElementById('poll-btn') as HTMLButtonElement;
const emojiPicker = document.getElementById('emoji-picker') as HTMLDivElement;
const emojiList = document.getElementById('emoji-list') as HTMLDivElement;
const emojiSearch = document.getElementById('emoji-search') as HTMLInputElement;
let emojiTabsContainer: HTMLElement | null = null;
const pollSection = document.getElementById('poll-section') as HTMLDivElement;
const pollOptionsContainer = document.getElementById('poll-options') as HTMLDivElement;
const addPollOptionBtn = document.getElementById('add-poll-option-btn') as HTMLButtonElement;
const removePollBtn = document.getElementById('remove-poll-btn') as HTMLButtonElement;
const pollExpiresSelect = document.getElementById('poll-expires') as HTMLSelectElement;
const pollMultipleCheckbox = document.getElementById('poll-multiple') as HTMLInputElement;
const pollHideTotalsCheckbox = document.getElementById('poll-hide-totals') as HTMLInputElement;

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

function getMediaType(file: File): 'image' | 'video' | 'audio' {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'image';
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function renderMediaPreviews(): void {
  mediaPreviewContainer.innerHTML = '';
  
  mediaFiles.forEach((media, index) => {
    const item = document.createElement('div');
    item.className = 'media-preview-item';
    
    if (media.status === 'uploading') {
      item.classList.add('media-uploading');
    } else if (media.status === 'error') {
      item.classList.add('media-error');
    }
    
    if (media.type === 'image') {
      const img = document.createElement('img');
      img.src = media.previewUrl;
      img.alt = media.file.name;
      item.appendChild(img);
    } else if (media.type === 'video') {
      const video = document.createElement('video');
      video.src = media.previewUrl;
      video.muted = true;
      item.appendChild(video);
    } else if (media.type === 'audio') {
      const audioDiv = document.createElement('div');
      audioDiv.className = 'audio-preview';
      audioDiv.textContent = '🎵';
      item.appendChild(audioDiv);
    }
    
    const typeBadge = document.createElement('span');
    typeBadge.className = 'media-type-badge';
    typeBadge.textContent = media.type;
    item.appendChild(typeBadge);
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-media-btn';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeMedia(index);
    });
    item.appendChild(removeBtn);
    
    mediaPreviewContainer.appendChild(item);
  });
}

function removeMedia(index: number): void {
  const media = mediaFiles[index];
  if (media.previewUrl && media.previewUrl.startsWith('blob:')) {
    URL.revokeObjectURL(media.previewUrl);
  }
  mediaFiles.splice(index, 1);
  renderMediaPreviews();
}

async function handleMediaSelect(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const files = input.files;
  
  if (!files || files.length === 0) return;
  
  const MAX_MEDIA = 4;
  const remainingSlots = MAX_MEDIA - mediaFiles.filter(m => m.status !== 'error').length;
  
  if (remainingSlots <= 0) {
    showStatus(`最多只能添加 ${MAX_MEDIA} 个媒体文件`, true);
    return;
  }
  
  const filesToAdd = Array.from(files).slice(0, remainingSlots);
  
  for (const file of filesToAdd) {
    const mediaFile: MediaFile = {
      file,
      id: generateId(),
      previewUrl: URL.createObjectURL(file),
      type: getMediaType(file),
      status: 'pending'
    };
    mediaFiles.push(mediaFile);
  }
  
  renderMediaPreviews();
  input.value = '';
}

async function uploadAllMedia(token: string): Promise<string[]> {
  const uploadedIds: string[] = [];
  
  const pendingMedia = mediaFiles.filter(m => m.status === 'pending');
  
  for (const media of pendingMedia) {
    try {
      media.status = 'uploading';
      renderMediaPreviews();
      
      const attachment = await uploadMedia(
        credentials!.instance,
        token,
        media.file
      );
      
      media.status = 'uploaded';
      media.attachmentId = attachment.id;
      uploadedIds.push(attachment.id);
    } catch (error) {
      media.status = 'error';
      media.error = error instanceof Error ? error.message : '上传失败';
      console.error('媒体上传失败:', error);
    }
    
    renderMediaPreviews();
  }
  
  return uploadedIds;
}

function getPollOptions(): string[] {
  const inputs = pollOptionsContainer.querySelectorAll('.poll-option-input') as NodeListOf<HTMLInputElement>;
  const options: string[] = [];
  inputs.forEach(input => {
    const value = input.value.trim();
    if (value) {
      options.push(value);
    }
  });
  return options;
}

function updatePollButtonState(): void {
  const options = getPollOptions();
  pollBtn.classList.toggle('active', pollData !== null && options.length >= 2);
}

function togglePoll(): void {
  if (pollData) {
    pollData = null;
    pollSection.style.display = 'none';
    pollBtn.classList.remove('active');
  } else {
    pollData = {
      options: [],
      expiresIn: 86400,
      multiple: false,
      hideTotals: false
    };
    pollSection.style.display = 'block';
    pollBtn.classList.add('active');
    
    const inputs = pollOptionsContainer.querySelectorAll('.poll-option-input') as NodeListOf<HTMLInputElement>;
    inputs[0].value = '';
    inputs[1].value = '';
  }
}

function addPollOption(): void {
  const optionCount = pollOptionsContainer.querySelectorAll('.poll-option').length;
  if (optionCount >= 10) {
    showStatus('最多只能添加10个选项', true);
    return;
  }
  
  const div = document.createElement('div');
  div.className = 'poll-option';
  div.innerHTML = `<input type="text" class="poll-option-input" placeholder="选项 ${optionCount + 1}">`;
  pollOptionsContainer.appendChild(div);
  
  const newInput = div.querySelector('input') as HTMLInputElement;
  newInput.addEventListener('input', updatePollButtonState);
}

function removePoll(): void {
  pollData = null;
  pollSection.style.display = 'none';
  pollBtn.classList.remove('active');
  
  const inputs = pollOptionsContainer.querySelectorAll('.poll-option-input') as NodeListOf<HTMLInputElement>;
  inputs.forEach(input => input.value = '');
}

function createEmojiTabs(): void {
  if (emojiTabsContainer) return;
  
  emojiTabsContainer = document.createElement('div');
  emojiTabsContainer.className = 'emoji-tabs';
  
  const allCategory: EmojiCategory = {
    name: '常用',
    icon: '⭐',
    emojis: []
  };
  
  const customCategory: EmojiCategory = {
    name: '自定义',
    icon: '🎨',
    emojis: []
  };
  
  const allCategories = [allCategory, ...emojiCategories, customCategory];
  
  allCategories.forEach((category, index) => {
    const tab = document.createElement('button');
    tab.className = 'emoji-tab';
    tab.textContent = category.icon;
    tab.title = category.name;
    tab.dataset.category = category.name;
    
    if (index === 0) {
      tab.classList.add('active');
    }
    
    tab.addEventListener('click', () => {
      document.querySelectorAll('.emoji-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentEmojiCategory = category.name;
      renderEmojiListByCategory(category.name);
    });
    
    emojiTabsContainer!.appendChild(tab);
  });
  
  emojiPicker.insertBefore(emojiTabsContainer, emojiPicker.firstChild);
}

async function loadCustomEmojis(): Promise<void> {
  if (!credentials) return;
  
  try {
    customEmojis = await getCustomEmojis(credentials.instance);
    if (emojiPicker.style.display !== 'none') {
      renderEmojiListByCategory(currentEmojiCategory);
    }
  } catch (error) {
    console.error('加载表情失败:', error);
  }
}

function renderEmojiListByCategory(categoryName: string, searchTerm: string = ''): void {
  emojiList.innerHTML = '';
  
  let emojisToRender: { type: 'standard' | 'custom'; content: string; shortcode?: string }[] = [];
  
  if (searchTerm) {
    emojisToRender = searchAllEmojis(searchTerm);
  } else if (categoryName === '常用') {
    emojisToRender = getFrequentlyUsedEmojis();
  } else if (categoryName === '自定义') {
    emojisToRender = customEmojis.map(e => ({
      type: 'custom' as const,
      content: e.url,
      shortcode: e.shortcode
    }));
  } else {
    const category = emojiCategories.find(cat => cat.name === categoryName);
    if (category) {
      emojisToRender = category.emojis.map(e => ({
        type: 'standard' as const,
        content: e
      }));
    }
  }
  
  if (emojisToRender.length === 0 && searchTerm) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'emoji-empty';
    emptyMessage.textContent = '没有找到匹配的表情';
    emojiList.appendChild(emptyMessage);
    return;
  }
  
  if (!searchTerm && categoryName !== '自定义') {
    const categoryHeader = document.createElement('div');
    categoryHeader.className = 'emoji-category';
    categoryHeader.textContent = categoryName;
    emojiList.appendChild(categoryHeader);
  }
  
  emojisToRender.forEach(emoji => {
    const item = document.createElement('div');
    item.className = 'emoji-item';
    
    if (emoji.type === 'standard') {
      item.textContent = emoji.content;
      item.title = emoji.content;
      item.addEventListener('click', () => insertEmoji(emoji.content));
    } else {
      const img = document.createElement('img');
      img.src = emoji.content;
      img.alt = emoji.shortcode || '';
      img.style.width = '24px';
      img.style.height = '24px';
      img.style.objectFit = 'contain';
      item.appendChild(img);
      item.title = `:${emoji.shortcode}:`;
      item.addEventListener('click', () => insertEmoji(`:${emoji.shortcode}:`));
    }
    
    emojiList.appendChild(item);
  });
}

function searchAllEmojis(keyword: string): { type: 'standard' | 'custom'; content: string; shortcode?: string }[] {
  const results: { type: 'standard' | 'custom'; content: string; shortcode?: string }[] = [];
  const lowerKeyword = keyword.toLowerCase();
  
  emojiCategories.forEach(category => {
    category.emojis.forEach(emoji => {
      const keywords = emojiKeywords[emoji] || [];
      const categoryName = category.name.toLowerCase();
      
      if (emoji === keyword ||
          categoryName.includes(lowerKeyword) ||
          keywords.some(kw => kw.includes(lowerKeyword)) ||
          emoji.includes(lowerKeyword)) {
        if (!results.find(r => r.content === emoji)) {
          results.push({ type: 'standard', content: emoji });
        }
      }
    });
  });
  
  customEmojis.forEach(emoji => {
    if (emoji.shortcode.toLowerCase().includes(lowerKeyword) || 
        (emoji.category && emoji.category.toLowerCase().includes(lowerKeyword))) {
      results.push({ type: 'custom', content: emoji.url, shortcode: emoji.shortcode });
    }
  });
  
  return results;
}

function getFrequentlyUsedEmojis(): { type: 'standard' | 'custom'; content: string; shortcode?: string }[] {
  const frequentEmojis = [
    '😀', '😂', '🥰', '😎', '🤔', '👍', '❤️', '🔥',
    '✨', '🎉', '💯', '🙏', '😊', '😉', '😴', '🤣',
    '😍', '🥳', '😱', '🤗', '💪', '🙌', '👏', '😇'
  ];
  
  return frequentEmojis.map(e => ({ type: 'standard' as const, content: e }));
}

function filterEmojis(searchTerm: string): void {
  renderEmojiListByCategory(currentEmojiCategory, searchTerm);
}

function insertEmoji(emoji: string): void {
  const cursorPos = postContent.selectionStart;
  const text = postContent.value;
  postContent.value = text.slice(0, cursorPos) + emoji + text.slice(cursorPos);
  postContent.focus();
  postContent.selectionStart = postContent.selectionEnd = cursorPos + emoji.length;
  updateCharCount();
}

function toggleEmojiPicker(): void {
  const isHidden = emojiPicker.style.display === 'none';
  emojiPicker.style.display = isHidden ? 'block' : 'none';
  emojiBtn.classList.toggle('active', isHidden);
  
  if (isHidden) {
    createEmojiTabs();
    renderEmojiListByCategory(currentEmojiCategory);
    
    if (customEmojis.length === 0) {
      loadCustomEmojis();
    }
  }
}

function hideEmojiPicker(): void {
  emojiPicker.style.display = 'none';
  emojiBtn.classList.remove('active');
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
  const pollOptions = getPollOptions();
  const hasValidPoll = pollOptions.length >= 2;

  if (!content && mediaFiles.length === 0 && !hasValidPoll) {
    showStatus('请输入要发布的内容、添加媒体或创建投票', true);
    return;
  }

  if (content.length > MAX_CHARS) {
    showStatus(`内容超过 ${MAX_CHARS} 字符限制`, true);
    return;
  }

  if (hasValidPoll && mediaFiles.length > 0) {
    showStatus('投票和媒体不能同时添加', true);
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

    let mediaIds: string[] = [];
    
    if (!hasValidPoll) {
      const pendingMedia = mediaFiles.filter(m => m.status === 'pending');
      if (pendingMedia.length > 0) {
        mediaIds = await uploadAllMedia(tokenResponse.token);
        
        const hasError = mediaFiles.some(m => m.status === 'error');
        if (hasError && mediaIds.length === 0) {
          showStatus('媒体上传失败，请检查后重试', true);
          postBtn.disabled = false;
          postBtn.textContent = '发布';
          return;
        }
      }
      
      const alreadyUploaded = mediaFiles
        .filter(m => m.status === 'uploaded' && m.attachmentId)
        .map(m => m.attachmentId!);
      mediaIds = [...alreadyUploaded, ...mediaIds];
    }

    const body: Record<string, unknown> = {
      status: content,
      visibility: postVisibility.value,
    };

    if (mediaIds.length > 0) {
      body.media_ids = mediaIds;
    }

    const pollOptions = getPollOptions();
    if (pollOptions.length >= 2) {
      body.poll = {
        options: pollOptions,
        expires_in: parseInt(pollExpiresSelect.value),
        multiple: pollMultipleCheckbox.checked,
        hide_totals: pollHideTotalsCheckbox.checked
      };
    }

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
    
    mediaFiles.forEach(m => {
      if (m.previewUrl && m.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(m.previewUrl);
      }
    });
    mediaFiles = [];
    renderMediaPreviews();
    
    removePoll();
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
mediaInput.addEventListener('change', handleMediaSelect);

pollBtn.addEventListener('click', togglePoll);
addPollOptionBtn.addEventListener('click', addPollOption);
removePollBtn.addEventListener('click', removePoll);

emojiBtn.addEventListener('click', toggleEmojiPicker);
emojiSearch.addEventListener('input', (e) => {
  filterEmojis((e.target as HTMLInputElement).value);
});

document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (!emojiPicker.contains(target) && target !== emojiBtn) {
    hideEmojiPicker();
  }
});

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
