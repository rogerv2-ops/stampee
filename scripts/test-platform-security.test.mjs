import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createStampeeServer } from '../server/index.mjs';
import {
  checkPlatformSession,
  handlePlatformSessionRequest,
} from '../server/platform-security.mjs';
import { platformSecurityPlugin } from '../server/vite-platform-security.mjs';
import denyPlatformOnVercel from '../api/platform/deny.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const UID = '11111111-1111-4111-8111-111111111111';
const SERVER_ENV = {
  NODE_ENV: 'production',
  STAMPEE_SUPABASE_URL: 'https://stampee-staging.example.test',
  STAMPEE_SUPABASE_ANON_KEY: 'public-anon-fixture',
  STAMPEE_PLATFORM_SERVICE_ROLE_KEY: 'server-only-fixture',
};
const jsonResponse = (payload, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload,
});
const activeAuthUser = () => jsonResponse({
  user: { id: UID, email_confirmed_at: new Date().toISOString(), banned_until: null, deleted_at: null },
});
const makeResponse = () => ({
  statusCode: 0,
  headers: {},
  body: '',
  writeHead(status, headers) { this.statusCode = status; this.headers = headers; },
  end(body = '') { this.body = Buffer.isBuffer(body) ? body.toString('utf8') : String(body); },
});
const accessToken = (claims = {}) => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: UID,
    aal: 'aal2',
    exp: Math.floor(Date.now() / 1000) + 900,
    amr: [{ method: 'totp', timestamp: Math.floor(Date.now() / 1000) }],
    ...claims,
  })).toString('base64url');
  return `${header}.${payload}.synthetic-signature`;
};
const goodFetch = async (url) => {
  const parsed = new URL(url);
  if (parsed.pathname === '/rest/v1/rpc/platform_validate_session') return jsonResponse(UID);
  if (parsed.pathname === `/auth/v1/admin/users/${UID}`) {
    return jsonResponse({ user: { id: UID, email_confirmed_at: new Date().toISOString(), banned_until: null, deleted_at: null } });
  }
  throw new Error(`Unexpected request ${parsed.pathname}`);
};
const originHeaders = {
  origin: 'https://stampee.example.test',
  host: 'stampee.example.test',
  'x-forwarded-proto': 'https',
};


test('no cookie denies access without contacting Supabase', async () => {
  let requests = 0;
  const result = await checkPlatformSession({ headers: {} }, { env: SERVER_ENV, fetchImpl: async () => { requests += 1; } });
  assert.deepEqual(result, { ok: false, status: 401, reason: 'missing_session' });
  assert.equal(requests, 0);
});

test('production refuses an HTTP Supabase origin before using the service credential', async () => {
  let requests = 0;
  const result = await checkPlatformSession(
    { headers: { cookie: 'stampee_platform_session=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' } },
    { env: { ...SERVER_ENV, STAMPEE_SUPABASE_URL: 'http://staging.example.test' }, fetchImpl: async () => { requests += 1; } },
  );
  assert.deepEqual(result, { ok: false, status: 503, reason: 'configuration_unavailable' });
  assert.equal(requests, 0);
});

test('active server-backed session requires active account and current membership', async () => {
  const result = await checkPlatformSession(
    { headers: { cookie: 'stampee_platform_session=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' } },
    { env: SERVER_ENV, fetchImpl: goodFetch },
  );
  assert.equal(result.ok, true);
});

test('disabled or expired membership denies access before account data lookup', async () => {
  let authLookups = 0;
  const result = await checkPlatformSession(
    { headers: { cookie: 'stampee_platform_session=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' } },
    {
      env: SERVER_ENV,
      fetchImpl: async (url) => {
        if (new URL(url).pathname === '/rest/v1/rpc/platform_validate_session') return jsonResponse(null);
        authLookups += 1;
        return jsonResponse({});
      },
    },
  );
  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
  assert.equal(authLookups, 0);
});

test('banned, deleted, or unconfirmed Auth account is denied', async () => {
  const invalidAccounts = [
    { email_confirmed_at: null, banned_until: null, deleted_at: null },
    { email_confirmed_at: new Date().toISOString(), banned_until: null, deleted_at: new Date().toISOString() },
    { email_confirmed_at: new Date().toISOString(), banned_until: new Date(Date.now() + 60_000).toISOString(), deleted_at: null },
  ];
  for (const user of invalidAccounts) {
    const result = await checkPlatformSession(
      { headers: { cookie: 'stampee_platform_session=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' } },
      {
        env: SERVER_ENV,
        fetchImpl: async (url) => new URL(url).pathname === '/rest/v1/rpc/platform_validate_session'
          ? jsonResponse(UID)
          : jsonResponse({ user: { id: UID, ...user } }),
      },
    );
    assert.equal(result.ok, false);
    assert.equal(result.status, 403);
  }
});

test('session exchange requires same-origin and an AAL2 Auth token', async () => {
  const noOriginResponse = makeResponse();
  await handlePlatformSessionRequest(
    { method: 'POST', headers: { authorization: `Bearer ${accessToken()}`, host: 'stampee.example.test' } },
    noOriginResponse,
    { env: SERVER_ENV, fetchImpl: async () => { throw new Error('must not call'); } },
  );
  assert.equal(noOriginResponse.statusCode, 403);

  const spoofedForwardedHostResponse = makeResponse();
  await handlePlatformSessionRequest(
    {
      method: 'POST',
      headers: {
        origin: 'https://attacker.example.test',
        host: 'stampee.example.test',
        'x-forwarded-host': 'attacker.example.test',
        'x-forwarded-proto': 'https',
        authorization: `Bearer ${accessToken()}`,
      },
    },
    spoofedForwardedHostResponse,
    { env: SERVER_ENV, fetchImpl: async () => { throw new Error('must not call'); } },
  );
  assert.equal(spoofedForwardedHostResponse.statusCode, 403);

  const aal1Response = makeResponse();
  await handlePlatformSessionRequest(
    { method: 'POST', headers: { ...originHeaders, authorization: `Bearer ${accessToken({ aal: 'aal1' })}` } },
    aal1Response,
    { env: SERVER_ENV, fetchImpl: async (url) => new URL(url).pathname === '/auth/v1/user'
      ? jsonResponse({ id: UID, email_confirmed_at: new Date().toISOString() })
      : jsonResponse(true) },
  );
  assert.equal(aal1Response.statusCode, 403);
  assert.equal(aal1Response.headers['Set-Cookie'], undefined);
});

test('session exchange rejects missing, stale, and future MFA timestamps', async () => {
  const invalidMfaClaims = [
    { amr: [] },
    { amr: [{ method: 'totp', timestamp: Math.floor(Date.now() / 1000) - 11 * 60 }] },
    { amr: [{ method: 'mfa/totp', timestamp: Math.floor(Date.now() / 1000) + 60 }] },
  ];
  for (const claims of invalidMfaClaims) {
    const response = makeResponse();
    let sessionRpcCalls = 0;
    await handlePlatformSessionRequest(
      { method: 'POST', headers: { ...originHeaders, authorization: `Bearer ${accessToken(claims)}` } },
      response,
      {
        env: SERVER_ENV,
        fetchImpl: async (url) => {
          if (new URL(url).pathname === '/auth/v1/user') return jsonResponse({ id: UID, email_confirmed_at: new Date().toISOString() });
          sessionRpcCalls += 1;
          return jsonResponse(true);
        },
      },
    );
    assert.equal(response.statusCode, 403);
    assert.equal(response.headers['Set-Cookie'], undefined);
    assert.equal(sessionRpcCalls, 0);
  }
});

test('authorized exchange sets only an opaque HttpOnly Secure cookie, never returning it', async () => {
  const response = makeResponse();
  const calls = [];
  await handlePlatformSessionRequest(
    { method: 'POST', headers: { ...originHeaders, authorization: `Bearer ${accessToken()}` } },
    response,
    {
      env: SERVER_ENV,
      randomBytesImpl: (size) => Buffer.alloc(size, 7),
      fetchImpl: async (url, options) => {
        const parsed = new URL(url);
        calls.push({ path: parsed.pathname, options });
        if (parsed.pathname === '/auth/v1/user') return jsonResponse({ id: UID, email_confirmed_at: new Date().toISOString() });
        if (parsed.pathname === `/auth/v1/admin/users/${UID}`) return activeAuthUser();
        if (parsed.pathname === '/rest/v1/rpc/platform_create_session') return jsonResponse(true);
        throw new Error(`Unexpected request ${parsed.pathname}`);
      },
    },
  );
  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { ok: true });
  const cookie = response.headers['Set-Cookie'];
  assert.match(cookie, /^stampee_platform_session=[A-Za-z0-9_-]{40,60};/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Strict/);
  assert.doesNotMatch(response.body, /server-only-fixture|AAAAAAAA|070707/);
  const rpcCall = calls.find((call) => call.path === '/rest/v1/rpc/platform_create_session');
  assert.equal(rpcCall.options.headers.apikey, 'server-only-fixture');
  const rpcBody = JSON.parse(rpcCall.options.body);
  assert.equal(rpcBody.p_user_id, UID);
  assert.match(rpcBody.p_token_hash, /^[a-f0-9]{64}$/);
  assert.equal(cookie.includes(rpcBody.p_token_hash), false);
});

test('empty platform membership denies session creation and issues no cookie', async () => {
  const response = makeResponse();
  await handlePlatformSessionRequest(
    { method: 'POST', headers: { ...originHeaders, authorization: `Bearer ${accessToken()}` } },
    response,
    {
      env: SERVER_ENV,
      fetchImpl: async (url) => {
        const pathname = new URL(url).pathname;
        if (pathname === '/auth/v1/user') return jsonResponse({ id: UID, email_confirmed_at: new Date().toISOString() });
        if (pathname === `/auth/v1/admin/users/${UID}`) return activeAuthUser();
        return jsonResponse(false);
      },
    },
  );
  assert.equal(response.statusCode, 403);
  assert.equal(response.headers['Set-Cookie'], undefined);
  assert.deepEqual(JSON.parse(response.body), { error: 'PLATFORM_FORBIDDEN' });
});

test('same-origin logout revokes the server session and expires its cookie', async () => {
  const response = makeResponse();
  let payload;
  await handlePlatformSessionRequest(
    { method: 'DELETE', headers: { ...originHeaders, cookie: 'stampee_platform_session=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' } },
    response,
    {
      env: SERVER_ENV,
      fetchImpl: async (url, options) => {
        assert.equal(new URL(url).pathname, '/rest/v1/rpc/platform_revoke_session');
        payload = JSON.parse(options.body);
        return jsonResponse(true);
      },
    },
  );
  assert.equal(response.statusCode, 204);
  assert.match(response.headers['Set-Cookie'], /Max-Age=0/);
  assert.match(response.headers['Set-Cookie'], /HttpOnly/);
  assert.match(payload.p_token_hash, /^[a-f0-9]{64}$/);
});

test('direct /platform request receives denial HTML before the SPA index is read', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'stampee-platform-gate-'));
  const sentinel = 'PRIVATE_PLATFORM_SHELL_SENTINEL';
  await writeFile(path.join(directory, 'index.html'), `<!doctype html><html><body><div id="root">${sentinel}</div><script src="/assets/app.js"></script></body></html>`);
  const server = createStampeeServer({ env: SERVER_ENV, distDir: directory, fetchImpl: goodFetch });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  });
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/platform`, { headers: { 'accept-language': 'es-PE' } });
  const body = await response.text();
  assert.equal(response.status, 401);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.match(body, /Acceso restringido/);
  assert.doesNotMatch(body, new RegExp(sentinel));
  assert.doesNotMatch(body, /<script/i);
  assert.equal(response.headers.get('cache-control'), 'no-store, private');
  assert.equal(response.headers.get('content-security-policy')?.includes("default-src 'none'"), true);
  for (const route of ['/PLATFORM', '/%70latform', '/%2570latform', '/%2525252570latform', '/platform%2Fprivate']) {
    const encodedResponse = await fetch(`http://127.0.0.1:${port}${route}`);
    assert.equal(encodedResponse.status, 401, `expected protected response for ${route}`);
    assert.doesNotMatch(await encodedResponse.text(), /<script/i);
  }
  const encodedApiResponse = await fetch(`http://127.0.0.1:${port}/api%2fplatform%2fsession`);
  assert.equal(encodedApiResponse.status, 401);
  assert.match(encodedApiResponse.headers.get('content-type'), /application\/json/);

  const authorizedResponse = await fetch(`http://127.0.0.1:${port}/platform`, {
    headers: { cookie: 'stampee_platform_session=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
  });
  assert.equal(authorizedResponse.status, 200);
  assert.match(await authorizedResponse.text(), new RegExp(sentinel));
});

test('platform auth bootstrap is public but receives only the ordinary app index', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'stampee-platform-auth-'));
  await writeFile(path.join(directory, 'index.html'), '<!doctype html><html><body>ordinary-app-index</body></html>');
  const server = createStampeeServer({ env: {}, distDir: directory });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/platform/auth`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /ordinary-app-index/);
});

test('Vite dev and preview deny an encoded platform path before calling next', async () => {
  for (const hook of ['configureServer', 'configurePreviewServer']) {
    const plugin = platformSecurityPlugin({ env: SERVER_ENV, fetchImpl: goodFetch });
    let middleware;
    plugin[hook]({ middlewares: { use: (handler) => { middleware = handler; } } });
    for (const url of ['/%70latform', 'http://[']) {
      let finish;
      const completed = new Promise((resolve) => { finish = resolve; });
      const response = {
        ...makeResponse(),
        writeHead(status, headers) { this.statusCode = status; this.headers = headers; },
        end(body = '') { this.body = String(body); finish(); },
      };
      let nextCalled = false;
      middleware({ method: 'GET', url, headers: {} }, response, () => {
        nextCalled = true;
        finish();
      });
      await completed;
      assert.equal(nextCalled, false, `${hook} must stop ${url}`);
      assert.equal(response.statusCode, 401);
      assert.match(response.body, /Restricted access/);
    }
  }
});

test('Vercel static deployment rewrites every platform URL to a server-generated 403', async () => {
  const config = JSON.parse(await readFile(path.join(HERE, '../vercel.json'), 'utf8'));
  assert.deepEqual(config.rewrites.slice(0, 2).map((route) => route.destination), [
    '/api/platform/deny',
    '/api/platform/deny',
  ]);
  const response = {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[name] = value; },
    end(body = '') { this.body = String(body); },
  };
  denyPlatformOnVercel({ headers: { 'accept-language': 'es-PE' } }, response);
  assert.equal(response.statusCode, 403);
  assert.match(response.body, /Acceso denegado/);
  assert.doesNotMatch(response.body, /<script/i);
  assert.equal(response.headers['Cache-Control'], 'no-store, private');
});

test('client platform code contains no privileged env lookup or localStorage session persistence', async () => {
  const clientCode = await readFile(path.join(HERE, '../components/PlatformAccessPages.tsx'), 'utf8');
  assert.doesNotMatch(clientCode, /localStorage|sessionStorage|VITE_.*(?:SERVICE_ROLE|PLATFORM_SESSION)/i);
  assert.doesNotMatch(clientCode, /STAMPEE_PLATFORM_SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(clientCode, /if \(state === 'checking'\) return null;/);
  assert.match(clientCode, /No platform data or administration tools are available in this phase\./);
});
