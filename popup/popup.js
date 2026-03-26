document.addEventListener('DOMContentLoaded', async () => {
  const monitoredList = document.getElementById('monitored-list');
  const statusDiv = document.getElementById('status');
  
  const instanceInput = document.getElementById('mastodon-instance');
  const usernameInput = document.getElementById('mastodon-username');
  const addAccountBtn = document.getElementById('add-account');
  
  const notificationEnabled = document.getElementById('notification-enabled');
  const notificationMethod = document.getElementById('notification-method');
  const apiSettings = document.getElementById('api-settings');
  const smtpSettings = document.getElementById('smtp-settings');
  
  const apiUrlInput = document.getElementById('api-url');
  const apiKeyInput = document.getElementById('api-key');
  
  const smtpHostInput = document.getElementById('smtp-host');
  const smtpPortInput = document.getElementById('smtp-port');
  const smtpSecureInput = document.getElementById('smtp-secure');
  const smtpUsernameInput = document.getElementById('smtp-username');
  const smtpPasswordInput = document.getElementById('smtp-password');
  const smtpFromInput = document.getElementById('smtp-from');
  const smtpToInput = document.getElementById('smtp-to');
  
  const pollIntervalInput = document.getElementById('poll-interval');
  const saveSettingsBtn = document.getElementById('save-settings');
  const checkNowBtn = document.getElementById('check-now');
  
  let monitoredAccounts = [];
  let notificationSettings = {
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
      to: ''
    }
  };
  let pollInterval = 5;
  
  async function loadSettings() {
    const stored = await chrome.storage.local.get([
      'monitoredAccounts',
      'notificationSettings',
      'pollInterval'
    ]);
    
    if (stored.monitoredAccounts) {
      monitoredAccounts = stored.monitoredAccounts;
    }
    if (stored.notificationSettings) {
      notificationSettings = stored.notificationSettings;
    }
    if (stored.pollInterval) {
      pollInterval = stored.pollInterval;
    }
    
    renderMonitoredList();
    populateSettings();
  }
  
  function populateSettings() {
    instanceInput.value = '';
    usernameInput.value = '';
    
    notificationEnabled.checked = notificationSettings.enabled;
    notificationMethod.value = notificationSettings.method;
    
    apiUrlInput.value = notificationSettings.apiUrl || '';
    apiKeyInput.value = notificationSettings.apiKey || '';
    
    smtpHostInput.value = notificationSettings.smtp?.host || '';
    smtpPortInput.value = notificationSettings.smtp?.port || 587;
    smtpSecureInput.checked = notificationSettings.smtp?.secure || false;
    smtpUsernameInput.value = notificationSettings.smtp?.username || '';
    smtpPasswordInput.value = notificationSettings.smtp?.password || '';
    smtpFromInput.value = notificationSettings.smtp?.from || '';
    smtpToInput.value = notificationSettings.smtp?.to || '';
    
    pollIntervalInput.value = pollInterval;
    
    updateNotificationSettings();
  }
  
  function updateNotificationSettings() {
    const method = notificationMethod.value;
    apiSettings.style.display = method === 'api' ? 'block' : 'none';
    smtpSettings.style.display = method === 'smtp' ? 'block' : 'none';
  }
  
  function renderMonitoredList() {
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
    
    document.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const index = parseInt(e.target.dataset.index);
        monitoredAccounts[index].enabled = !monitoredAccounts[index].enabled;
        await chrome.storage.local.set({ monitoredAccounts });
        renderMonitoredList();
        showStatus('设置已更新');
      });
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const index = parseInt(e.target.dataset.index);
        monitoredAccounts.splice(index, 1);
        await chrome.storage.local.set({ monitoredAccounts });
        renderMonitoredList();
        showStatus('已删除监控');
      });
    });
  }
  
  async function addAccount() {
    const instance = instanceInput.value.trim();
    const username = usernameInput.value.trim().replace(/^@/, '');
    
    if (!instance || !username) {
      showStatus('请填写实例和用户名');
      return;
    }
    
    const existing = monitoredAccounts.find(
      a => a.instance === instance && a.username === username
    );
    
    if (existing) {
      showStatus('该用户已在监控列表中');
      return;
    }
    
    try {
      const response = await fetch(`https://${instance}/api/v1/accounts/lookup?acct=${encodeURIComponent(username)}`);
      
      if (!response.ok) {
        throw new Error('User not found');
      }
      
      const accountData = await response.json();
      
      monitoredAccounts.push({
        instance,
        username,
        accountId: accountData.id,
        displayName: accountData.display_name || username,
        avatar: accountData.avatar,
        enabled: true,
        lastStatusId: null,
        addedAt: new Date().toISOString()
      });
      
      await chrome.storage.local.set({ monitoredAccounts });
      
      instanceInput.value = '';
      usernameInput.value = '';
      
      renderMonitoredList();
      showStatus('用户已添加');
    } catch (error) {
      showStatus('无法找到用户，请检查实例和用户名');
      console.error(error);
    }
  }
  
  function saveSettings() {
    notificationSettings = {
      enabled: notificationEnabled.checked,
      method: notificationMethod.value,
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
        to: smtpToInput.value.trim()
      }
    };
    
    pollInterval = parseInt(pollIntervalInput.value) || 5;
    
    chrome.storage.local.set({
      notificationSettings,
      pollInterval
    });
    
    chrome.alarms.get('feedCheck', (alarm) => {
      if (alarm) {
        chrome.alarms.create('feedCheck', {
          delayInMinutes: pollInterval,
          periodInMinutes: pollInterval
        });
      }
    });
    
    showStatus('设置已保存');
  }
  
  async function checkNow() {
    showStatus('正在检查...');
    
    try {
      await chrome.runtime.sendMessage({ action: 'checkNow' });
      showStatus('检查完成');
    } catch (error) {
      console.error('Check failed:', error);
      showStatus('检查失败: ' + error.message);
    }
  }
  
  function showStatus(message) {
    statusDiv.textContent = message;
    statusDiv.classList.add('show');
    
    setTimeout(() => {
      statusDiv.classList.remove('show');
    }, 3000);
  }
  
  addAccountBtn.addEventListener('click', addAccount);
  saveSettingsBtn.addEventListener('click', saveSettings);
  checkNowBtn.addEventListener('click', checkNow);
  
  notificationMethod.addEventListener('change', updateNotificationSettings);
  
  loadSettings();
});
