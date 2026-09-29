// Detect talking/laughing in each indexed moment and store it in out/index/all.json (field `speech`).
// Voice band (300-3400 Hz) envelope at 50 Hz from the clip's own audio; speech shows as syllable-rate
// (3-8 Hz) modulation of that envelope, while wind, road noise and running water are steady.
// speech.score = share of envelope variance in 3-8 Hz x how far the voice band rises above its floor.
// Usage: node scripts/speech.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const WORK = path.join(import.meta.dirname, '..');
const idxPath = path.join(WORK, 'out', 'index', 'all.json');
const index = JSON.parse(fs.readFileSync(idxPath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(WORK, 'out', 'manifest.json'), 'utf8'));
const SR = 8000, HOP = 160; // 20 ms frames -> 50 Hz envelope

function band(src, a, b) {
  try {
    const buf = execFileSync('ffmpeg', ['-v', 'error', '-ss', a.toFixed(2), '-t', (b - a).toFixed(2), '-i', src, '-vn', '-ac', '1', '-ar', `${SR}`,
      '-af', 'highpass=f=300,lowpass=f=3400', '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
    return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  } catch { return null; }
}

// Voicing: share of 40 ms frames whose normalised autocorrelation peaks at an 80-400 Hz pitch lag
// (vocal-fold periodicity). Wind, footsteps and running water are aperiodic. A steady motor hum is periodic
// but never rises above the background, so only frames at least 2x the moment's quiet level are tested.
// (An envelope-modulation measure was tried first and mostly picked up footsteps and gusts.)
function analyse(x) {
  const F = 320, n = Math.floor(x.length / F);
  if (n < 25) return null;
  const rms = new Float64Array(n);
  for (let i = 0; i < n; i++) { let e = 0; for (let j = 0; j < F; j++) e += x[i * F + j] ** 2; rms[i] = Math.sqrt(e / F); }
  const sorted = [...rms].sort((a, b) => a - b);
  const floor = sorted[Math.floor(n * 0.2)] + 1e-6;
  let voiced = 0, loud = 0;
  for (let i = 0; i < n; i++) {
    if (rms[i] < floor * 2) continue;
    loud++;
    const o = i * F;
    let e0 = 0;
    for (let j = 0; j < F; j++) e0 += x[o + j] ** 2;
    let best = 0;
    for (let lag = 20; lag <= 100; lag++) {
      let r = 0, e1 = 0;
      for (let j = 0; j + lag < F; j++) { r += x[o + j] * x[o + j + lag]; e1 += x[o + j + lag] ** 2; }
      const c = r / Math.sqrt(e0 * e1 + 1e-12);
      if (c > best) best = c;
    }
    if (best > 0.55) voiced++;
  }
  return { score: +(voiced / n).toFixed(3), voicedOfLoud: loud ? +(voiced / loud).toFixed(3) : 0, loudShare: +(loud / n).toFixed(3) };
}

const t0 = Date.now();
let n = 0;
for (const m of index) {
  const clip = manifest.find(c => c.file === m.file);
  const x = band(clip.proxy ?? clip.path, m.start, Math.min(m.end, m.start + 30)); // at most 30 s per moment
  const r = x && analyse(x);
  if (r) m.speech = r;
  if (++n % 60 === 0) console.log(`${n}/${index.length}`);
}
fs.writeFileSync(idxPath, JSON.stringify(index, null, 1));
const sc = index.filter(m => m.speech).map(m => m.speech.score).sort((a, b) => a - b);
console.log(`${n} moments in ${((Date.now() - t0) / 1000).toFixed(0)}s; score p50 ${sc[Math.floor(sc.length / 2)]} p80 ${sc[Math.floor(sc.length * 0.8)]} p95 ${sc[Math.floor(sc.length * 0.95)]}`);
