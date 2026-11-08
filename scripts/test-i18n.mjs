import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const i18nRoot = path.join(root, 'lib/i18n');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'stampee-i18n-test-'));
const require = createRequire(import.meta.url);
const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => (
  entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]
));

try {
  fs.writeFileSync(path.join(temporary, 'package.json'), '{"type":"commonjs"}\n');
  const program = ts.createProgram([
    path.join(i18nRoot, 'translate.ts'),
    path.join(i18nRoot, 'language.ts'),
  ], {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    esModuleInterop: true,
    skipLibCheck: true,
    outDir: temporary,
    rootDir: i18nRoot,
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (name) => name,
    getCurrentDirectory: () => root,
    getNewLine: () => '\n',
  }));
  program.emit();
  const { translate } = require(path.join(temporary, 'translate.js'));
  const { resolveLanguage, languageLocale, LANGUAGE_STORAGE_KEY } = require(path.join(temporary, 'language.js'));
  const { spanishCatalog, catalogs } = require(path.join(temporary, 'catalog.js'));

  assert.equal(translate('es', 'Save'), 'Guardar');
  assert.equal(translate('en', 'Save'), 'Save');
  assert.equal(translate('es', '{count} items', { count: 3 }), '3 elementos');
  assert.equal(translate('en', '{count} items', { count: 3 }), '3 items');
  assert.equal(translate('es', 'Unknown business name'), 'Unknown business name');
  assert.equal(translate('es', '{count} items'), '{count} elementos');
  assert.equal(resolveLanguage('es', 'en-US'), 'es');
  assert.equal(resolveLanguage('en', 'es-PE'), 'en');
  assert.equal(resolveLanguage(null, 'es-MX'), 'es');
  assert.equal(resolveLanguage('invalid', 'en-US'), 'en');
  assert.equal(languageLocale('es'), 'es-PE');
  assert.equal(languageLocale('en'), 'en-US');
  assert.equal(LANGUAGE_STORAGE_KEY, 'stampee.ui.language');

  const placeholders = (text) => [...new Set(text.match(/\{[A-Za-z][A-Za-z0-9_]*\}/g) ?? [])].sort();
  let entries = 0;
  for (const [domain, catalog] of Object.entries(catalogs)) {
    for (const [source, translated] of Object.entries(catalog)) {
      assert.ok(source.trim() && typeof translated === 'string' && translated.trim(), `Empty translation: ${domain}/${source}`);
      assert.deepEqual(placeholders(translated), placeholders(source), `Placeholder mismatch: ${domain}/${source}`);
      entries++;
    }
  }

  const missing = [];
  let literalCalls = 0;
  const literalBranches = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
    if (ts.isConditionalExpression(node)) return [...literalBranches(node.whenTrue), ...literalBranches(node.whenFalse)];
    return [];
  };
  const files = [path.join(root, 'App.tsx'), ...walk(path.join(root, 'components')).filter((file) => file.endsWith('.tsx'))];
  for (const file of files) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 't' && node.arguments[0]) {
        for (const key of literalBranches(node.arguments[0])) {
          literalCalls++;
          if (!(key in spanishCatalog)) {
            const position = source.getLineAndCharacterOfPosition(node.getStart(source));
            missing.push(`${path.relative(root, file)}:${position.line + 1} ${key}`);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  let dynamicLabels = 0;
  for (const [relativeFile, variable, property] of [
    ['components/CardEditor.tsx', 'PALETTE_PRESETS', 'name'],
    ['lib/iconRegistry.tsx', 'ICON_OPTIONS', 'label'],
  ]) {
    const file = path.join(root, relativeFile);
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let checked = 0;
    const visit = (node) => {
      if (ts.isVariableDeclaration(node) && node.name.getText(source) === variable && node.initializer && ts.isArrayLiteralExpression(node.initializer)) {
        for (const item of node.initializer.elements) {
          if (!ts.isObjectLiteralExpression(item)) continue;
          for (const member of item.properties) {
            if (!ts.isPropertyAssignment(member) || member.name.getText(source) !== property || !ts.isStringLiteral(member.initializer)) continue;
            const key = member.initializer.text;
            if (!(key in spanishCatalog)) missing.push(`${relativeFile} ${variable}.${property}: ${key}`);
            checked++;
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    assert.ok(checked > 0, `No system labels checked in ${variable}`);
    dynamicLabels += checked;
  }
  for (const key of ['Name is required.', 'Business not found.', 'Campaign not found.', 'Unable to complete signup right now. Please try again.']) {
    assert.ok(key in spanishCatalog, `Missing public-signup error: ${key}`);
  }
  assert.deepEqual(missing, [], `Missing Spanish entries:\n${missing.join('\n')}`);
  console.log(`i18n OK: ${Object.keys(catalogs).length} catalogs, ${entries} entries, ${literalCalls} literal calls and ${dynamicLabels} registry labels checked.`);
  console.log('Language selection, locale mapping, interpolation, English fallback and placeholder parity: OK.');
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
