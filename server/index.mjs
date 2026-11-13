import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  checkPlatformSession,
  handlePlatformSessionRequest,
  handleUnimplementedPlatformApi,
  normalizeRequestPath,
  sendPlatformDenied,
} from './platform-security.mjs';

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIST_DIR = path.resolve(SERVER_DIR, '../dist');
const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const respond = (response, status, body = '', headers = {}) => {
  response.writeHead(status, {
    'Cache-Control': 'no-store, private',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  response.end(body);
};

const serveDist = async (request, response, distDir) => {
  if (!['GET', 'HEAD'].includes((request.method ?? 'GET').toUpperCase())) {
    respond(response, 405, 'Method not allowed', { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' });
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  } catch {
    respond(response, 400, 'Bad request', { 'Content-Type': 'text/plain; charset=utf-8' });
    return;
  }
  const relative = pathname.replace(/^\/+/, '') || 'index.html';
  const root = path.resolve(distDir);
  let target = path.resolve(root, relative);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    respond(response, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
    return;
  }

  try {
    let fileInfo = await stat(target);
    if (fileInfo.isDirectory()) {
      target = path.join(target, 'index.html');
      fileInfo = await stat(target);
    }
    if (!fileInfo.isFile()) throw new Error('Not a file');
  } catch {
    target = path.join(root, 'index.html');
    try {
      const fileInfo = await stat(target);
      if (!fileInfo.isFile()) throw new Error('No index');
    } catch {
      respond(response, 503, 'Application build is unavailable', { 'Content-Type': 'text/plain; charset=utf-8' });
      return;
    }
  }

  try {
    const body = await readFile(target);
    const isIndex = path.basename(target) === 'index.html';
    respond(response, 200, request.method === 'HEAD' ? '' : body, {
      'Content-Type': CONTENT_TYPES[path.extname(target).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': isIndex ? 'no-cache, no-store, private' : 'public, max-age=31536000, immutable',
      'Content-Length': String(body.byteLength),
    });
  } catch {
    respond(response, 500, 'Unable to serve request', { 'Content-Type': 'text/plain; charset=utf-8' });
  }
};

const getLanguage = (request) => {
  const value = request.headers?.['accept-language'];
  return typeof value === 'string' && value.toLowerCase().startsWith('es') ? 'es' : 'en';
};

export const createStampeeServer = ({
  env = process.env,
  fetchImpl = fetch,
  distDir = DEFAULT_DIST_DIR,
} = {}) => http.createServer(async (request, response) => {
  let pathname;
  try {
    pathname = normalizeRequestPath(new URL(request.url ?? '/', 'http://localhost').pathname);
  } catch {
    sendPlatformDenied(response, 400, getLanguage(request));
    return;
  }

  try {
    if (pathname === '/api/platform/session') {
      await handlePlatformSessionRequest(request, response, { env, fetchImpl });
      return;
    }
    if (pathname.startsWith('/api/platform/')) {
      await handleUnimplementedPlatformApi(request, response, { env, fetchImpl });
      return;
    }

    // This route only bootstraps the ordinary login/auth client. It never renders a platform shell or data.
    if (pathname === '/platform/auth') {
      await serveDist(request, response, distDir);
      return;
    }

    if (pathname === '/platform' || pathname.startsWith('/platform/')) {
      const access = await checkPlatformSession(request, { env, fetchImpl });
      if (!access.ok) {
        sendPlatformDenied(response, access.status, getLanguage(request));
        return;
      }
      await serveDist({ ...request, url: '/index.html' }, response, distDir);
      return;
    }

    await serveDist(request, response, distDir);
  } catch {
    if (pathname === '/platform' || pathname.startsWith('/platform/')) {
      sendPlatformDenied(response, 503, getLanguage(request));
    } else {
      respond(response, 500, 'Unable to serve request', { 'Content-Type': 'text/plain; charset=utf-8' });
    }
  }
});

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const port = Number.parseInt(process.env.PORT ?? process.env.STAMPEE_PORT ?? '3000', 10);
  const host = process.env.HOST ?? '0.0.0.0';
  const server = createStampeeServer();
  server.listen(port, host, () => {
    process.stdout.write(`Stampee server listening on ${host}:${port}\n`);
  });
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
