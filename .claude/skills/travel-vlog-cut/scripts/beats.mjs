// Beat / section analysis of a BGM file without extra deps: ffmpeg -> mono PCM -> onset envelope in Node.
// Outputs out/bgm.json: { duration, bpm, beats[], downbeats[], energy[] (per second, 0-1), sections[] }
// Usage: node scripts/beats.mjs <audio file> [out name, default bgm.json]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [file] = process.argv.slice(2);
const SR = 11025, HOP = 256, WIN = 1024;
const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', `${SR}`, '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
const x = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.byteLength / 4);
const duration = x.length / SR;

// frame energy and spectral-flux-ish onset strength (energy rise in 4 bands via simple filters)
const nF = Math.floor((x.length - WIN) / HOP);
const rms = new Float32Array(nF), onset = new Float32Array(nF);
let prevBands = [0, 0, 0, 0];
for (let f = 0; f < nF; f++) {
  const o = f * HOP;
  const bands = [0, 0, 0, 0];
  let lp1 = 0, lp2 = 0, lp3 = 0, e = 0;
  for (let i = 0; i < WIN; i++) {
    const s = x[o + i];
    lp1 += 0.05 * (s - lp1); lp2 += 0.2 * (s - lp2); lp3 += 0.5 * (s - lp3);
    bands[0] += lp1 * lp1; bands[1] += (lp2 - lp1) ** 2; bands[2] += (lp3 - lp2) ** 2; bands[3] += (s - lp3) ** 2;
    e += s * s;
  }
  rms[f] = Math.sqrt(e / WIN);
  const lb = bands.map(b => Math.log1p(1000 * b / WIN));
  onset[f] = lb.reduce((acc, v, k) => acc + Math.max(0, v - prevBands[k]), 0);
  prevBands = lb;
}
const fps = SR / HOP;

// tempo by autocorrelation of the onset envelope, 60-160 BPM
const mean = onset.reduce((a, b) => a + b, 0) / nF;
const env = onset.map(v => v - mean);
let best = { bpm: 0, score: -Infinity };
for (let bpm = 60; bpm <= 160; bpm += 0.5) {
  const lag = (60 / bpm) * fps;
  let s = 0;
  for (let i = 0; i + lag * 2 < nF; i++) s += env[i] * (env[Math.round(i + lag)] + 0.5 * env[Math.round(i + 2 * lag)]);
  if (s > best.score) best = { bpm, score: s };
}
const period = (60 / best.bpm) * fps;

// beat phase: pick the offset that maximizes onset sum on the grid, then snap each beat to a nearby peak
let phase = 0, ps = -Infinity;
for (let p = 0; p < period; p++) {
  let s = 0;
  for (let i = p; i < nF; i += period) s += onset[Math.round(i)];
  if (s > ps) { ps = s; phase = p; }
}
const beats = [];
for (let i = phase; i < nF; i += period) {
  let bi = Math.round(i), bv = -1;
  for (let j = Math.max(0, Math.round(i - period * 0.1)); j <= Math.min(nF - 1, Math.round(i + period * 0.1)); j++) if (onset[j] > bv) { bv = onset[j]; bi = j; }
  beats.push(+(bi / fps).toFixed(3));
}
// downbeats: the 4-beat phase with the strongest onsets
const strength = beats.map(t => onset[Math.round(t * fps)]);
let dPhase = 0, dBest = -1;
for (let p = 0; p < 4; p++) { let s = 0; for (let i = p; i < beats.length; i += 4) s += strength[i]; if (s > dBest) { dBest = s; dPhase = p; } }
const downbeats = beats.filter((_, i) => i % 4 === dPhase);

// loudness per second (0-1) and coarse sections where the smoothed energy changes level
const perSec = [];
for (let s = 0; s < Math.floor(duration); s++) {
  const a = Math.floor(s * fps), b = Math.floor((s + 1) * fps);
  let e = 0; for (let i = a; i < b && i < nF; i++) e += rms[i];
  perSec.push(e / (b - a));
}
const mx = Math.max(...perSec);
const energy = perSec.map(v => +(v / mx).toFixed(2));
const smooth = energy.map((_, i) => { const w = energy.slice(Math.max(0, i - 3), i + 4); return w.reduce((a, b) => a + b, 0) / w.length; });
const level = v => (v < 0.35 ? 'quiet' : v < 0.7 ? 'mid' : 'loud');
const sections = [];
for (let i = 0; i < smooth.length; i++) {
  const l = level(smooth[i]);
  if (!sections.length || sections.at(-1).level !== l) sections.push({ start: i, end: i + 1, level: l });
  else sections.at(-1).end = i + 1;
}
// merge sections shorter than 4 s into the previous one
const merged = [];
for (const s of sections) { if (merged.length && s.end - s.start < 4) merged.at(-1).end = s.end; else merged.push({ ...s }); }
// snap section starts to the nearest downbeat
for (const s of merged) { const d = downbeats.reduce((a, b) => (Math.abs(b - s.start) < Math.abs(a - s.start) ? b : a), downbeats[0] ?? s.start); s.start_snap = d; }

// strongest onsets: local maxima within ±150 ms, normalized 0-1 (cut points get snapped to these)
const omax = Math.max(...onset);
const onsets = [];
const r = Math.round(0.15 * fps);
for (let i = r; i < nF - r; i++) {
  let isPeak = true;
  for (let j = i - r; j <= i + r; j++) if (onset[j] > onset[i]) { isPeak = false; break; }
  if (isPeak && onset[i] > 0.12 * omax) onsets.push({ t: +(i / fps).toFixed(3), s: +(onset[i] / omax).toFixed(2) });
}

const rms10 = []; for (let t = 0; t < duration; t += 0.1) { const a = Math.floor(t * fps), b = Math.floor((t + 0.1) * fps); let e = 0; for (let i = a; i < b && i < nF; i++) e += rms[i]; rms10.push(+(e / Math.max(1, b - a)).toFixed(4)); }
const out = { file, duration: +duration.toFixed(2), bpm: best.bpm, beats, downbeats, onsets, energy, rms10, sections: merged };
fs.writeFileSync(path.join(import.meta.dirname, '..', 'out', process.argv[3] ?? 'bgm.json'), JSON.stringify(out, null, 1));
console.log(`duration ${out.duration}s, ~${out.bpm} BPM, ${beats.length} beats, ${downbeats.length} bars`);
console.log(merged.map(s => `${s.start_snap.toFixed(1)}s ${s.level} (${s.end - s.start}s)`).join('\n'));
