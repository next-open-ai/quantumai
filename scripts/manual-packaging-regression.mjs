import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const manualModule = read('apps/renderer/src/app/user-manual.ts');
const manualPage = read('apps/renderer/src/features/docs/DocsPage.vue');
const desktopPackage = JSON.parse(read('apps/desktop/package.json'));

assert.match(manualModule, /manualSource\.replace\(\/\\r\\n\?\/g, '\\n'\)/);
assert.match(manualPage, /requestAnimationFrame/);
assert.match(manualPage, /正在加载用户手册/);
assert.match(manualPage, /用户手册加载失败/);
assert.ok(desktopPackage.build.files.includes('stage/renderer/**'));

for (let index = 1; index <= 6; index += 1) {
  assert.ok(existsSync(new URL(`../docs/images/user-manual-${index}-${[
    'overview', 'model-config', 'chat', 'knowledge', 'env-check', 'faq',
  ][index - 1]}.png`, import.meta.url)));
}

console.log('Cross-platform user-manual packaging regression passed.');
