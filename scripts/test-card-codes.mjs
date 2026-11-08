import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomInt } from 'node:crypto';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'lib/cardCodes.ts'), 'utf8');
const { outputText, diagnostics } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  reportDiagnostics: true,
});
assert.equal(diagnostics?.length ?? 0, 0, 'Card-code helper must transpile');
const { normalizeCardCode, parseCardReference } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
let assertions = 0;
const equal = (actual, expected, label) => { assert.deepEqual(actual, expected, label); assertions++; };

for (const [input, expected] of [
  ['547a-s5a7', '547a-s5a7'],
  ['547as5a7', '547a-s5a7'],
  [' 547A-S5A7 ', '547a-s5a7'],
  ['AB12 CD34', 'ab12-cd34'],
  ['0000-0001', '0000-0001'],
  ['00000000', '0000-0000'],
  ['ZZZZ-ZZZZ', 'zzzz-zzzz'],
]) {
  equal(normalizeCardCode(input), expected, `normalize ${input}`);
  equal(parseCardReference(input), { kind: 'code', value: expected }, `parse code ${input}`);
}

for (const input of ['', 'a', '1234567', '123456789', '1234_5678', '1234@5678', 'abcd-efgá', '😀abc-defg', "' OR 1=1 --"])
  equal(normalizeCardCode(input), null, `reject invalid code ${input}`);

const uuid = '11111111-1111-4111-8111-111111111111';
for (const input of [
  uuid,
  uuid.toUpperCase(),
  `#${uuid}`,
  `/synthetic-qa/${uuid}`,
  `/synthetic-qa/scan/${uuid}/`,
  `https://stampee.sustrae.com/synthetic-qa/${uuid}?source=qr#card`,
  `https://stampee.sustrae.com/synthetic-qa/scan/${uuid}`,
]) equal(parseCardReference(input), { kind: 'uuid', value: uuid }, `legacy UUID reference ${input}`);

for (const input of ['', 'not-a-valid-card', '1234_5678', 'https://stampee.sustrae.com/invalid', `javascript:${uuid}`, `data:text/plain,${uuid}`])
  equal(parseCardReference(input), null, `invalid reference ${input}`);

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
for (let i = 0; i < 200; i++) {
  const raw = Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join('');
  const expected = `${raw.slice(0, 4)}-${raw.slice(4)}`;
  equal(normalizeCardCode(raw), expected, 'random round trip');
  equal(parseCardReference(expected.toUpperCase()), { kind: 'code', value: expected }, 'random case-insensitive lookup');
}

// Codes are staff-facing references, never a replacement for the public UUID token.
const links = fs.readFileSync(path.join(root, 'lib/links.ts'), 'utf8');
assert.match(links, /buildPublicCardUrl[\s\S]*?uniqueId/);
assert.match(links, /buildStaffScanEntryUrl[\s\S]*?uniqueId/);
assert.doesNotMatch(links, /cardCode/);
console.log(`Card-code helper regression passed: ${assertions} cases; legacy UUID links unchanged.`);
