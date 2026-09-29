// Estimate horizon tilt for every indexed moment and store it in out/index/all.json (field `tilt`, degrees).
// 3 frames per moment from the LRF proxy, 320x240 grey; Sobel gradients in the central 60% of the frame
// (the wide lens bends lines near the edges); near-horizontal and near-vertical edges vote for the
// rotation that would make them level/plumb. tilt > 0: picture is rotated counter-clockwise, so correcting
// it means rotating clockwise by `tilt` (CapCut rotation is clockwise-positive).
// Usage: node scripts/tilt.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const WORK = path.join(import.meta.dirname, '..');
const idxPath = path.join(WORK, 'out', 'index', 'all.json');
const index = JSON.parse(fs.readFileSync(idxPath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(WORK, 'out', 'manifest.json'), 'utf8'));
const W = 320, H = 240;

function frame(src, t) {
  try {
    return execFileSync('ffmpeg', ['-v', 'error', '-ss', t.toFixed(2), '-i', src, '-frames:v', '1', '-vf', `scale=${W}:${H},format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: W * H * 2 });
  } catch { return null; }
}

// weighted histogram of edge deviations from level/plumb, in 0.25 degree bins over +-12 degrees
function tiltOf(px) {
  const bins = new Float64Array(97);
  for (let y = Math.floor(H * 0.2); y < H * 0.8; y++) for (let x = Math.floor(W * 0.2); x < W * 0.8; x++) {
    const p = (dx, dy) => px[(y + dy) * W + x + dx];
    const gx = p(1, -1) + 2 * p(1, 0) + p(1, 1) - p(-1, -1) - 2 * p(-1, 0) - p(-1, 1);
    const gy = p(-1, 1) + 2 * p(0, 1) + p(1, 1) - p(-1, -1) - 2 * p(0, -1) - p(1, -1);
    const mag = Math.hypot(gx, gy);
    if (mag < 120) continue;
    // edge direction is perpendicular to the gradient; fold into [-45, 45) around level/plumb
    let a = (Math.atan2(gy, gx) * 180) / Math.PI + 90;
    a = ((a % 90) + 135) % 90 - 45;
    if (Math.abs(a) > 12) continue;
    bins[Math.round((a + 12) * 4)] += mag;
  }
  let best = 0, bi = 48;
  for (let i = 2; i < 95; i++) { const s = bins[i - 2] + bins[i - 1] + bins[i] + bins[i + 1] + bins[i + 2]; if (s > best) { best = s; bi = i; } }
  const total = bins.reduce((a, b) => a + b, 0);
  // y grows downwards, so an edge measured at +a degrees is a counter-clockwise tilt of the picture by a
  return { deg: bi / 4 - 12, share: total ? best / total : 0 };
}

const t0 = Date.now();
let n = 0;
for (const m of index) {
  const clip = manifest.find(c => c.file === m.file);
  const src = clip.proxy ?? clip.path;
  const len = m.end - m.start;
  const reads = [0.2, 0.5, 0.8].map(f => frame(src, m.start + len * f)).filter(Boolean).map(tiltOf);
  if (!reads.length) continue;
  const degs = reads.map(r => r.deg).sort((a, b) => a - b);
  const med = degs[Math.floor(degs.length / 2)];
  const spread = degs.at(-1) - degs[0];
  const share = reads.reduce((a, r) => a + r.share, 0) / reads.length;
  // confident: frames agree within 1.5 degrees and the winning angle carries a real share of the edges
  m.tilt = { deg: +med.toFixed(2), spread: +spread.toFixed(2), share: +share.toFixed(2), confident: spread <= 1.5 && share >= 0.12 };
  if (++n % 50 === 0) console.log(`${n}/${index.length}`);
}
fs.writeFileSync(idxPath, JSON.stringify(index, null, 1));
const fix = index.filter(m => m.tilt?.confident && Math.abs(m.tilt.deg) >= 1.5 && Math.abs(m.tilt.deg) <= 8);
console.log(`${n} moments measured in ${((Date.now() - t0) / 1000).toFixed(0)}s; ${fix.length} confidently tilted 1.5-8 deg`);
