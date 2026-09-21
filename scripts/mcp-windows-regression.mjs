import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../packages/agent-core/src/mcp-runtime.ts', import.meta.url), 'utf8');
assert.match(source, /process\.platform === 'win32'/);
assert.match(source, /npx: 'npx\.cmd'/);
assert.match(source, /uvx: 'uvx\.cmd'/);
console.log('Windows MCP runner regression passed.');
