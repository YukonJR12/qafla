import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve('next/package.json'))('sharp');
const root = 'docs/evidence/mobile-performance';
const results = [];
for (const label of ['revision-base', 'final-head']) for (const kind of ['fresh', 'returning']) for (let pair=1; pair<=3; pair++) {
  const run = `${kind}-${pair}-cold`;
  const network = JSON.parse(fs.readFileSync(`${root}/${label}/${run}.network.json`));
  const start = network.find(r=>r.type==='Document').start * 1000;
  const trace = JSON.parse(gunzipSync(fs.readFileSync(`${root}/${label}/${run}.trace.json.gz`)));
  let first = null;
  for (const shot of trace.traceEvents.filter(e=>e.name==='Screenshot' && e.ts/1000 >= start)) {
    const {data,info} = await sharp(Buffer.from(shot.args.snapshot,'base64')).removeAlpha().raw().toBuffer({resolveWithObject:true});
    let count=0;
    for (let y=Math.floor(info.height*.35); y<info.height*.65; y++) for(let x=Math.floor(info.width*.15); x<info.width*.85; x++) {
      const i=(y*info.width+x)*3;
      if(data[i]>160 && data[i+1]<115 && data[i+2]<80) count++;
    }
    if (count>80) { first=Math.round(shot.ts/1000-start); break; }
  }
  if(first===null) throw new Error(`No logo frame: ${label}/${run}`);
  results.push({label,run,firstCapturedLogoMs:first});
}
fs.writeFileSync(`${root}/logo-paint.json`,JSON.stringify({method:'First captured Chrome trace screenshot with the official logo red pixels in the central launch area, relative to document request start. Cold runs only; inspected filmstrips corroborate the pixel scan.',results},null,2));
console.log(results);
