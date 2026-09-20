/**
 * ============================================================================
 * OFFLINE-FIRST MULTI-PLATFORM ACCOUNTING SYSTEM
 * Service: Google Drive Authorization, Folder Provisioning & QR Pairing
 * Module:  src/services/DriveAuthService.ts
 * ============================================================================
 *
 * ARCHITECTURAL SPECIFICATIONS & SECURITY PRINCIPLES:
 * 1. BYOA (Bring Your Own Account) Scope:
 *    - Uses restricted scope: 'https://www.googleapis.com/auth/drive.file'
 *    - The app only accesses files and folders it creates itself.
 * 2. Token Lifecycle & Auto-Refresh:
 *    - Access tokens expire after 3600s.
 *    - getValidAccessToken() proactively refreshes the access token when
 *      less than 5 minutes (300 seconds) remain before expiration.
 * 3. Dedicated Sync Folder Management:
 *    - Probes Google Drive v3 for an active folder named 'App_Sync_Hub'
 *      (or company-configured name) in the user's root Drive.
 *    - Provisions folder if not found and saves folder_id to app_settings.
 * 4. Master-to-Node Secure Pairing via QR Code:
 *    - Master device generates a compact, time-stamped JSON payload
 *      containing refreshToken, folderId, companyName, and clientId.
 *    - Secondary cashier nodes scan the QR code, apply settings, test
 *      authentication against Google, and confirm Drive read/write permissions.
 */

import { getFirebaseAccessToken } from './FirebaseAuthService';
import { SQLiteDatabase } from './NumberingService';

// ----------------------------------------------------------------------------
// 1. CONSTANTS & API ENDPOINTS
// ----------------------------------------------------------------------------

export const DRIVE_CONFIG = {
  OAUTH_TOKEN_URL: 'https://oauth2.googleapis.com/token',
  DRIVE_V3_FILES_URL: 'https://www.googleapis.com/drive/v3/files',
  DEFAULT_SCOPE: 'https://www.googleapis.com/auth/drive.file',
  DEFAULT_FOLDER_NAME: 'App_Sync_Hub',
  FOLDER_MIME_TYPE: 'application/vnd.google-apps.folder',
  TOKEN_EXPIRATION_BUFFER_MS: 5 * 60 * 1000, // 5 minutes buffer
  PAIRING_PAYLOAD_TTL_MS: 24 * 60 * 60 * 1000, // 24 hours validity
} as const;

export const SETTINGS_KEYS = {
  GOOGLE_CLIENT_ID: 'google_client_id',
  GOOGLE_CLIENT_SECRET: 'google_client_secret',
  GOOGLE_REFRESH_TOKEN: 'google_refresh_token',
  GOOGLE_ACCESS_TOKEN: 'google_access_token',
  GOOGLE_TOKEN_EXPIRES_AT: 'google_token_expires_at',
  GOOGLE_FOLDER_ID: 'google_folder_id',
  COMPANY_NAME: 'company_name',
  DEVICE_ID: 'device_id',
  BRANCH_ID: 'branch_id',
} as const;

// ----------------------------------------------------------------------------
// 2. DATA TYPES & INTERFACES
// ----------------------------------------------------------------------------

export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number; // in seconds
  expiresAt: number; // epoch ms
  tokenType: string;
  scope: string;
}

export interface DriveAuthConfig {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
}

export interface PairingPayload {
  version: 1;
  companyName: string;
  folderId: string;
  refreshToken: string;
  clientId: string;
  issuedAt: string;
  expiresAt: string;
}

export interface DriveFolderMetadata {
  id: string;
  name: string;
  createdTime?: string;
}

export interface PairingResult {
  success: boolean;
  deviceId: string;
  companyName: string;
  folderId: string;
  folderName: string;
  pairedAt: string;
}

// ----------------------------------------------------------------------------
// 3. DOMAIN EXCEPTIONS
// ----------------------------------------------------------------------------

export class DriveAuthException extends Error {
  public readonly code: string;
  constructor(message: string, code: string = 'DRIVE_AUTH_ERROR') {
    super(message);
    this.name = 'DriveAuthException';
    this.code = code;
    Object.setPrototypeOf(this, DriveAuthException.prototype);
  }
}

export class TokenRefreshException extends DriveAuthException {
  constructor(message: string) {
    super(message, 'TOKEN_REFRESH_FAILED');
    this.name = 'TokenRefreshException';
    Object.setPrototypeOf(this, TokenRefreshException.prototype);
  }
}

export class DriveFolderException extends DriveAuthException {
  constructor(message: string) {
    super(message, 'DRIVE_FOLDER_ERROR');
    this.name = 'DriveFolderException';
    Object.setPrototypeOf(this, DriveFolderException.prototype);
  }
}

export class InvalidPairingPayloadException extends DriveAuthException {
  constructor(message: string) {
    super(message, 'INVALID_PAIRING_PAYLOAD');
    this.name = 'InvalidPairingPayloadException';
    Object.setPrototypeOf(this, InvalidPairingPayloadException.prototype);
  }
}

export class PairingExpiredException extends DriveAuthException {
  constructor(message: string) {
    super(message, 'PAIRING_PAYLOAD_EXPIRED');
    this.name = 'PairingExpiredException';
    Object.setPrototypeOf(this, PairingExpiredException.prototype);
  }
}

// ----------------------------------------------------------------------------
// 4. LOW-LEVEL DATABASE & STORAGE HELPERS
// ----------------------------------------------------------------------------

async function queryRows<T = any>(db: SQLiteDatabase, sql: string, params: any[] = []): Promise<T[]> {
  if (typeof db.getAllAsync === 'function') {
    return await db.getAllAsync<T>(sql, ...params);
  }

  if (typeof db.executeSql === 'function') {
    const result = await db.executeSql(sql, params);
    const rowsObj = Array.isArray(result) ? result[0]?.rows : result?.rows;
    if (!rowsObj) return [];

    if (Array.isArray(rowsObj._array)) {
      return rowsObj._array as T[];
    }
    if (typeof rowsObj.raw === 'function') {
      return rowsObj.raw() as T[];
    }
    const output: T[] = [];
    const len = rowsObj.length || 0;
    for (let i = 0; i < len; i++) {
      output.push(rowsObj.item ? rowsObj.item(i) : rowsObj[i]);
    }
    return output;
  }

  throw new Error('Unsupported SQLite Database driver interface.');
}

async function executeStatement(db: SQLiteDatabase, sql: string, params: any[] = []): Promise<any> {
  if (typeof db.runAsync === 'function') {
    return await db.runAsync(sql, ...params);
  }
  if (typeof db.executeSql === 'function') {
    return await db.executeSql(sql, params);
  }
  throw new Error('Unsupported SQLite Database driver interface.');
}

export async function getSetting(db: SQLiteDatabase, key: string): Promise<string | null> {
  const sql = `SELECT value FROM app_settings WHERE key = ? LIMIT 1;`;
  const rows = await queryRows<{ value: string }>(db, sql, [key]);
  return rows[0]?.value?.trim() || null;
}

export async function setSetting(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  const sql = `
    INSERT INTO app_settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value;
  `;
  await executeStatement(db, sql, [key, value]);
}

export async function deleteSetting(db: SQLiteDatabase, key: string): Promise<void> {
  const sql = `DELETE FROM app_settings WHERE key = ?;`;
  await executeStatement(db, sql, [key]);
}

// ----------------------------------------------------------------------------
// 5. DRIVE AUTH & TOKEN LIFECYCLE SERVICE
// ----------------------------------------------------------------------------

export class DriveAuthService {
  /**
   * Exchanges an authorization code obtained from Google OAuth consent
   * for an access_token and refresh_token, persisting both to app_settings.
   *
   * @param db SQLite connection
   * @param authCode Authorization code returned by Google OAuth redirect
   * @param config DriveAuthConfig (clientId, optional clientSecret, redirectUri)
   * @param codeVerifier Optional PKCE code_verifier string
   */
  public static async exchangeAuthCode(
    db: SQLiteDatabase,
    authCode: string,
    config: DriveAuthConfig,
    codeVerifier?: string
  ): Promise<GoogleTokens> {
    const params = new URLSearchParams({
      code: authCode,
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    });

    if (config.clientSecret) {
      params.append('client_secret', config.clientSecret);
    }
    if (codeVerifier) {
      params.append('code_verifier', codeVerifier);
    }

    let response: Response;
    try {
      response = await fetch(DRIVE_CONFIG.OAUTH_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
    } catch (networkErr: any) {
      throw new DriveAuthException(
        `Failed to contact Google OAuth token endpoint: ${networkErr?.message || networkErr}`,
        'NETWORK_TIMEOUT'
      );
    }

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new DriveAuthException(
        `OAuth Token Exchange Failed: ${data.error_description || data.error || response.statusText}`,
        data.error || 'TOKEN_EXCHANGE_FAILED'
      );
    }

    const now = Date.now();
    const expiresIn = Number(data.expires_in) || 3600;
    const expiresAt = now + expiresIn * 1000;

    const tokens: GoogleTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn,
      expiresAt,
      tokenType: data.token_type || 'Bearer',
      scope: data.scope || DRIVE_CONFIG.DEFAULT_SCOPE,
    };

    // Persist configuration & credentials into app_settings
    await setSetting(db, SETTINGS_KEYS.GOOGLE_CLIENT_ID, config.clientId);
    if (config.clientSecret) {
      await setSetting(db, SETTINGS_KEYS.GOOGLE_CLIENT_SECRET, config.clientSecret);
    }
    await setSetting(db, SETTINGS_KEYS.GOOGLE_ACCESS_TOKEN, tokens.accessToken);
    await setSetting(db, SETTINGS_KEYS.GOOGLE_TOKEN_EXPIRES_AT, String(tokens.expiresAt));

    if (tokens.refreshToken) {
      await setSetting(db, SETTINGS_KEYS.GOOGLE_REFRESH_TOKEN, tokens.refreshToken);
    }

    return tokens;
  }

  /**
   * Refreshes the Google access token using the stored refresh token.
   */
  public static async refreshAccessToken(
    db: SQLiteDatabase,
    customClientId?: string,
    customClientSecret?: string
  ): Promise<GoogleTokens> {
    const refreshToken = await getSetting(db, SETTINGS_KEYS.GOOGLE_REFRESH_TOKEN);
    if (!refreshToken) {
      throw new TokenRefreshException(
        'No refresh_token found in app_settings. Device must pair with master or authenticate with Google.'
      );
    }

    const clientId = customClientId || (await getSetting(db, SETTINGS_KEYS.GOOGLE_CLIENT_ID));
    if (!clientId) {
      throw new TokenRefreshException('google_client_id is missing from app_settings.');
    }

    const clientSecret = customClientSecret || (await getSetting(db, SETTINGS_KEYS.GOOGLE_CLIENT_SECRET));

    const params = new URLSearchParams({
      client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    if (clientSecret) {
      params.append('client_secret', clientSecret);
    }

    let response: Response;
    try {
      response = await fetch(DRIVE_CONFIG.OAUTH_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
    } catch (networkErr: any) {
      throw new TokenRefreshException(
        `Failed to reach Google OAuth endpoint during refresh: ${networkErr?.message || networkErr}`
      );
    }

    const data = await response.json();

    if (!response.ok || data.error) {
      // If error is 'invalid_grant', the user revoked Drive access or token expired
      if (data.error === 'invalid_grant') {
        throw new TokenRefreshException(
          'Google authorization has been revoked or expired. Please re-authenticate or re-pair device.'
        );
      }
      throw new TokenRefreshException(
        `Token refresh failed: ${data.error_description || data.error || response.statusText}`
      );
    }

    const now = Date.now();
    const expiresIn = Number(data.expires_in) || 3600;
    const expiresAt = now + expiresIn * 1000;

    const tokens: GoogleTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken, // Google might not return a new refresh token
      expiresIn,
      expiresAt,
      tokenType: data.token_type || 'Bearer',
      scope: data.scope || DRIVE_CONFIG.DEFAULT_SCOPE,
    };

    // Update stored access token and expiration
    await setSetting(db, SETTINGS_KEYS.GOOGLE_ACCESS_TOKEN, tokens.accessToken);
    await setSetting(db, SETTINGS_KEYS.GOOGLE_TOKEN_EXPIRES_AT, String(tokens.expiresAt));

    if (data.refresh_token) {
      await setSetting(db, SETTINGS_KEYS.GOOGLE_REFRESH_TOKEN, data.refresh_token);
    }

    return tokens;
  }

  /**
   * Retrieves a guaranteed valid access token.
   * Checks expiration and proactively triggers refresh if < 5 minutes remain.
   */
  public static async getValidAccessToken(db: SQLiteDatabase): Promise<string> {
    const firebaseToken = await getFirebaseAccessToken();
    if (firebaseToken) {
      return firebaseToken;
    }

    const cachedToken = await getSetting(db, SETTINGS_KEYS.GOOGLE_ACCESS_TOKEN);
    const expiresAtStr = await getSetting(db, SETTINGS_KEYS.GOOGLE_TOKEN_EXPIRES_AT);
    const expiresAt = expiresAtStr ? Number(expiresAtStr) : 0;
    const now = Date.now();

    // Check if token exists and has more than 5 minutes of validity
    if (cachedToken && expiresAt - now > DRIVE_CONFIG.TOKEN_EXPIRATION_BUFFER_MS) {
      return cachedToken;
    }

    // Token is expired or near expiration -> Refresh
    const refreshed = await DriveAuthService.refreshAccessToken(db);
    return refreshed.accessToken;
  }

  // --------------------------------------------------------------------------
  // 6. DEDICATED FOLDER MANAGEMENT
  // --------------------------------------------------------------------------

  /**
   * Ensures the existence of the dedicated Google Drive sync folder.
   * Probes for an active folder named 'App_Sync_Hub' (or custom name) in root.
   * Creates one if not found and saves the folder ID to app_settings.
   *
   * @param db SQLite connection
   * @param accessToken Valid Google Drive access token
   * @param customFolderName Optional custom folder name
   * @returns Folder ID
   */
  public static async ensureSyncFolder(
    db: SQLiteDatabase,
    accessToken: string,
    customFolderName?: string
  ): Promise<string> {
    // 1. Check if folder ID is already persisted locally and still valid on Drive
    const cachedFolderId = await getSetting(db, SETTINGS_KEYS.GOOGLE_FOLDER_ID);
    const companyName = (await getSetting(db, SETTINGS_KEYS.COMPANY_NAME)) || '';
    const targetFolderName =
      customFolderName ||
      (companyName ? `${companyName.replace(/[/\\?%*:|"<>]/g, '_')}_Sync_Hub` : DRIVE_CONFIG.DEFAULT_FOLDER_NAME);

    if (cachedFolderId) {
      const isValid = await DriveAuthService.verifyFolderExists(accessToken, cachedFolderId);
      if (isValid) {
        return cachedFolderId;
      }
    }

    // 2. Query Drive to locate existing active folder by name
    const existingFolder = await DriveAuthService.findFolderByName(accessToken, targetFolderName);
    if (existingFolder) {
      await setSetting(db, SETTINGS_KEYS.GOOGLE_FOLDER_ID, existingFolder.id);
      return existingFolder.id;
    }

    // 3. Create folder if not found
    const createdFolder = await DriveAuthService.createFolder(accessToken, targetFolderName);
    await setSetting(db, SETTINGS_KEYS.GOOGLE_FOLDER_ID, createdFolder.id);
    return createdFolder.id;
  }

  /**
   * Verifies if a specific folder exists and is not trashed.
   */
  public static async verifyFolderExists(accessToken: string, folderId: string): Promise<boolean> {
    const url = `${DRIVE_CONFIG.DRIVE_V3_FILES_URL}/${encodeURIComponent(folderId)}?fields=id,name,trashed,mimeType`;

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) return false;
      const data = await response.json();
      return data && !data.trashed && data.mimeType === DRIVE_CONFIG.FOLDER_MIME_TYPE;
    } catch {
      return false;
    }
  }

  /**
   * Searches for a non-trashed folder by name in the user's Drive root.
   */
  private static async findFolderByName(
    accessToken: string,
    folderName: string
  ): Promise<DriveFolderMetadata | null> {
    // Query files with exact name, mimeType folder, in root, not trashed
    const query = `name = '${folderName.replace(/'/g, "\\'")}' and mimeType = '${DRIVE_CONFIG.FOLDER_MIME_TYPE}' and trashed = false`;
    const url = `${DRIVE_CONFIG.DRIVE_V3_FILES_URL}?q=${encodeURIComponent(query)}&spaces=drive&fields=files(id,name,createdTime)&pageSize=1`;

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });
    } catch (err: any) {
      throw new DriveFolderException(`Failed to search Drive folders: ${err?.message || err}`);
    }

    if (!response.ok) {
      throw new DriveFolderException(`Drive Folder Search API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (data.files && data.files.length > 0) {
      return data.files[0] as DriveFolderMetadata;
    }

    return null;
  }

  /**
   * Creates a dedicated application folder on Google Drive.
   */
  private static async createFolder(
    accessToken: string,
    folderName: string
  ): Promise<DriveFolderMetadata> {
    const metadata = {
      name: folderName,
      mimeType: DRIVE_CONFIG.FOLDER_MIME_TYPE,
      description: 'Dedicated Offline Accounting Batch Synchronization Hub',
    };

    let response: Response;
    try {
      response = await fetch(DRIVE_CONFIG.DRIVE_V3_FILES_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(metadata),
      });
    } catch (err: any) {
      throw new DriveFolderException(`Failed to create sync folder on Google Drive: ${err?.message || err}`);
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new DriveFolderException(
        `Failed to create sync folder: ${errData?.error?.message || response.statusText}`
      );
    }

    const data = await response.json();
    return {
      id: data.id,
      name: data.name,
      createdTime: data.createdTime,
    };
  }

  // --------------------------------------------------------------------------
  // 7. QR CODE DEVICE PAIRING (MASTER -> NODE)
  // --------------------------------------------------------------------------

  /**
   * Master (Desktop/Admin) Device:
   * Generates a secure, compact JSON payload for QR Code rendering.
   * Encodes refreshToken, folderId, companyName, clientId, and timestamp.
   *
   * @param db SQLite connection
   * @returns Formatted JSON string ready to pass into a QR Code generator
   */
  public static async generatePairingPayload(db: SQLiteDatabase): Promise<string> {
    const refreshToken = await getSetting(db, SETTINGS_KEYS.GOOGLE_REFRESH_TOKEN);
    if (!refreshToken) {
      throw new DriveAuthException(
        'Cannot generate pairing payload: Master device has no Google refresh_token configured.'
      );
    }

    const folderId = await getSetting(db, SETTINGS_KEYS.GOOGLE_FOLDER_ID);
    if (!folderId) {
      throw new DriveFolderException(
        'Cannot generate pairing payload: Master device has not initialized google_folder_id.'
      );
    }

    const clientId = await getSetting(db, SETTINGS_KEYS.GOOGLE_CLIENT_ID);
    if (!clientId) {
      throw new DriveAuthException(
        'Cannot generate pairing payload: Master device has no google_client_id configured.'
      );
    }

    const companyName = (await getSetting(db, SETTINGS_KEYS.COMPANY_NAME)) || 'My Company';
    const now = new Date();
    const expiresAt = new Date(now.getTime() + DRIVE_CONFIG.PAIRING_PAYLOAD_TTL_MS);

    const payload: PairingPayload = {
      version: 1,
      companyName,
      folderId,
      refreshToken,
      clientId,
      issuedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    // Serialize to compact JSON (or base64 if needed for high QR density)
    return JSON.stringify(payload);
  }

  /**
   * Secondary (Mobile/Cashier) Node:
   * Decodes and validates the scanned QR Code payload, persists settings,
   * performs live token refresh, and confirms Google Drive folder access.
   *
   * @param db SQLite connection
   * @param scannedJson Raw JSON string decoded from QR scanner camera
   * @param targetDeviceId Assigned terminal device ID (e.g. 'MOB-01', 'POS-02')
   */
  public static async applyPairingPayload(
    db: SQLiteDatabase,
    scannedJson: string,
    targetDeviceId: string
  ): Promise<PairingResult> {
    if (!scannedJson || typeof scannedJson !== 'string') {
      throw new InvalidPairingPayloadException('Scanned QR code is empty or not a valid string.');
    }

    if (!targetDeviceId || !targetDeviceId.trim()) {
      throw new InvalidPairingPayloadException('A valid device_id must be provided for the pairing node.');
    }

    let payload: PairingPayload;
    try {
      payload = JSON.parse(scannedJson);
    } catch {
      throw new InvalidPairingPayloadException('Scanned QR code does not contain valid JSON.');
    }

    // 1. Validate structure
    if (payload.version !== 1) {
      throw new InvalidPairingPayloadException(`Unsupported pairing payload version: ${payload.version}`);
    }

    if (!payload.refreshToken || !payload.folderId || !payload.clientId) {
      throw new InvalidPairingPayloadException(
        'Pairing payload is missing required credentials (refreshToken, folderId, or clientId).'
      );
    }

    // 2. Validate TTL / Expiration
    if (payload.expiresAt) {
      const expirationEpoch = Date.parse(payload.expiresAt);
      if (!isNaN(expirationEpoch) && Date.now() > expirationEpoch) {
        throw new PairingExpiredException(
          `The scanned QR pairing code expired on ${payload.expiresAt}. Please generate a new code from the master terminal.`
        );
      }
    }

    // 3. Persist received credentials and target device ID
    await setSetting(db, SETTINGS_KEYS.GOOGLE_CLIENT_ID, payload.clientId);
    await setSetting(db, SETTINGS_KEYS.GOOGLE_REFRESH_TOKEN, payload.refreshToken);
    await setSetting(db, SETTINGS_KEYS.GOOGLE_FOLDER_ID, payload.folderId);
    await setSetting(db, SETTINGS_KEYS.COMPANY_NAME, payload.companyName || 'My Company');
    await setSetting(db, SETTINGS_KEYS.DEVICE_ID, targetDeviceId.trim().toUpperCase());

    // 4. Live Verification: Obtain a fresh access token from Google
    let freshTokens: GoogleTokens;
    try {
      freshTokens = await DriveAuthService.refreshAccessToken(db, payload.clientId);
    } catch (tokenErr: any) {
      throw new DriveAuthException(
        `Pairing failed during Google token handshake: ${tokenErr?.message || tokenErr}`,
        'PAIRING_HANDSHAKE_FAILED'
      );
    }

    // 5. Live Verification: Confirm folder access on Google Drive
    const isFolderAccessible = await DriveAuthService.verifyFolderExists(
      freshTokens.accessToken,
      payload.folderId
    );

    if (!isFolderAccessible) {
      throw new DriveFolderException(
        `Pairing succeeded but the sync folder (${payload.folderId}) could not be accessed. Ensure the master Google account has not deleted the folder.`
      );
    }

    return {
      success: true,
      deviceId: targetDeviceId.trim().toUpperCase(),
      companyName: payload.companyName || 'My Company',
      folderId: payload.folderId,
      folderName: DRIVE_CONFIG.DEFAULT_FOLDER_NAME,
      pairedAt: new Date().toISOString(),
    };
  }
}

export default DriveAuthService;
