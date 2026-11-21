import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve('next/package.json'))('sharp');
const label = process.argv[2] || 'before-fast';
const run = process.argv[3] || 'fresh-1-warm';
const dir = `docs/evidence/mobile-performance/${label}`;
const { traceEvents } = JSON.parse(gunzipSync(fs.readFileSync(`${dir}/${run}.trace.json.gz`)));
const shots = traceEvents.filter(e => e.name === 'Screenshot');
const indices = [...new Set([0, ...[0.15,0.3,0.45,0.6,0.75,0.9,1].map(f => Math.round((shots.length-1)*f))])];
const tiles = [];
for (const [col,index] of indices.entries()) {
  const frame = shots[index];
  const jpg = Buffer.from(frame.args.snapshot, 'base64');
  const thumb = await sharp(jpg).resize(195,422,{fit:'contain'}).png().toBuffer();
  const ms = Math.round((frame.ts-shots[0].ts)/1000);
  tiles.push({ input: thumb, top: 30, left: col*195 });
  tiles.push({ input: Buffer.from(`<svg width="195" height="30"><text x="8" y="21" font-size="15">Frame +${ms} ms</text></svg>`), top: 0, left: col*195 });
}
await sharp({create:{width:indices.length*195,height:452,channels:4,background:'#fdfdff'}}).composite(tiles).png().toFile(`${dir}/${run}-filmstrip.png`);
console.log(`${dir}/${run}-filmstrip.png`);
