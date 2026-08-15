/**
 * Finds real, publicly-hosted Lottie animations by scanning open-source projects
 * that already embed them, then downloads and inspects each candidate.
 *
 * LottieFiles' website refuses automated requests, but its asset CDN serves
 * files fine once you know a URL. Public repositories are full of those URLs, so
 * GitHub code search becomes a usable index into the catalogue.
 *
 * Nothing here decides what to keep. It collects candidates and reports what
 * they are; `preview-lottie.mjs` renders them so the choice is made by looking.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '.shots/harvest');
mkdirSync(OUT, { recursive: true });

const QUERIES = [
  'assets.lottiefiles.com/packages/lf20 language:html',
  'assets1.lottiefiles.com/packages language:html',
  'assets2.lottiefiles.com/packages language:html',
  'assets3.lottiefiles.com/packages language:html',
  'assets4.lottiefiles.com/packages language:html',
  'assets5.lottiefiles.com/packages language:html',
  'assets9.lottiefiles.com/packages language:html',
  'assets10.lottiefiles.com/packages language:html',
  'lottie.host json language:html',
  'assets.lottiefiles.com/packages language:javascript',
  'assets.lottiefiles.com/packages language:jsx',
];

const URL_RE =
  /https:\/\/(?:assets\d*\.lottiefiles\.com|lottie\.host)\/[A-Za-z0-9._/%-]+\.json/g;

async function gh(args) {
  try {
    const { stdout } = await run('gh', args, { maxBuffer: 40 * 1024 * 1024 });
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

console.log('searching GitHub for embedded Lottie URLs…');

const files = new Map();
for (const q of QUERIES) {
  const res = await gh(['api', '-X', 'GET', 'search/code', '-f', `q=${q}`, '-F', 'per_page=30']);
  for (const item of res?.items ?? []) {
    const key = `${item.repository.full_name}|${item.path}`;
    if (!files.has(key)) {
      files.set(key, {
        repo: item.repository.full_name,
        path: item.path,
        branch: item.repository.default_branch || 'main',
      });
    }
  }
  // GitHub's code search endpoint is heavily rate limited.
  await new Promise((r) => setTimeout(r, 2500));
}

console.log(`  ${files.size} source files to scan`);

const urls = new Set();
let scanned = 0;

await Promise.all(
  [...files.values()].map(async (f) => {
    for (const branch of [f.branch, 'main', 'master']) {
      try {
        const res = await fetch(
          `https://raw.githubusercontent.com/${f.repo}/${branch}/${f.path}`,
          { signal: AbortSignal.timeout(15000) },
        );
        if (!res.ok) continue;
        const text = await res.text();
        scanned++;
        for (const m of text.match(URL_RE) ?? []) urls.add(m);
        return;
      } catch {
        /* try next branch */
      }
    }
  }),
);

console.log(`  scanned ${scanned} files → ${urls.size} unique Lottie URLs\n`);

if (!urls.size) {
  console.log('no URLs found');
  process.exit(0);
}

console.log('downloading and inspecting…\n');

const results = [];
for (const url of urls) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) {
      results.push({ url, ok: false, reason: `HTTP ${res.status}` });
      continue;
    }
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      results.push({ url, ok: false, reason: 'not JSON' });
      continue;
    }
    if (!data.layers || !data.w) {
      results.push({ url, ok: false, reason: 'not a Lottie' });
      continue;
    }

    const externalImages = (data.assets ?? []).filter((a) => a.p && !a.e).length;
    const missingOp = (data.layers ?? []).filter((l) => typeof l.op !== 'number').length;
    const names = (data.layers ?? []).map((l) => l.nm).filter(Boolean);

    const entry = {
      url,
      ok: externalImages === 0 && missingOp === 0,
      reason: externalImages ? 'external images' : missingOp ? 'layers missing op' : '',
      name: data.nm,
      w: data.w,
      h: data.h,
      seconds: +((data.op - data.ip) / (data.fr || 60)).toFixed(1),
      layers: data.layers.length,
      kb: +(text.length / 1024).toFixed(0),
      layerNames: names.slice(0, 10),
    };
    results.push(entry);

    if (entry.ok) {
      const file = url.split('/').pop().replace(/\.json$/, '');
      writeFileSync(join(OUT, `${file}.json`), text);
    }
  } catch (e) {
    results.push({ url, ok: false, reason: String(e.message).slice(0, 40) });
  }
}

const good = results.filter((r) => r.ok);
const bad = results.filter((r) => !r.ok);

console.log(`usable: ${good.length}   rejected: ${bad.length}\n`);
for (const r of good) {
  console.log(
    `${String(r.kb + 'KB').padStart(7)}  ${String(r.w + 'x' + r.h).padEnd(11)} ${String(r.seconds + 's').padEnd(6)} ${String(r.layers).padStart(3)}L  ${(r.name ?? '').slice(0, 26).padEnd(26)}`,
  );
  console.log(`         ${r.url}`);
  if (r.layerNames.length) console.log(`         ${r.layerNames.join(' · ').slice(0, 150)}`);
}
if (bad.length) {
  console.log('\nrejected:');
  for (const r of bad.slice(0, 12)) console.log(`  ${r.reason.padEnd(18)} ${r.url}`);
}

writeFileSync(join(OUT, '_report.json'), JSON.stringify(results, null, 2));
console.log(`\ndownloaded ${good.length} → ${OUT}`);
