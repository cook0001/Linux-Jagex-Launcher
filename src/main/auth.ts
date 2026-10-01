import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { BrowserWindow, session, shell } from 'electron';
import { store, JagexAccountSession, JagexCharacter, SessionData } from './store';
import { checkMembershipStatus, CLEAN_USER_AGENT } from './membership';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLIENT_ID = 'com_jagex_auth_desktop_launcher';
const CONSENT_CLIENT_ID = '1fddee4e-b100-4f4e-b2b0-097f9088f9d2';
const REDIRECT_URI = 'https://secure.runescape.com/m=weblogin/launcher-redirect';
const CONSENT_REDIRECT_URI = 'http://localhost';
const SCOPES = 'openid offline gamesso.token.create user.profile.read user.entitlement.read user.game.read user.sku.read user.voucher.redeem';

const AUTH_ORIGIN = 'https://account.jagex.com';
const GAME_AUTH_ORIGIN = 'https://auth.jagex.com';

function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function generateRandomString(length: number): string {
  return base64UrlEncode(crypto.randomBytes(length)).substring(0, length);
}

function parseJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('[Auth] Failed to parse JWT payload:', e);
    return null;
  }
}

export class JagexAuthManager {
  private activeLoginWindow: BrowserWindow | null = null;
  private pendingBrowserFlow: {
    codeVerifier: string;
    state1: string;
    state2: string;
    nonce: string;
  } | null = null;

  /**
   * Starts the authentic in-launcher Jagex Account sign-in window.
   * Uses a two-stage OAuth handshake:
   *  1. com_jagex_auth_desktop_launcher signs in and obtains the authorization code.
   *  2. Intercepts redirect before secure.runescape.com executes Turnstile.
   *  3. Initiates consent with client 1fddee4e-b100-4f4e-b2b0-097f9088f9d2 to obtain the game session ID token.
   *  4. Intercepts http://localhost/#id_token=... and creates the game session.
   */
  public async startLoginFlow(parent?: BrowserWindow): Promise<JagexAccountSession> {
    if (this.activeLoginWindow && !this.activeLoginWindow.isDestroyed()) {
      this.activeLoginWindow.focus();
      throw new Error('Login window is already open');
    }

    const codeVerifier = generateRandomString(64);
    const hash = crypto.createHash('sha256').update(codeVerifier).digest();
    const codeChallenge = base64UrlEncode(hash);

    const state1 = generateRandomString(32);
    const state2 = generateRandomString(32);
    const nonce = generateRandomString(32);

    const authUrl = `${AUTH_ORIGIN}/oauth2/auth?` + new URLSearchParams({
      auth_method: '',
      login_type: '',
      flow: 'launcher',
      response_type: 'code',
      client_id: CLIENT_ID,
      code_challenge_method: 'S256',
      prompt: 'login',
      scope: SCOPES,
      redirect_uri: REDIRECT_URI,
      code_challenge: codeChallenge,
      state: state1,
    }).toString();

    // Use a persistent partition so cookies and Cloudflare clearance persist
    const authSession = session.fromPartition('persist:jagex-auth', { cache: true });
    authSession.setUserAgent(CLEAN_USER_AGENT);

    // Sanitize headers to remove any Electron traces that Cloudflare Turnstile blocks
    authSession.webRequest.onBeforeSendHeaders((details, callback) => {
      const headers = { ...details.requestHeaders };
      headers['User-Agent'] = CLEAN_USER_AGENT;
      delete headers['X-Requested-With'];
      callback({ requestHeaders: headers });
    });

    return new Promise((resolve, reject) => {
      const loginWin = new BrowserWindow({
        width: 500,
        height: 740,
        parent: parent || undefined,
        modal: false,
        title: 'Sign In to Jagex Account',
        autoHideMenuBar: true,
        backgroundColor: '#0d1117',
        webPreferences: {
          session: authSession,
          preload: path.join(__dirname, '../preload/login-preload.js'),
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: false,
        }
      });

      this.activeLoginWindow = loginWin;

      let isCompleted = false;
      let codeHandled = false;
      let consentHandled = false;
      let tokensCache: { id_token: string; access_token: string; refresh_token: string } | null = null;

      const finish = (err: Error | null, sessionData?: JagexAccountSession) => {
        if (isCompleted) return;
        isCompleted = true;
        this.activeLoginWindow = null;
        if (!loginWin.isDestroyed()) {
          loginWin.close();
        }
        if (err) reject(err);
        else if (sessionData) resolve(sessionData);
        else reject(new Error('Unknown authentication error'));
      };

      loginWin.on('closed', () => {
        if (!isCompleted) {
          finish(new Error('Login window was closed by the user'));
        }
      });

      // Step 2: Handle authorization code and navigate to consent URL
      const handleCodeRedirect = async (urlStr: string) => {
        if (codeHandled || isCompleted) return;
        codeHandled = true;

        try {
          const parsed = new URL(urlStr);
          const code = parsed.searchParams.get('code');
          const state = parsed.searchParams.get('state');

          if (!code || state !== state1) {
            return finish(new Error('Invalid authorization code or state mismatch'));
          }

          console.log('[Auth] Intercepted authorization code. Exchanging for tokens...');
          tokensCache = await this.exchangeCodeForTokens(code, codeVerifier);
          console.log('[Auth] Token exchange successful! Requesting consent token for game session...');

          // Navigate login window to consent URL with id_token_hint
          const consentUrl = `${AUTH_ORIGIN}/oauth2/auth?` + new URLSearchParams({
            prompt: 'consent',
            redirect_uri: CONSENT_REDIRECT_URI,
            response_type: 'id_token code',
            client_id: CONSENT_CLIENT_ID,
            scope: 'openid offline',
            id_token_hint: tokensCache!.id_token,
            state: state2,
            nonce: nonce,
          }).toString();

          if (!loginWin.isDestroyed()) {
            loginWin.loadURL(consentUrl);
          }
        } catch (e: any) {
          console.error('[Auth] Error handling code redirect:', e);
          finish(e);
        }
      };

      // Step 3 & 4: Intercept localhost redirect from consent step and create game session
      const handleConsentRedirect = async (urlStr: string) => {
        if (consentHandled || isCompleted) return;
        consentHandled = true;

        try {
          console.log('[Auth] Intercepted consent redirect. Parsing id_token...');
          const hashIdx = urlStr.indexOf('#');
          const qIdx = urlStr.indexOf('?');
          const fragmentOrQuery = hashIdx !== -1 ? urlStr.substring(hashIdx + 1) : (qIdx !== -1 ? urlStr.substring(qIdx + 1) : '');
          const params = new URLSearchParams(fragmentOrQuery);

          const consentIdToken = params.get('id_token') || params.get('idToken');
          const returnedState = params.get('state');

          if (!consentIdToken) {
            console.error('[Auth] No id_token found in consent redirect URL:', urlStr);
            return finish(new Error('Consent redirect did not contain an ID token'));
          }

          if (returnedState && returnedState !== state2) {
            console.warn('[Auth] State mismatch in consent redirect');
          }

          console.log('[Auth] Successfully extracted consent ID token! Creating game session...');
          const sessionId = await this.createGameSession(consentIdToken);
          console.log('[Auth] Game session created successfully! Session ID:', sessionId.substring(0, 10) + '...');

          const characters = await this.fetchCharacters(sessionId);
          console.log(`[Auth] Fetched ${characters.length} characters.`);

          const sessionData = await this.finalizeLogin(
            consentIdToken,
            tokensCache ? tokensCache.refresh_token : '',
            sessionId,
            characters
          );
          finish(null, sessionData);
        } catch (err: any) {
          console.error('[Auth] Error handling consent redirect:', err);
          finish(err);
        }
      };

      // 1. Intercept redirect to secure.runescape.com BEFORE Chromium makes the request!
      // This stops Chromium from ever loading secure.runescape.com, completely bypassing Cloudflare Turnstile on that page.
      authSession.webRequest.onBeforeRequest({ urls: ['https://secure.runescape.com/m=weblogin/launcher-redirect*'] }, (details, callback) => {
        callback({ cancel: true });
        handleCodeRedirect(details.url);
      });

      // 2. Intercept redirect to http://localhost BEFORE Chromium attempts to connect to port 80!
      authSession.webRequest.onBeforeRequest({ urls: ['http://localhost/*', 'http://127.0.0.1/*'] }, (details, callback) => {
        callback({ cancel: true });
        handleConsentRedirect(details.url);
      });

      // 3. Inspect Location header in 302 responses from account.jagex.com
      authSession.webRequest.onHeadersReceived({ urls: ['https://account.jagex.com/*'] }, (details, callback) => {
        const loc = details.responseHeaders?.Location?.[0] || details.responseHeaders?.location?.[0];
        if (loc && (loc.startsWith('http://localhost') || loc.startsWith('http://127.0.0.1'))) {
          handleConsentRedirect(loc);
        }
        callback({});
      });

      // 4. Inspect onBeforeRedirect
      authSession.webRequest.onBeforeRedirect({ urls: ['https://account.jagex.com/*'] }, (details) => {
        if (details.redirectURL && (details.redirectURL.startsWith('http://localhost') || details.redirectURL.startsWith('http://127.0.0.1'))) {
          handleConsentRedirect(details.redirectURL);
        }
      });

      // 5. Intercept in webContents navigation events
      loginWin.webContents.on('will-redirect', (event, url) => {
        if (url.startsWith(REDIRECT_URI)) {
          event.preventDefault();
          handleCodeRedirect(url);
        } else if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
          event.preventDefault();
          handleConsentRedirect(url);
        }
      });

      loginWin.webContents.on('will-navigate', (event, url) => {
        if (url.startsWith(REDIRECT_URI)) {
          event.preventDefault();
          handleCodeRedirect(url);
        } else if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
          event.preventDefault();
          handleConsentRedirect(url);
        }
      });

      loginWin.loadURL(authUrl);
    });
  }

  /**
   * Fallback: Opens the authentication flow in the user's primary desktop browser (Chrome/Firefox).
   */
  public async startBrowserLogin(): Promise<string> {
    const codeVerifier = generateRandomString(64);
    const hash = crypto.createHash('sha256').update(codeVerifier).digest();
    const codeChallenge = base64UrlEncode(hash);

    const state1 = generateRandomString(32);
    const state2 = generateRandomString(32);
    const nonce = generateRandomString(32);

    this.pendingBrowserFlow = { codeVerifier, state1, state2, nonce };

    const authUrl = `${AUTH_ORIGIN}/oauth2/auth?` + new URLSearchParams({
      auth_method: '',
      login_type: '',
      flow: 'launcher',
      response_type: 'code',
      client_id: CLIENT_ID,
      code_challenge_method: 'S256',
      prompt: 'login',
      scope: SCOPES,
      redirect_uri: REDIRECT_URI,
      code_challenge: codeChallenge,
      state: state1,
    }).toString();

    await shell.openExternal(authUrl);
    return authUrl;
  }

  /**
   * Completes the login flow after the user logs in via their system browser
   * and provides either the full redirect URL or the authorization code.
   */
  public async completeBrowserLogin(codeOrUrl: string): Promise<JagexAccountSession> {
    if (!this.pendingBrowserFlow) {
      throw new Error('No pending browser login flow found. Please start login first.');
    }

    const { codeVerifier, state2, nonce } = this.pendingBrowserFlow;
    let code = codeOrUrl.trim();

    if (code.includes('code=')) {
      try {
        const parsed = new URL(code);
        code = parsed.searchParams.get('code') || code;
      } catch {
        const match = /code=([^&]+)/.exec(code);
        if (match) code = match[1];
      }
    }

    console.log('[Auth] Completing browser login with code...');
    const tokens = await this.exchangeCodeForTokens(code, codeVerifier);

    // Perform consent handshake using an offscreen BrowserWindow in the stealth session
    console.log('[Auth] Exchanged code for tokens. Initiating background consent handshake...');
    const consentIdToken = await this.performConsentFlow(tokens.id_token, state2, nonce);
    console.log('[Auth] Successfully obtained consent ID token! Creating game session...');

    const sessionId = await this.createGameSession(consentIdToken);
    const characters = await this.fetchCharacters(sessionId);
    const sessionData = await this.finalizeLogin(consentIdToken, tokens.refresh_token, sessionId, characters);

    this.pendingBrowserFlow = null;
    return sessionData;
  }

  /**
   * Helper to perform stage-2 consent flow in an offscreen window.
   */
  private async performConsentFlow(idToken: string, state: string, nonce: string): Promise<string> {
    const authSession = session.fromPartition('persist:jagex-auth', { cache: true });
    const consentUrl = `${AUTH_ORIGIN}/oauth2/auth?` + new URLSearchParams({
      prompt: 'consent',
      redirect_uri: CONSENT_REDIRECT_URI,
      response_type: 'id_token code',
      client_id: CONSENT_CLIENT_ID,
      scope: 'openid offline',
      id_token_hint: idToken,
      state: state,
      nonce: nonce,
    }).toString();

    return new Promise((resolve, reject) => {
      const win = new BrowserWindow({
        show: false,
        width: 400,
        height: 400,
        webPreferences: {
          session: authSession,
          preload: path.join(__dirname, '../preload/login-preload.js'),
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: false,
        }
      });

      let handled = false;
      const cleanup = () => {
        if (!win.isDestroyed()) {
          win.destroy();
        }
      };

      const timer = setTimeout(() => {
        if (!handled) {
          handled = true;
          cleanup();
          reject(new Error('Consent handshake timed out. Please use the in-launcher Log In button.'));
        }
      }, 15000);

      const checkUrl = (urlStr: string) => {
        if (handled) return;
        if (urlStr.startsWith('http://localhost') || urlStr.startsWith('http://127.0.0.1')) {
          handled = true;
          clearTimeout(timer);
          cleanup();
          const hashIdx = urlStr.indexOf('#');
          const qIdx = urlStr.indexOf('?');
          const fragmentOrQuery = hashIdx !== -1 ? urlStr.substring(hashIdx + 1) : (qIdx !== -1 ? urlStr.substring(qIdx + 1) : '');
          const params = new URLSearchParams(fragmentOrQuery);
          const token = params.get('id_token') || params.get('idToken');
          if (token) resolve(token);
          else reject(new Error('No id_token found in consent redirect'));
        }
      };

      win.webContents.on('will-redirect', (e, url) => {
        if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
          e.preventDefault();
          checkUrl(url);
        }
      });

      win.webContents.on('will-navigate', (e, url) => {
        if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
          e.preventDefault();
          checkUrl(url);
        }
      });

      win.loadURL(consentUrl);
    });
  }

  public async exchangeCodeForTokens(code: string, verifier: string): Promise<any> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    });

    const res = await fetch(`${AUTH_ORIGIN}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': CLEAN_USER_AGENT,
      },
      body: body.toString(),
      signal: AbortSignal.timeout(15000)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Token exchange failed (${res.status}): ${errText}`);
    }

    return await res.json();
  }

  private async finalizeLogin(
    idToken: string,
    refreshToken: string,
    existingSessionId?: string,
    existingCharacters?: JagexCharacter[]
  ): Promise<JagexAccountSession> {
    const sessionId = existingSessionId || await this.createGameSession(idToken);
    const characters = existingCharacters || await this.fetchCharacters(sessionId);

    const jwtPayload = parseJwtPayload(idToken) || {};
    const sub = jwtPayload.sub || `user_${Date.now()}`;
    let displayName = jwtPayload.nickname || jwtPayload.preferred_username || jwtPayload.name || 'Jagex Account';
    if (displayName.includes('#')) {
      displayName = displayName.substring(0, displayName.lastIndexOf('#'));
    }
    const email = jwtPayload.email;

    const sessionData: JagexAccountSession = {
      sub,
      displayName,
      email,
      idToken,
      refreshToken,
      sessionId,
      characters,
    };

    // Save in store
    const currentSessions = store.getSessions();
    currentSessions.accounts[sub] = sessionData;
    currentSessions.activeSub = sub;
    store.saveSessions(currentSessions);

    if (characters.length > 0) {
      store.saveSettings({
        activeAccountId: sub,
        selectedCharacterId: characters[0].id
      });
    }

    return sessionData;
  }

  public async createGameSession(idToken: string): Promise<string> {
    const res = await fetch(`${GAME_AUTH_ORIGIN}/game-session/v1/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': CLEAN_USER_AGENT,
      },
      body: JSON.stringify({ idToken }),
      signal: AbortSignal.timeout(15000)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to create game session (${res.status}): ${errText}`);
    }

    const data = await res.json();
    if (!data.sessionId) {
      throw new Error('Response did not contain a valid sessionId');
    }
    return data.sessionId;
  }

  public async checkMembershipStatus(displayName: string, item: any): Promise<boolean> {
    return checkMembershipStatus(displayName, item);
  }

  public async fetchCharacters(sessionId: string): Promise<JagexCharacter[]> {
    const res = await fetch(`${GAME_AUTH_ORIGIN}/game-session/v1/accounts`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${sessionId}`,
        'Accept': 'application/json',
        'User-Agent': CLEAN_USER_AGENT,
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!res.ok) {
      console.error(`[Auth] Failed to fetch accounts (${res.status}):`, await res.text());
      return [];
    }

    const data = await res.json();
    if (Array.isArray(data)) {
      return await Promise.all(
        data.map(async (item: any) => {
          const displayName = item.displayName || 'Character';
          const isMember = await this.checkMembershipStatus(displayName, item);
          return {
            id: item.accountId || item.id,
            displayName,
            isMember,
            isIronman: item.isIronman ?? false,
            isHardcore: item.isHardcore ?? false,
          };
        })
      );
    }
    return [];
  }

  public async refreshAccountSession(sub: string): Promise<JagexAccountSession | null> {
    const sessions = store.getSessions();
    const account = sessions.accounts[sub];
    if (!account || !account.refreshToken) return null;

    try {
      console.log(`[Auth] Refreshing tokens for account ${sub}...`);
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: account.refreshToken,
        client_id: CLIENT_ID,
      });

      const res = await fetch(`${AUTH_ORIGIN}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': CLEAN_USER_AGENT,
        },
        body: body.toString(),
        signal: AbortSignal.timeout(15000)
      });

      if (!res.ok) {
        console.warn(`[Auth] Refresh token failed for ${sub}: ${res.status}`);
        return null;
      }

      const data = await res.json();
      account.idToken = data.id_token;
      if (data.refresh_token) {
        account.refreshToken = data.refresh_token;
      }

      // If needed, check character list
      const characters = await this.fetchCharacters(account.sessionId);
      if (characters.length > 0) {
        account.characters = characters;
      }

      sessions.accounts[sub] = account;
      store.saveSessions(sessions);
      return account;
    } catch (e) {
      console.error(`[Auth] Error refreshing account ${sub}:`, e);
      return null;
    }
  }

  public async syncCharacters(sub: string): Promise<JagexCharacter[]> {
    const sessions = store.getSessions();
    const account = sessions.accounts[sub];
    if (!account) return [];

    let characters: JagexCharacter[] = [];
    if (account.sessionId) {
      try {
        characters = await this.fetchCharacters(account.sessionId);
      } catch (e) {
        console.warn(`[Auth] fetchCharacters error during sync:`, e);
      }
    }

    // Fallback if session endpoint failed but cached characters exist: re-verify membership
    if (characters.length === 0 && account.characters && account.characters.length > 0) {
      characters = await Promise.all(
        account.characters.map(async (char) => {
          const isMember = await this.checkMembershipStatus(char.displayName, char);
          return {
            ...char,
            isMember,
          };
        })
      );
    }

    if (characters.length > 0) {
      account.characters = characters;
      sessions.accounts[sub] = account;
      store.saveSessions(sessions);
    }

    return characters;
  }

  public switchAccount(sub: string): JagexAccountSession | null {
    return store.setActiveAccount(sub);
  }

  public removeAccount(sub: string): SessionData {
    return store.removeAccount(sub);
  }
}

export const auth = new JagexAuthManager();
