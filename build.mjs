// Bundles src/ into a single self-contained HTML file: dist/crease-chase.html
// Usage: node build.mjs
import {readFileSync, writeFileSync, readdirSync, mkdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const root = dirname(fileURLToPath(import.meta.url));
const read = p => readFileSync(join(root, p), 'utf8').replace(/\n$/, '');

// Game modules share one scope, so they are concatenated in filename order into one entry module that also imports
// three. esbuild bundles it (tree-shaken, minified) into a single IIFE that is inlined into the page.
async function bundleGame(dir) {
  const files = readdirSync(join(root, dir)).filter(f => f.endsWith('.js')).sort();
  const contents = "import * as THREE from 'three';\n" + files.map(f => readFileSync(join(root, dir, f), 'utf8')).join('');
  const r = await build({stdin: {contents, resolveDir: root, sourcefile: 'game.js'}, bundle: true, write: false,
    format: 'iife', minify: true, target: ['es2020', 'safari15'], banner: {js: "'use strict';"}, logLevel: 'warning'});
  return r.outputFiles[0].text.replace(/\n$/, '').replace(/<\/script/gi, '<\\/script');
}

const out = [];
for (const line of read('src/index.html').split('\n')) {
  let m = line.match(/^\s*(?:\/\*|\/\/) @include (\S+?)(?: \*\/)?$/);
  if (m) { out.push(read(m[1])); continue; }
  m = line.match(/^\s*\/\/ @include-game (\S+)$/);
  if (m) { out.push(await bundleGame(m[1])); continue; }
  m = line.match(/^\s*\/\/ @include-sfx (\S+)$/);
  if (m) {
    // Clips become base64 strings keyed by camelCased filename: const SFX_DATA={bat:'...',fwLaunch:'...'}.
    const entries = readdirSync(join(root, m[1])).filter(f => f.endsWith('.mp3')).sort().map(f =>
      `${f.slice(0, -4).replace(/-(\w)/g, (_, c) => c.toUpperCase())}:'${readFileSync(join(root, m[1], f)).toString('base64')}'`);
    out.push(`const SFX_DATA={${entries.join(',')}};`);
    continue;
  }
  out.push(line);
}
const html = out.join('\n');

mkdirSync(join(root, 'dist'), {recursive: true});
writeFileSync(join(root, 'dist/crease-chase.html'), html + '\n');
console.log(`Built dist/crease-chase.html (${(html.length / 1024).toFixed(1)} KB)`);
