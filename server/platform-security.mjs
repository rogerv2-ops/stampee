import { createHash, randomBytes } from 'node:crypto';

export const PLATFORM_COOKIE_NAME = 'stampee_platform_session';
export const PLATFORM_SESSION_MAX_AGE_SECONDS = 30 * 60;

export const normalizeRequestPath = (pathname) => {
  let normalized = String(pathname ?? '/');
  for (let index = 0; index < 8; index += 1) {
    normalized = normalized.replace(/%([0-9a-f]{2})/gi, (_match, byte) => String.fromCharCode(Number.parseInt(byte, 16)));
  }
  return normalized.replace(/\\/g, '/').replace(/\/{2,}/g, '/').toLowerCase();
};

export const isPlatformPath = (pathname) => {
  const normalized = normalizeRequestPath(pathname);
  return normalized === '/platform' || normalized.startsWith('/platform/');
};

export const isPlatformApiPath = (pathname) => {
  const normalized = normalizeRequestPath(pathname);
  return normalized === '/api/platform' || normalized.startsWith('/api/platform/');
};

const responseHeaders = {
  'Cache-Control': 'no-store, private',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
};

const getHeader = (request, name) => {
  const value = request?.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
};

const send = (response, status, headers, body = '') => {
  const finalHeaders = { ...responseHeaders, ...headers };
  if (typeof response.writeHead === 'function') {
    response.writeHead(status, finalHeaders);
    response.end(body);
    return;
  }
  response.status(status);
  for (const [name, value] of Object.entries(finalHeaders)) response.setHeader(name, value);
  if (typeof response.send === 'function') response.send(body);
  else response.end(body);
};

const deniedCopy = (status, language) => {
  const spanish = language?.toLowerCase().startsWith('es');
  if (status === 503) {
    return spanish
      ? { title: 'No se puede comprobar el acceso', body: 'Inténtalo de nuevo más tarde. No se cargó el área de plataforma.' }
      : { title: 'Access could not be verified', body: 'Please try again later. The platform area was not loaded.' };
  }
  if (status === 401) {
    return spanish
      ? { title: 'Acceso restringido', body: 'Inicia sesión y vuelve a comprobar si tu cuenta está autorizada para el área de plataforma.' }
      : { title: 'Restricted access', body: 'Sign in, then check again whether your account is authorized for the platform area.' };
  }
  return spanish
    ? { title: 'Acceso denegado', body: 'Esta cuenta no tiene autorización para el área de plataforma.' }
    : { title: 'Access denied', body: 'This account is not authorized for the platform area.' };
};

export const renderPlatformDeniedHtml = (status = 403, language = 'es') => {
  const copy = deniedCopy(status, language);
  const loginLink = status === 401
    ? `<p><a href="/platform/auth">${language?.toLowerCase().startsWith('es') ? 'Comprobar acceso' : 'Check access'}</a></p>`
    : '';
  return `<!doctype html><html lang="${language?.toLowerCase().startsWith('es') ? 'es' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${copy.title} | Stampee</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f5ef;color:#201d18;font:16px/1.55 system-ui,sans-serif}.card{box-sizing:border-box;width:min(92vw,520px);padding:32px;border:1px solid #e7e2d8;border-radius:20px;background:#fff;box-shadow:0 12px 40px #1d1d1b0c}h1{margin:0 0 12px;font-size:1.5rem}p{margin:0;color:#625d54}a{color:#315e57;font-weight:600}</style></head><body><main class="card" role="main"><h1>${copy.title}</h1><p>${copy.body}</p>${loginLink}</main></body></html>`;
};

export const sendPlatformDenied = (response, status = 403, language = 'es') => {
  send(response, status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  }, renderPlatformDeniedHtml(status, language));
};

const sendJson = (response, status, payload, extraHeaders = {}) => {
  send(response, status, { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders }, JSON.stringify(payload));
};

const sendApiDenied = (response, status = 403) => {
  const code = status === 503 ? 'ACCESS_CHECK_UNAVAILABLE' : status === 401 ? 'AUTH_REQUIRED' : 'PLATFORM_FORBIDDEN';
  sendJson(response, status, { error: code });
};

const readCookie = (request, key) => {
  const raw = getHeader(request, 'cookie') ?? '';
  for (const part of raw.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === key) return part.slice(separator + 1).trim();
  }
  return null;
};

const tokenHash = (token) => createHash('sha256').update(token, 'utf8').digest('hex');

const getConfig = (env) => {
  const rawUrl = env.STAMPEE_SUPABASE_URL?.trim();
  const anonKey = env.STAMPEE_SUPABASE_ANON_KEY?.trim();
  const serviceKey = env.STAMPEE_PLATFORM_SERVICE_ROLE_KEY?.trim();
  if (!rawUrl || !anonKey || !serviceKey) return null;
  let url;
  try { url = new URL(rawUrl); } catch { return null; }
  const localDevelopment = ['development', 'test'].includes(env.NODE_ENV)
    && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && localDevelopment)) return null;
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return null;
  return { baseUrl: url.origin, anonKey, serviceKey };
};

const decodeJwtClaims = (token) => {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
};

const isSameOriginRequest = (request) => {
  const origin = getHeader(request, 'origin');
  const host = getHeader(request, 'host');
  const forwardedProtocol = getHeader(request, 'x-forwarded-proto')?.split(',')[0]?.trim();
  const protocol = forwardedProtocol || (request?.socket?.encrypted ? 'https' : 'http');
  if (!origin || !host || !['http', 'https'].includes(protocol)) return false;
  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(`${protocol}://${host}`);
    return originUrl.origin === requestUrl.origin;
  } catch {
    return false;
  }
};

const getCookieToken = (request) => {
  const token = readCookie(request, PLATFORM_COOKIE_NAME);
  return token && /^[A-Za-z0-9_-]{40,60}$/.test(token) ? token : null;
};

const callPlatformRpc = async (config, fetchImpl, name, payload) => {
  const response = await fetchImpl(`${config.baseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) throw new Error('Platform authorization backend unavailable');
  return response.json();
};

const readActiveAuthUser = async (config, fetchImpl, userId) => {
  const response = await fetchImpl(`${config.baseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'GET',
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(7000),
  });
  if (response.status === 404) return { active: false, unavailable: false };
  if (!response.ok) throw new Error('Platform authorization backend unavailable');
  const payload = await response.json();
  const user = payload?.user ?? payload;
  if (!user || user.id !== userId || user.deleted_at) return { active: false, unavailable: false };
  if (!user.email_confirmed_at) return { active: false, unavailable: false };
  if (user.banned_until && Date.parse(user.banned_until) > Date.now()) return { active: false, unavailable: false };
  return { active: true, unavailable: false };
};

export const checkPlatformSession = async (request, {
  env = process.env,
  fetchImpl = fetch,
} = {}) => {
  const token = getCookieToken(request);
  if (!token) return { ok: false, status: 401, reason: 'missing_session' };
  const config = getConfig(env);
  if (!config) return { ok: false, status: 503, reason: 'configuration_unavailable' };
  try {
    const userId = await callPlatformRpc(config, fetchImpl, 'platform_validate_session', { p_token_hash: tokenHash(token) });
    if (typeof userId !== 'string' || !/^[0-9a-f-]{36}$/i.test(userId)) {
      return { ok: false, status: 403, reason: 'not_authorized' };
    }
    const account = await readActiveAuthUser(config, fetchImpl, userId);
    if (!account.active) return { ok: false, status: 403, reason: 'not_authorized' };
    return { ok: true };
  } catch {
    return { ok: false, status: 503, reason: 'verification_unavailable' };
  }
};

const getBearerToken = (request) => {
  const value = getHeader(request, 'authorization') ?? '';
  const match = /^Bearer\s+([A-Za-z0-9._~-]+)$/i.exec(value);
  return match?.[1] ?? null;
};

const hasRecentMfa = (claims, now) => {
  if (!Array.isArray(claims?.amr)) return false;
  const acceptedMethods = new Set(['totp', 'mfa/totp', 'mfa/phone', 'mfa/webauthn']);
  return claims.amr.some((entry) => {
    if (!entry || typeof entry !== 'object' || !acceptedMethods.has(entry.method) || typeof entry.timestamp !== 'number') return false;
    const verifiedAt = entry.timestamp * 1000;
    return verifiedAt <= now() && now() - verifiedAt <= 10 * 60 * 1000;
  });
};

const verifySupabaseIdentity = async (config, fetchImpl, accessToken, now) => {
  const response = await fetchImpl(`${config.baseUrl}/auth/v1/user`, {
    method: 'GET',
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) return null;
  const user = await response.json();
  const claims = decodeJwtClaims(accessToken);
  if (!user?.id || !claims || claims.sub !== user.id || claims.aal !== 'aal2') return null;
  if (!hasRecentMfa(claims, now)) return null;
  if (typeof claims.exp !== 'number' || claims.exp * 1000 <= now()) return null;
  if (!user.email_confirmed_at || user.deleted_at) return null;
  const account = await readActiveAuthUser(config, fetchImpl, user.id);
  if (!account.active) return null;
  return user.id;
};

const cookieHeader = (token, request, env) => {
  const forwardedProtocol = getHeader(request, 'x-forwarded-proto')?.split(',')[0]?.trim();
  const isDevelopment = env.NODE_ENV === 'development' || env.NODE_ENV === 'test';
  const secure = !isDevelopment || forwardedProtocol === 'https' || Boolean(request?.socket?.encrypted);
  return `${PLATFORM_COOKIE_NAME}=${token}; Path=/; Max-Age=${PLATFORM_SESSION_MAX_AGE_SECONDS}; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`;
};

const clearCookieHeader = (request, env) => {
  const forwardedProtocol = getHeader(request, 'x-forwarded-proto')?.split(',')[0]?.trim();
  const isDevelopment = env.NODE_ENV === 'development' || env.NODE_ENV === 'test';
  const secure = !isDevelopment || forwardedProtocol === 'https' || Boolean(request?.socket?.encrypted);
  return `${PLATFORM_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`;
};

export const handlePlatformSessionRequest = async (request, response, {
  env = process.env,
  fetchImpl = fetch,
  now = () => Date.now(),
  randomBytesImpl = randomBytes,
} = {}) => {
  const method = (request.method ?? 'GET').toUpperCase();
  if (!['GET', 'POST', 'DELETE'].includes(method)) {
    sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' }, { Allow: 'GET, POST, DELETE' });
    return;
  }
  if ((method === 'POST' || method === 'DELETE') && !isSameOriginRequest(request)) {
    sendApiDenied(response, 403);
    return;
  }

  const config = getConfig(env);
  if (!config) {
    if (method === 'DELETE') {
      sendJson(response, 503, { error: 'ACCESS_CHECK_UNAVAILABLE' }, { 'Set-Cookie': clearCookieHeader(request, env) });
    } else {
      sendApiDenied(response, 503);
    }
    return;
  }

  if (method === 'POST') {
    const accessToken = getBearerToken(request);
    if (!accessToken) {
      sendApiDenied(response, 401);
      return;
    }
    let userId;
    try {
      userId = await verifySupabaseIdentity(config, fetchImpl, accessToken, now);
    } catch {
      sendApiDenied(response, 503);
      return;
    }
    if (!userId) {
      sendApiDenied(response, 403);
      return;
    }

    const opaqueToken = randomBytesImpl(32).toString('base64url');
    try {
      const created = await callPlatformRpc(config, fetchImpl, 'platform_create_session', {
        p_user_id: userId,
        p_token_hash: tokenHash(opaqueToken),
      });
      if (created !== true) {
        sendApiDenied(response, 403);
        return;
      }
      sendJson(response, 200, { ok: true }, { 'Set-Cookie': cookieHeader(opaqueToken, request, env) });
    } catch {
      sendApiDenied(response, 503);
    }
    return;
  }

  const opaqueToken = getCookieToken(request);
  if (method === 'DELETE') {
    let failure = false;
    if (opaqueToken) {
      try {
        await callPlatformRpc(config, fetchImpl, 'platform_revoke_session', { p_token_hash: tokenHash(opaqueToken) });
      } catch {
        failure = true;
      }
    }
    send(response, failure ? 503 : 204, { 'Set-Cookie': clearCookieHeader(request, env), 'Content-Type': 'application/json; charset=utf-8' }, '');
    return;
  }

  const result = await checkPlatformSession(request, { env, fetchImpl });
  if (!result.ok) {
    sendApiDenied(response, result.status);
    return;
  }
  sendJson(response, 200, { ok: true });
};

export const sendPlatformApiNotFound = (response) => sendJson(response, 404, { error: 'NOT_FOUND' });

export const handleUnimplementedPlatformApi = async (request, response, options = {}) => {
  const result = await checkPlatformSession(request, options);
  if (!result.ok) sendApiDenied(response, result.status);
  else sendPlatformApiNotFound(response);
};
