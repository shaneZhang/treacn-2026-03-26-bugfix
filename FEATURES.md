# 功能说明文档

## 版本 2.0.0 新增功能

### 1. 登录功能

本插件使用 Mastodon 的 OAuth2 认证流程实现用户登录。

#### 1.1 登录流程

1. 用户在插件界面输入 Mastodon 实例地址（如 `mastodon.social`）
2. 点击「登录」按钮
3. 浏览器会打开 Mastodon 实例的授权页面
4. 用户在授权页面确认授权
5. 授权成功后自动返回插件，显示用户信息

#### 1.2 技术实现

- 使用 `chrome.identity.launchWebAuthFlow` API 进行 OAuth2 授权
- 调用 `POST /api/v1/apps` 创建 OAuth 应用
- 调用 `GET /oauth/authorize` 获取授权码
- 调用 `POST /oauth/token` 获取访问令牌
- 调用 `GET /api/v1/accounts/verify_credentials` 验证用户身份

#### 1.3 权限范围

登录时请求的权限范围（Scopes）：
- `read` - 读取账户信息
- `write` - 发布状态
- `push` - 接收推送通知

### 2. 退出登录功能

#### 2.1 退出流程

1. 点击「退出登录」按钮
2. 插件会调用 Mastodon API 撤销访问令牌
3. 清除本地存储的凭证信息
4. 界面返回未登录状态

#### 2.2 技术实现

- 调用 `POST /oauth/revoke` 撤销令牌
- 使用 `chrome.storage.local.remove` 清除本地凭证

### 3. 发布 Feed 功能

登录后，用户可以通过插件直接发布新的 Feed（嘟文）。

#### 3.1 支持的发布选项

| 选项 | 说明 |
|------|------|
| 内容 | 嘟文正文，最多 500 字符 |
| 可见性 | 公开、不公开列表、仅关注者、私信 |
| 内容警告 (CW) | 可选，添加警告文本 |

#### 3.2 快捷操作

- 按 `Ctrl/Cmd + Enter` 快速发布

#### 3.3 技术实现

- 调用 `POST /api/v1/statuses` 发布嘟文
- 支持以下参数：
  - `status` - 嘟文内容（必填）
  - `visibility` - 可见性
  - `sensitive` - 是否敏感内容
  - `spoiler_text` - 内容警告文本

## 使用说明

### 安装步骤

1. 确保已安装 Node.js 18+
2. 进入项目目录：
   ```bash
   cd mastodon-feed-listener
   ```
3. 安装依赖：
   ```bash
   npm install
   ```
4. 构建项目：
   ```bash
   npm run build
   ```
5. 在 Chrome 浏览器中加载插件：
   - 打开 `chrome://extensions/`
   - 开启「开发者模式」
   - 点击「加载已解压的扩展程序」
   - 选择项目的 `dist` 目录

### 登录使用

1. 点击浏览器工具栏中的插件图标
2. 在「登录 Mastodon」区域输入实例地址
   - 例如：`mastodon.social`、`fosstodon.org`
   - 不需要输入 `https://` 前缀
3. 点击「登录」按钮
4. 在弹出的授权页面中确认授权
5. 授权成功后返回插件，显示用户头像和信息

### 发布 Feed

1. 登录后，在「发布新 Feed」区域输入内容
2. 选择可见性（默认为公开）
3. 如需添加内容警告：
   - 勾选「添加内容警告 (CW)」
   - 输入警告文本
4. 点击「发布」按钮或按 `Ctrl/Cmd + Enter`

### 退出登录

1. 点击用户信息下方的「退出登录」按钮
2. 确认退出后，登录状态将被清除

## API 参考

### OAuth2 相关接口

#### 创建应用
```
POST /api/v1/apps
```

请求体：
```json
{
  "client_name": "Mastodon Feed Listener",
  "redirect_uris": "<extension_id>.chromiumapp.org/",
  "scopes": "read write push"
}
```

#### 获取授权 URL
```
GET /oauth/authorize?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&scope=read%20write%20push
```

#### 获取访问令牌
```
POST /oauth/token
```

请求体：
```json
{
  "client_id": "<client_id>",
  "client_secret": "<client_secret>",
  "redirect_uri": "<redirect_uri>",
  "grant_type": "authorization_code",
  "code": "<authorization_code>",
  "scope": "read write push"
}
```

#### 撤销令牌
```
POST /oauth/revoke
```

请求体：
```json
{
  "client_id": "<client_id>",
  "client_secret": "<client_secret>",
  "token": "<access_token>"
}
```

### 状态发布接口

#### 发布嘟文
```
POST /api/v1/statuses
```

请求头：
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

请求体：
```json
{
  "status": "嘟文内容",
  "visibility": "public",
  "sensitive": false,
  "spoiler_text": "内容警告（可选）"
}
```

## 数据存储

插件使用 `chrome.storage.local` 存储以下数据：

| 键名 | 类型 | 说明 |
|------|------|------|
| `credentials` | Object | OAuth2 凭证信息 |
| `oauthApps` | Object | 各实例的 OAuth 应用信息 |
| `monitoredAccounts` | Array | 监控账户列表 |
| `notificationSettings` | Object | 通知设置 |
| `pollInterval` | Number | 轮询间隔（分钟） |

## 注意事项

1. **令牌过期**：部分 Mastodon 实例的访问令牌可能会过期，插件会自动尝试刷新令牌
2. **实例兼容性**：理论上支持所有 Mastodon 实例，但部分实例可能有特殊限制
3. **隐私安全**：访问令牌存储在浏览器本地，不会上传到任何服务器
4. **字符限制**：大多数 Mastodon 实例的嘟文字符限制为 500 字符，部分实例可能有不同限制

## 开发命令

```bash
# 安装依赖
npm install

# 开发模式（监听文件变化）
npm run dev

# 生产构建
npm run build

# 类型检查
npm run typecheck
```

## 故障排除

### 登录失败

1. 检查实例地址是否正确
2. 确保实例支持 OAuth2 认证
3. 检查浏览器是否阻止了弹窗

### 发布失败

1. 确保已成功登录
2. 检查令牌是否过期（尝试重新登录）
3. 确认内容未超过字符限制

### 令牌过期

如果提示令牌过期：
1. 点击「退出登录」
2. 重新登录获取新令牌
