// Before/after sheet for horizon correction: left = original mid frame, right = rotated clockwise by the
// measured tilt and scaled just enough to hide the corners (what to_capcut2 writes). One row per moment.
// Usage: node scripts/tilt_check.mjs <out.jpg> [min deg=1.5] [max deg=8]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [outJpg, lo = 1.5, hi = 8] = process.argv.slice(2);
const WORK = path.join(import.meta.dirname, '..');
const index = JSON.parse(fs.readFileSync(path.join(WORK, 'out', 'index', 'all.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(WORK, 'out', 'manifest.json'), 'utf8'));
const FONT = "fontfile='C\\:/Windows/Fonts/arial.ttf'";
const tmp = path.join(path.dirname(outJpg), 'tilt_frames');
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });
export const levelScale = deg => { const r = (Math.abs(deg) * Math.PI) / 180; return Math.cos(r) + (4 / 3) * Math.sin(r); };

const fix = index.filter(m => m.tilt?.confident && Math.abs(m.tilt.deg) >= +lo && Math.abs(m.tilt.deg) <= +hi);
fix.forEach((m, i) => {
  const c = manifest.find(x => x.file === m.file);
  const d = m.tilt.deg, s = levelScale(d).toFixed(4);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', ((m.start + m.end) / 2).toFixed(2), '-i', c.proxy ?? c.path, '-frames:v', '1', '-filter_complex',
    `[0:v]scale=240:180,split[a][b];[b]rotate=${((d * Math.PI) / 180).toFixed(5)}:ow=iw:oh=ih,scale=iw*${s}:ih*${s},crop=240:180[c];` +
    `[a]drawtext=${FONT}:text='${i + 1} ${m.clip} ${d}':x=3:y=3:fontsize=14:fontcolor=yellow:box=1:boxcolor=black@0.6[a2];[a2][c]hstack`,
    path.join(tmp, `t${String(i).padStart(2, '0')}.jpg`)]);
  console.log(i + 1, m.clip, `${m.start}-${m.end}`, 'tilt', d, 'spread', m.tilt.spread, 'share', m.tilt.share, m.desc.slice(0, 18));
});
if (fix.length) execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(tmp, 't%02d.jpg'), '-vf', `tile=4x${Math.ceil(fix.length / 4)}:padding=3`, '-frames:v', '1', '-update', '1', outJpg]);
fs.rmSync(tmp, { recursive: true, force: true });
