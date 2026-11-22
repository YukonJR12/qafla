import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const root='docs/evidence/mobile-performance';
const base=JSON.parse(await readFile(`${root}/local-base/results.json`));
const head=JSON.parse(await readFile(`${root}/local-head/results.json`));
for (const k of ['base','browser','viewport','profile','cache']) assert.equal(base[k],head[k]);
const median=a=>[...a].sort((a,b)=>a-b)[1];
const metrics=[];
for (const [name,prefix,field] of [['Fresh launch','fresh','launchMs'],['Returning launch','returning','launchMs'],['Menu usable','returning','menuMs'],['Add update','returning','addMs']]) {
 const result={name};
 for (const temp of ['cold','warm']) for (const [build,data] of [['base',base],['head',head]]) {
  const values=data.runs.filter(r=>r.id.startsWith(prefix) && r.id.endsWith(temp)).map(r=>r[field]);
  assert.equal(values.length,3); assert(values.every(Number.isFinite));
  result[`${build}_${temp}`]=Math.round(median(values)*10)/10;
 }
 metrics.push(result);
}
const result={environment:'Local next build + next start; shared live read-only Supabase backend. Server assets primed before final measurements. NOT a deployed Vercel comparison.',baseCommit:'12870f381535368cb9b50059b2b835cf3c202277',headCommit:'d5f47b4d3b9f621fa7f85cb3de2fca4382047917',browser:base.browser,viewport:base.viewport,profile:base.profile,metrics};
await writeFile(`${root}/comparison.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
