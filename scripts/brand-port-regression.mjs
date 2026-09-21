import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const desktopPackage = JSON.parse(read('apps/desktop/package.json'));
const rendererPackage = JSON.parse(read('apps/renderer/package.json'));
const desktopDev = read('apps/desktop/scripts/dev.mjs');
const apiMain = read('apps/api/src/main.ts');
const rendererHtml = read('apps/renderer/index.html');

assert.equal(desktopPackage.build.productName, 'QuantumAI');
assert.match(rendererHtml, /<title>QuantumAI<\/title>/);
assert.match(rendererPackage.scripts.dev, /--port 5273\b/);
assert.match(desktopDev, /WORKMATE_API_PORT \|\| '4428'/);
assert.match(desktopDev, /http:\/\/127\.0\.0\.1:5273/);
assert.match(apiMain, /WORKMATE_API_PORT \?\? 4428/);
assert.doesNotMatch(desktopDev, /\b(?:4328|5173)\b/);

console.log('QuantumAI brand and development port regression passed.');
