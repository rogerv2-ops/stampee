import { renderPlatformDeniedHtml } from '../../server/platform-security.mjs';

export default function handler(request, response) {
  const language = String(request.headers?.['accept-language'] ?? '').toLowerCase().startsWith('es') ? 'es' : 'en';
  response.statusCode = 403;
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store, private');
  response.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  response.end(renderPlatformDeniedHtml(403, language));
}
