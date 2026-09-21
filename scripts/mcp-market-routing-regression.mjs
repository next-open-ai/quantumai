import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../packages/agent-core/src/pi-runtime.ts', import.meta.url), 'utf8');
assert.match(source, /实时行情\|今日行情\|股价\|报价\|收盘价\|开盘价/);
assert.match(source, /akshare/);
console.log('Market MCP routing regression passed.');
