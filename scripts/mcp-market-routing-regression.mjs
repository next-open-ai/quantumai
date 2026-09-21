import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../packages/agent-core/src/pi-runtime.ts', import.meta.url), 'utf8');
assert.match(source, /akshare/);
// MCP availability is determined by association/configuration, never by
// hard-coded stock-language keywords in the generic agent runtime.
assert.doesNotMatch(source, /function looksLikeLiveMarketTask/);
assert.match(source, /associated MCP tools remain available/);
console.log('Market MCP routing regression passed.');
