// Builds a skinned model with Blender, then shrinks it with glTF Transform: src/models/<name>.glb
// Usage: npm run model:batter   (BLENDER=/path/to/blender to override; extra args go to the Blender script,
// e.g. -- --render /tmp/renders --poses poses.json)
import {execFileSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, statSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [name = 'batter', ...extra] = process.argv.slice(2);
const blender = process.env.BLENDER || '/Applications/Blender.app/Contents/MacOS/Blender';
const tmp = mkdtempSync(join(tmpdir(), 'cc-model-'));
const raw = join(tmp, 'raw.glb'), out = join(root, 'src/models', name + '.glb');
const run = (cmd, args) => execFileSync(cmd, args, {stdio: ['ignore', 'inherit', 'inherit']});

run(blender, ['-b', '--factory-startup', '--python', join(root, 'tools/blender', name + '.py'), '--', '--out', raw, ...extra]);
const gt = join(root, 'node_modules/.bin/gltf-transform');
let a = raw;
for (const [step, ...opts] of [['prune'], ['dedup'], ['quantize', '--quantize-normal', '8']]) {
  const b = join(tmp, step + '.glb');
  run(gt, [step, a, b, ...opts]);
  a = b;
}
mkdirSync(dirname(out), {recursive: true});
run(gt, ['copy', a, out]);
console.log(`${out}: ${statSync(raw).size} -> ${statSync(out).size} bytes`);
rmSync(tmp, {recursive: true, force: true});
