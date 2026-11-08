import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const signatures = [
  ['Vercel Analytics SDK import/reference', /@vercel\/analytics/],
  ['custom telemetry call', /\btrackEvent\s*\(/],
  ['global Analytics SDK component', /<Analytics(?:\s|\/|>)/],
  ['Vercel Insights endpoint', /\/_vercel\/insights(?:\/|\b)/],
  ['Vercel global queue', /\bwindow\s*\.\s*(?:va|vaq)\b/],
  ['legacy analytics preference', /stampee_cookie_preferences_v1/],
  ['removed analytics consent options', /Allow Analytics|Essential Only/],
  ['removed telemetry event names', /Landing Viewed|Landing CTA Clicked|Landing Demo CTA Clicked|Signup Submitted|Signup Success|Login Success|Verification Email Resent/],
];
const detect = (text) => signatures.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);

// Guard the regression detector itself against silent false negatives/positives.
for (const example of [
  'import { Analytics } from "@vercel/analytics/react";',
  '<Analytics />',
  'trackEvent("Login Success", {role: "owner"})',
  'window.va("pageview")',
  '<script src="/_vercel/insights/script.js">',
  'stampee_cookie_preferences_v1',
]) assert.ok(detect(example).length > 0, `Detector missed fixture: ${example}`);
assert.deepEqual(detect('<AnalyticsPage customers={customers} campaigns={campaigns} />'), []);

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
for (const group of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
  assert.ok(!('@vercel/analytics' in (manifest[group] ?? {})), `${group} retains the SDK`);
}
const lockText = fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8');
assert.ok(!lockText.includes('@vercel/analytics'), 'Lockfile retains the SDK');
assert.ok(!fs.existsSync(path.join(root, 'lib/analytics.ts')), 'Removed telemetry wrapper still exists');
assert.ok(!fs.existsSync(path.join(root, 'components/CookiePreferencesBanner.tsx')), 'Obsolete consent component still exists');

function collect(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return collect(file);
    return /\.(?:tsx?|m?js|html|css|json)$/.test(entry.name) ? [file] : [];
  });
}
const files = [
  ...['App.tsx', 'index.tsx', 'index.html'].map((file) => path.join(root, file)),
  ...['components', 'lib', 'public'].flatMap((directory) => collect(path.join(root, directory))),
];
const failures = [];
for (const file of files) {
  for (const finding of detect(fs.readFileSync(file, 'utf8'))) {
    failures.push(`${path.relative(root, file)}: ${finding}`);
  }
}
const app = fs.readFileSync(path.join(root, 'App.tsx'), 'utf8');
assert.ok(app.includes('<AnalyticsPage'), 'Operational business analytics must remain available');
assert.ok(fs.existsSync(path.join(root, 'components/AnalyticsPage.tsx')), 'Operational analytics was removed');
assert.deepEqual(failures, [], `Telemetry remnants:\n${failures.join('\n')}`);

let bundleFiles = 0;
if (process.argv.includes('--dist')) {
  const dist = path.join(root, 'dist');
  assert.ok(fs.existsSync(path.join(dist, 'index.html')), 'Build output missing; run npm run build first');
  const bundles = collect(dist);
  assert.ok(bundles.some((file) => file.endsWith('.js')), 'Compiled JavaScript bundles missing');
  const bundleFailures = [];
  for (const file of bundles) {
    for (const finding of detect(fs.readFileSync(file, 'utf8'))) {
      bundleFailures.push(`${path.relative(root, file)}: ${finding}`);
    }
  }
  assert.deepEqual(bundleFailures, [], `Compiled telemetry remnants:\n${bundleFailures.join('\n')}`);
  bundleFiles = bundles.length;
}
console.log(`No-tracking OK: ${files.length} runtime files, package/lockfile and detector fixtures checked${bundleFiles ? `; ${bundleFiles} compiled files checked` : ''}.`);
console.log('No Vercel Analytics SDK, emitter calls, auto-pageview loader or obsolete consent UI; operational AnalyticsPage preserved.');
