// Builds a skinned model with Blender, then shrinks it with glTF Transform: src/models/<name>.glb
// Usage: npm run model:batter | npm run model:fielder   (BLENDER=/path/to/blender to override; extra args go to the
// Blender script, e.g. -- --render DIR --poses poses.json). The Blender script exports the atlas as WebP already
// (EXT_texture_webp); here: prune, dedup, quantize (positions 14 bit, normals 8, texcoords 12, weights 8: KHR_mesh_quantization), a byte report.
import {execFileSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, statSync, rmSync, readFileSync} from 'node:fs';
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
for (const [step, ...opts] of [['prune'], ['dedup', '--materials', 'false'], ['quantize', '--quantize-normal', '8', '--quantize-texcoord', '12', '--quantize-weight', '8']]) {
  const b = join(tmp, step + '.glb');
  run(gt, [step, a, b, ...opts]);
  a = b;
}
mkdirSync(dirname(out), {recursive: true});
run(gt, ['copy', a, out]);
console.log(`${out}: ${statSync(raw).size} -> ${statSync(out).size} bytes`);
report(out);
rmSync(tmp, {recursive: true, force: true});

// byte report: textures, geometry, triangles per mesh
function report(file) {
  const b = readFileSync(file), jl = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + jl).toString()), bv = j.bufferViews;
  let img = 0; for (const im of j.images || []) img += bv[im.bufferView].byteLength;
  const seen = new Set(j.accessors.map(acc => acc.bufferView).filter(v => v != null)); let geo = 0; for (const v of seen) geo += bv[v].byteLength;
  console.log(`  textures ${(img / 1024).toFixed(0)} KB (${(j.images || []).map(i => i.mimeType).join(', ') || 'none'}), geometry ${(geo / 1024).toFixed(0)} KB, json ${(jl / 1024).toFixed(0)} KB`);
  for (const m of j.meshes) console.log(`  ${m.name.padEnd(14)} ${m.primitives.map(p => `${j.materials[p.material].name} ${j.accessors[p.indices].count / 3}`).join(', ')} tris`);
}
