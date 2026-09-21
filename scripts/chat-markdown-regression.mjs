import fs from 'node:fs';

const parser = fs.readFileSync('apps/renderer/src/app/project-files.ts', 'utf8');
const chat = fs.readFileSync('apps/renderer/src/features/chat/ChatWorkspace.vue', 'utf8');
for (const marker of ['chat-md-table-wrap', '<blockquote>', "nextList = ordered ? 'ol' : 'ul'", 'target="_blank"', 'noopener noreferrer']) {
  if (!parser.includes(marker)) throw new Error(`Markdown parser missing ${marker}`);
}
for (const marker of ['markdownToHtml', 'v-html="markdownToHtml(message.content)"', 'chat-markdown']) {
  if (!chat.includes(marker)) throw new Error(`Chat renderer missing ${marker}`);
}
console.log('chat markdown regression checks passed');
