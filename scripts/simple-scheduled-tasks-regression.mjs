import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const sidebar = read('apps/renderer/src/app/AppSidebar.vue');
const page = read('apps/renderer/src/features/automations/AutomationsPage.vue');
const messages = read('apps/renderer/src/app/i18n.ts');

assert.doesNotMatch(sidebar, /id:\s*'data'/);
assert.match(messages, /'nav\.automations': '定时任务'/);
assert.match(page, />定时任务</);
assert.match(page, /新建定时任务/);
assert.match(page, /编辑定时任务/);
assert.match(page, /立即执行/);
assert.doesNotMatch(page, /DataTaskDemo|TemplateTasksPanel|TaskTemplateManager/);
assert.doesNotMatch(page, /数据库任务体验|模板任务|模板配置|数据工作台/);

console.log('Simple scheduled-task navigation regression passed.');
