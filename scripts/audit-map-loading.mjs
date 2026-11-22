import { readFile, writeFile } from 'node:fs/promises';
const label=process.argv[2];
const dir=`docs/evidence/mobile-performance/${label}`;
const runs=JSON.parse(await readFile(`${dir}/results.json`,'utf8')).runs;
const requests=(await Promise.all(runs.map(async r=>JSON.parse(await readFile(`${dir}/${r.id}.network.json`,'utf8'))))).flat();
const urls=[...new Set(requests.filter(r=>r.type==='Script').map(r=>r.url))];
const scripts=[];
for (const url of urls) { const response=await fetch(url); const source=await response.text(); scripts.push({url,status:response.status,threeSignature:/WebGLRenderer|THREE\.REVISION|@react-three|WebGLRenderTarget/.test(source)}); }
await writeFile(`${dir}/three-audit.json`,JSON.stringify({scripts,mapRequests:requests.filter(r=>/\/map(?:\?|$)|\/park\/coded-bootcamp/.test(r.url)).map(r=>r.url)},null,2));
