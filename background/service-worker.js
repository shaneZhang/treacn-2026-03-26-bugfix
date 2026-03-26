const DEFAULT_POLL_INTERVAL = 5;

let pollInterval = DEFAULT_POLL_INTERVAL;
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
}

async function saveSettings() {
  await chrome.storage.local.set({
    monitoredAccounts,
    notificationSettings,
    pollInterval
  });
}

async function getAccountId(instance, username) {
  const url = `https://${instance}/api/v1/accounts/lookup?acct=${encodeURIComponent(username)}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return data.id;
  } catch (error) {
    console.error(`Failed to get account ID for @${username}@${instance}:`, error);
    return null;
  }
}

async function fetchUserStatuses(instance, accountId, sinceId = null) {
  let url = `https://${instance}/api/v1/accounts/${accountId}/statuses?limit=20`;
  if (sinceId) {
    url += `&since_id=${sinceId}`;
  }
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function sendBrowserNotification(title, body, icon) {
  if (!notificationSettings.enabled || notificationSettings.method !== 'browser') {
    return;
  }
  
  await chrome.notifications.create({
    type: 'basic',
    iconUrl: icon || 'icons/icon.svg',
    title: title,
    message: body,
    priority: 1
  });
}

async function sendApiNotification(status, account) {
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
      instance: account.instance
    };
    
    await fetch(notificationSettings.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${notificationSettings.apiKey}`
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error('Failed to send API notification:', error);
  }
}

async function sendSmtpNotification(status, account) {
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
        pass: smtp.password
      }
    }
  };
  
  try {
    const response = await fetch('http://localhost:3000/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
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

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
}

async function checkAccount(account) {
  try {
    const accountId = account.accountId || await getAccountId(account.instance, account.username);
    
    if (!accountId) {
      console.error(`Could not resolve account ID for ${account.username}@${account.instance}`);
      return;
    }
    
    if (!account.accountId || account.accountId !== accountId) {
      account.accountId = accountId;
      await saveSettings();
    }
    
    const statuses = await fetchUserStatuses(account.instance, accountId, account.lastStatusId);
    
    if (statuses && statuses.length > 0) {
      const latestStatus = statuses[0];
      
      if (!account.lastStatusId || latestStatus.id !== account.lastStatusId) {
        account.lastStatusId = latestStatus.id;
        await saveSettings();
        
        const notificationBody = stripHtml(latestStatus.content).substring(0, 100) + 
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

async function checkAllAccounts() {
  console.log('Checking all monitored accounts...');
  
  for (const account of monitoredAccounts) {
    if (account.enabled) {
      await checkAccount(account);
    }
  }
}

async function startPolling() {
  await loadSettings();
  
  await chrome.alarms.create('feedCheck', {
    delayInMinutes: pollInterval,
    periodInMinutes: pollInterval
  });
  
  checkAllAccounts();
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'feedCheck') {
    checkAllAccounts();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'checkNow') {
    loadSettings().then(() => {
      checkAllAccounts();
    });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  startPolling();
});

chrome.runtime.onStartup.addListener(() => {
  startPolling();
});

startPolling();
