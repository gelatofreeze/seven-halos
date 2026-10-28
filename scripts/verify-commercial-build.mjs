// Fails if development-only tooling leaked into a commercial (plain `vite build`) bundle.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MARKERS = ['Grant Mourning Crescent', 'Development tools (test builds only)'];
const dir = 'dist/assets';
const leaks = [];
for (const file of readdirSync(dir)) {
  if (!file.endsWith('.js')) continue;
  const text = readFileSync(join(dir, file), 'utf8');
  for (const m of MARKERS) if (text.includes(m)) leaks.push(`${file}: "${m}"`);
}
if (leaks.length) {
  console.error('Development tools found in the commercial build:\n  ' + leaks.join('\n  '));
  process.exit(1);
}
console.log('Commercial build is free of development tools.');
