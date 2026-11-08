const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE_PATTERN = /^[a-z0-9]{8}$/i;

export function normalizeCardCode(value: string): string | null {
  if (typeof value !== 'string') return null;
  const compact = value.trim().replace(/[\s-]/g, '');
  if (!CODE_PATTERN.test(compact)) return null;
  const normalized = compact.toLowerCase();
  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
}

export function parseCardReference(value: string): { kind: 'code' | 'uuid'; value: string } | null {
  if (typeof value !== 'string') return null;
  const input = value.trim();
  if (!input) return null;

  // Short codes are accepted only as direct manual references, never as public-link paths.
  const directCode = normalizeCardCode(input);
  if (directCode && !/[/:?#]/.test(input)) return { kind: 'code', value: directCode };

  let raw = input;
  try {
    const url = new URL(input);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const parts = url.pathname.split('/').filter(Boolean);
    raw = parts[parts.length - 1] ?? '';
  } catch {
    raw = input;
  }
  raw = raw.replace(/^#/, '').replace(/\/+$/, '');
  const segments = raw.split('/').filter(Boolean);
  const candidate = segments[segments.length - 1] ?? raw;
  if (!UUID_PATTERN.test(candidate)) return null;
  return { kind: 'uuid', value: candidate.toLowerCase() };
}
