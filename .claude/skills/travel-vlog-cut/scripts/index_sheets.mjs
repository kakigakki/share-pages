// Full-index prep: contact sheets for EVERY clip at one frame per STEP seconds (6x5 tiles, timestamped),
// from the LRF proxy (falls back to the original). Output: out/index_sheets/NNNN_KK.jpg + sheets.json
// Usage: node scripts/index_sheets.mjs [step=4]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const STEP = +(process.argv[2] ?? 4), COLS = 6, ROWS = 5, W = 256;
const FONT = "fontfile='C\\:/Windows/Fonts/arial.ttf'";
const WORK = path.join(import.meta.dirname, '..');
const OUT = path.join(WORK, 'out', 'index_sheets');
fs.mkdirSync(OUT, { recursive: true });
const manifest = JSON.parse(fs.readFileSync(path.join(WORK, 'out', 'manifest.json'), 'utf8'));
const per = COLS * ROWS * STEP;
const sheets = [];
const t0 = Date.now();
for (const clip of manifest) {
  const id = clip.file.match(/_(\d{4})_D/)[1];
  for (let s = 0, k = 1; s < clip.duration - 0.5; s += per, k++) {
    const out = path.join(OUT, `${id}_${String(k).padStart(2, '0')}.jpg`);
    const run = input => execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', `${s}`, '-t', `${per}`, '-i', input, '-an', '-vf',
      `fps=1/${STEP},scale=${W}:-2,drawtext=${FONT}:text='%{pts\\:hms\\:${s}}':x=4:y=4:fontsize=16:fontcolor=white:box=1:boxcolor=black@0.6,tile=${COLS}x${ROWS}:padding=2`,
      '-frames:v', '1', '-update', '1', out]);
    try { run(clip.proxy ?? clip.path); } catch { try { run(clip.path); } catch { continue; } }
    sheets.push({ image: path.basename(out), file: clip.file, clip: id, shot_local: clip.shot_local, from: s, to: +Math.min(s + per, clip.duration).toFixed(2), step: STEP });
  }
}
fs.writeFileSync(path.join(OUT, 'sheets.json'), JSON.stringify(sheets, null, 1));
console.log(`${sheets.length} sheets (${manifest.length} clips, 1 frame/${STEP}s) in ${((Date.now() - t0) / 1000).toFixed(0)}s -> out/index_sheets`);
