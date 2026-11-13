import {
  checkPlatformSession,
  handlePlatformSessionRequest,
  handleUnimplementedPlatformApi,
  normalizeRequestPath,
  sendPlatformDenied,
} from './platform-security.mjs';

const pathnameOf = (request) => {
  try { return normalizeRequestPath(new URL(request.url ?? '/', 'http://localhost').pathname); }
  catch { return '/platform'; }
};

const languageOf = (request) => {
  const value = request.headers?.['accept-language'];
  return typeof value === 'string' && value.toLowerCase().startsWith('es') ? 'es' : 'en';
};

export const platformSecurityPlugin = ({ env = process.env, fetchImpl = fetch } = {}) => {
  const middleware = (request, response, next) => {
    const pathname = pathnameOf(request);
    const run = async () => {
      if (pathname === '/api/platform/session') {
        await handlePlatformSessionRequest(request, response, { env, fetchImpl });
        return;
      }
      if (pathname.startsWith('/api/platform/')) {
        await handleUnimplementedPlatformApi(request, response, { env, fetchImpl });
        return;
      }
      if (pathname === '/platform/auth') {
        next();
        return;
      }
      if (pathname === '/platform' || pathname.startsWith('/platform/')) {
        const result = await checkPlatformSession(request, { env, fetchImpl });
        if (!result.ok) {
          sendPlatformDenied(response, result.status, languageOf(request));
          return;
        }
      }
      next();
    };
    void run().catch(() => {
      if (pathname === '/platform' || pathname.startsWith('/platform/')) {
        sendPlatformDenied(response, 503, languageOf(request));
      } else {
        response.writeHead(503, {
          'Cache-Control': 'no-store, private',
          'Content-Type': 'application/json; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
        });
        response.end(JSON.stringify({ error: 'ACCESS_CHECK_UNAVAILABLE' }));
      }
    });
  };

  return {
    name: 'stampee-platform-server-authorization',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
};
