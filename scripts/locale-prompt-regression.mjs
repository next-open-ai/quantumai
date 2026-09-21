import fs from 'node:fs';

const source = fs.readFileSync('apps/renderer/src/app/workspace.ts', 'utf8');
for (const marker of ['document.documentElement.lang', 'The application language is English', '当前应用语言为简体中文', 'languageDirective']) {
  if (!source.includes(marker)) throw new Error(`Locale prompt directive missing: ${marker}`);
}
console.log('locale prompt regression checks passed');
