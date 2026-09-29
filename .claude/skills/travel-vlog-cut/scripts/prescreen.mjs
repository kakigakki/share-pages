// Step 3: AI-free pre-screen. Scene-split each clip (using the LRF proxy) and flag junk segments.
// Nothing is deleted; flags go into out/segments_<day>.json.
// Usage: node scripts/prescreen.mjs <manifest.json> [--reuse]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [manifestPath, ...opts] = process.argv.slice(2);
const reuse = opts.includes('--reuse');
const OUT = path.join(import.meta.dirname, '..', 'out');
const METRICS = path.join(OUT, 'metrics');
fs.mkdirSync(METRICS, { recursive: true });

const CFG = {
  sampleFps: 4,
  sceneScore: 25,     // scdet score (0-100) that counts as a hard cut
  minSeg: 1.0,        // segments shorter than this are merged into the previous one
  maxSeg: 20,         // long takes are chopped into ~chunk-second pieces for review
  chunk: 10,
  darkYavg: 35,       // mean luma below this -> dark
  tooShort: 1.0,      // whole clip shorter than this -> accidental recording
  blurPct: 0.9,       // blur above this percentile of the day AND above blurAbs -> blurry
  blurAbs: 8,
  shakePct: 0.9,      // frame-diff jitter above this percentile AND above shakeAbs -> shaky
  shakeAbs: 12,
};

function runFfmpeg(input, outFile) {
  return new Promise((resolve, reject) => {
    const vf = `fps=${CFG.sampleFps},scale=320:-2,scdet=threshold=${CFG.sceneScore},signalstats,blurdetect=block_width=32:block_height=32,metadata=print:file='${outFile.replace(/\\/g, '/').replace(/:/g, '\\:')}'`;
    const p = spawn('ffmpeg', ['-v', 'error', '-y', '-i', input, '-an', '-vf', vf, '-f', 'null', '-']);
    let err = '';
    p.stderr.on('data', d => (err += d));
    p.on('close', c => (c === 0 ? resolve() : reject(new Error(`${input}: ${err}`))));
  });
}

function parseMetrics(txt) {
  const rows = [];
  let cur;
  for (const line of txt.split(/\r?\n/)) {
    const f = line.match(/pts_time:([\d.]+)/);
    if (f) { cur = { t: +f[1] }; rows.push(cur); continue; }
    const m = line.match(/^lavfi\.(scd\.mafd|scd\.score|signalstats\.YAVG|blur)=([\d.]+)/);
    if (m && cur) cur[{ 'scd.mafd': 'mafd', 'scd.score': 'score', 'signalstats.YAVG': 'y', blur: 'blur' }[m[1]]] = +m[2];
  }
  return rows;
}

const mean = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const std = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

async function pool(items, n, fn) {
  const q = [...items];
  await Promise.all(Array.from({ length: n }, async () => { while (q.length) await fn(q.shift()); }));
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const t0 = Date.now();
await pool(manifest, 4, async clip => {
  const mf = path.join(METRICS, clip.file.replace(/\.mp4$/i, '.txt'));
  if (reuse && fs.existsSync(mf)) return;
  await runFfmpeg(clip.proxy ?? clip.path, mf);
  console.log(`analyzed ${clip.file}`);
});
console.log(`ffmpeg pass: ${((Date.now() - t0) / 1000).toFixed(0)}s`);

// Build segments per clip
const segs = [];
for (const clip of manifest) {
  const rows = parseMetrics(fs.readFileSync(path.join(METRICS, clip.file.replace(/\.mp4$/i, '.txt')), 'utf8'));
  const cuts = [0, ...rows.filter(r => r.score >= CFG.sceneScore).map(r => r.t), clip.duration];
  const bounds = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const [a, b] = [cuts[i], cuts[i + 1]];
    if (bounds.length && b - a < CFG.minSeg) { bounds.at(-1)[1] = b; continue; }
    if (b - a > CFG.maxSeg) {
      const n = Math.round((b - a) / CFG.chunk);
      for (let k = 0; k < n; k++) bounds.push([a + ((b - a) * k) / n, a + ((b - a) * (k + 1)) / n, 'chunk']);
    } else bounds.push([a, b, 'scene']);
  }
  bounds.forEach(([start, end, kind], i) => {
    const r = rows.filter(x => x.t >= start && x.t < end);
    segs.push({
      clip: `${clip.file}#${i + 1}`, file: clip.file, seg: i + 1, kind,
      start: +start.toFixed(2), end: +end.toFixed(2), dur: +(end - start).toFixed(2),
      shot_local: clip.shot_local,
      m: { y: +mean(r.map(x => x.y)).toFixed(1), blur: +mean(r.map(x => x.blur)).toFixed(2),
           motion: +mean(r.map(x => x.mafd)).toFixed(2), jitter: +std(r.map(x => x.mafd)).toFixed(2) },
    });
  });
}

// Flags (relative thresholds are computed across the whole batch)
const blurCut = Math.max(CFG.blurAbs, pct(segs.map(s => s.m.blur), CFG.blurPct));
const shakeCut = Math.max(CFG.shakeAbs, pct(segs.map(s => s.m.jitter), CFG.shakePct));
for (const s of segs) {
  const clip = manifest.find(c => c.file === s.file);
  const f = [];
  if (clip.duration < CFG.tooShort) f.push('误录(过短)');
  if (s.m.y < CFG.darkYavg) f.push('过暗');
  if (s.m.blur > blurCut) f.push('模糊');
  if (s.m.jitter > shakeCut) f.push('晃动');
  s.flags = f;
  s.junk = f.length > 0;
}

const day = path.basename(manifestPath).match(/_(\d{8})/)?.[1] ?? 'all';
const outFile = path.join(OUT, `segments_${day}.json`);
fs.writeFileSync(outFile, JSON.stringify({ cfg: { ...CFG, blurCut, shakeCut }, segments: segs }, null, 2));
const kept = segs.filter(s => !s.junk);
const sum = a => a.reduce((x, s) => x + s.dur, 0);
console.log(`${segs.length} segments (${(sum(segs) / 60).toFixed(1)} min) -> junk ${segs.length - kept.length}, kept ${kept.length} (${(sum(kept) / 60).toFixed(1)} min)`);
console.log(`thresholds: blur>${blurCut.toFixed(2)} jitter>${shakeCut.toFixed(2)}`);
