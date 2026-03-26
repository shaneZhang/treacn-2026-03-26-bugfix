export interface MonitoredAccount {
  instance: string;
  username: string;
  accountId: string;
  displayName: string;
  avatar: string;
  enabled: boolean;
  lastStatusId: string | null;
  addedAt: string;
}

export interface SmtpSettings {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  from: string;
  to: string;
}

export interface NotificationSettings {
  enabled: boolean;
  method: 'browser' | 'api' | 'smtp';
  apiUrl: string;
  apiKey: string;
  smtp: SmtpSettings;
}

export interface MastodonCredentials {
  instance: string;
  clientId: string;
  clientSecret: string;
  accessToken: string | null;
  refreshToken: string | null;
  tokenType: string;
  scope: string;
  createdAt: number;
  expiresIn: number | null;
}

export interface MastodonAccount {
  id: string;
  username: string;
  display_name: string;
  avatar: string;
  url: string;
  note: string;
  followers_count: number;
  following_count: number;
  statuses_count: number;
}

export interface MastodonStatus {
  id: string;
  created_at: string;
  content: string;
  url: string;
  account: MastodonAccount;
  visibility: 'public' | 'unlisted' | 'private' | 'direct';
  sensitive: boolean;
  spoiler_text: string;
  media_attachments: MastodonMediaAttachment[];
  reblog: MastodonStatus | null;
  favourites_count: number;
  reblogs_count: number;
  replies_count: number;
}

export interface MastodonMediaAttachment {
  id: string;
  type: 'image' | 'video' | 'gifv' | 'audio' | 'unknown';
  url: string;
  preview_url: string;
  description: string | null;
}

export interface PostStatusOptions {
  status: string;
  visibility?: 'public' | 'unlisted' | 'private' | 'direct';
  sensitive?: boolean;
  spoiler_text?: string;
  media_ids?: string[];
  in_reply_to_id?: string;
  language?: string;
}

export interface OAuthApp {
  id: string;
  name: string;
  website: string | null;
  redirect_uri: string;
  client_id: string;
  client_secret: string;
  vapid_key: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  created_at: number;
  expires_in?: number;
  refresh_token?: string;
}

export interface StorageData {
  monitoredAccounts: MonitoredAccount[];
  notificationSettings: NotificationSettings;
  pollInterval: number;
  credentials: MastodonCredentials | null;
  oauthApps: Record<string, OAuthApp>;
}

export interface MediaFile {
  file: File;
  id: string;
  previewUrl: string;
  type: 'image' | 'video' | 'audio';
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  attachmentId?: string;
  error?: string;
}

export interface PollOption {
  id: string;
  text: string;
}

export interface PollData {
  options: PollOption[];
  expiresIn: number;
  multiple: boolean;
  hideTotals: boolean;
}

export interface CustomEmoji {
  shortcode: string;
  url: string;
  static_url: string;
  visible_in_picker: boolean;
  category?: string;
}
