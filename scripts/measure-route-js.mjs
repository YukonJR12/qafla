import { readFile, mkdir, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import vm from "node:vm";
import path from "node:path";
import { execFileSync } from "node:child_process";

// Repeat after pnpm build with the same public fixture environment and lockfile.
const output = process.argv[2];
if (!output) throw new Error("Usage: node scripts/measure-route-js.mjs output.json");
const report = { commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), method: "Unique production route entry JS plus route-local dynamic imports; per-file gzip level 9. Includes shared Next/React code. Build artifact sizes, not latency or HTTP transfer measurements.", routes: {} };
for (const [name, route] of Object.entries({ menu: "trucks/[id]", ticket: "orders/[id]", forecast: "manager" })) {
  const root = `.next/server/app/${route}`;
  const context = {};
  vm.runInNewContext(await readFile(`${root}/page_client-reference-manifest.js`, "utf8"), context);
  const manifest = Object.values(context.__RSC_MANIFEST)[0];
  const dynamic = JSON.parse(await readFile(`${root}/page/react-loadable-manifest.json`, "utf8"));
  const files = [...new Set([...Object.values(manifest.entryJSFiles).flat(), ...Object.values(dynamic).flatMap(x => x.files)])].filter(x => x.endsWith(".js")).sort();
  const sizes = await Promise.all(files.map(async file => { const bytes = await readFile(path.join(".next", file)); return { file, bytes: bytes.length, gzipBytes: gzipSync(bytes, { level: 9 }).length }; }));
  report.routes[name] = { bytes: sizes.reduce((n, x) => n + x.bytes, 0), gzipBytes: sizes.reduce((n, x) => n + x.gzipBytes, 0), files: sizes, dynamicImports: Object.keys(dynamic) };
}
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
