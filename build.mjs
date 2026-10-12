// Bundles src/ into a single self-contained HTML file: dist/crease-chase.html
// Usage: node build.mjs
import {readFileSync, writeFileSync, readdirSync, mkdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = p => readFileSync(join(root, p), 'utf8').replace(/\n$/, '');

const out = read('src/index.html').split('\n').map(line => {
  let m = line.match(/^\s*(?:\/\*|\/\/) @include (\S+?)(?: \*\/)?$/);
  if (m) return read(m[1]);
  m = line.match(/^\s*\/\/ @include-game (\S+)$/);
  if (m) {
    // Game modules share one closure scope, so they are concatenated in filename order inside a single IIFE.
    const files = readdirSync(join(root, m[1])).filter(f => f.endsWith('.js')).sort();
    return "(()=>{\n'use strict';\n" + files.map(f => readFileSync(join(root, m[1], f), 'utf8')).join('') + "\n})();";
  }
  return line;
}).join('\n');

mkdirSync(join(root, 'dist'), {recursive: true});
writeFileSync(join(root, 'dist/crease-chase.html'), out + '\n');
console.log(`Built dist/crease-chase.html (${(out.length / 1024).toFixed(1)} KB)`);
