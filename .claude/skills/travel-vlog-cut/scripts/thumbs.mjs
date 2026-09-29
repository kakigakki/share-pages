// Step 4 prep: thumbnails for Claude, from the LRF proxy.
//  - long takes (> LONG sec): contact sheets, one frame per SHEET_STEP sec, 6x5 per sheet, timestamped
//  - other segments: start/mid/end frames tiled into one 3x1 strip per segment
// Usage: node scripts/thumbs.mjs <segments.json> [--sheets]   (--sheets: contact sheets for every clip, 1 frame/4 s for short ones)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const LONG = 180, SHEET_STEP = 15, COLS = 6, ROWS = 5, W = 256;
const SHEETS_ONLY = process.argv.includes("--sheets"), SHORT_STEP = 4;
const FONT = "fontfile='C\\:/Windows/Fonts/arial.ttf'";
const [segPath] = process.argv.slice(2);
const OUT = path.join(import.meta.dirname, '..', 'out', 'thumbs');
fs.mkdirSync(OUT, { recursive: true });
const { segments } = JSON.parse(fs.readFileSync(segPath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(segPath.replace(/segments_/, 'manifest_'), 'utf8'));
const ff = args => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args]);
const index = [];

for (const clip of manifest) {
  const src = clip.proxy ?? clip.path;
  const id = clip.file.match(/_(\d{4})_D/)[1];
  if (clip.duration > LONG || SHEETS_ONLY) {
    const step = clip.duration > LONG ? SHEET_STEP : SHORT_STEP;
    const per = COLS * ROWS * step;
    for (let s = 0, k = 1; s < clip.duration; s += per, k++) {
      const out = path.join(OUT, `${id}_sheet${String(k).padStart(2, '0')}.jpg`);
      const sheet = input => ff(['-ss', `${s}`, '-t', `${per}`, '-i', input, '-an', '-vf',
        `fps=1/${step},scale=${W}:-2,drawtext=${FONT}:text='%{pts\\:hms\\:${s}}':x=4:y=4:fontsize=16:fontcolor=white:box=1:boxcolor=black@0.6,tile=${COLS}x${ROWS}:padding=2`,
        '-frames:v', '1', '-update', '1', out]);
      // some LRF proxies yield no decodable frames in a window; fall back to the original, then skip
      try { sheet(src); } catch {
        try { sheet(clip.path); console.log(`proxy failed: ${clip.file} @${s}s, used original`); }
        catch { console.log(`no frames: ${clip.file} @${s}s, skipped`); continue; }
      }
      index.push({ type: 'sheet', file: clip.file, from: s, to: Math.min(s + per, clip.duration), image: path.basename(out) });
    }
  } else {
    for (const seg of segments.filter(x => x.file === clip.file)) {
      const ts = [seg.start + 0.2, (seg.start + seg.end) / 2, Math.max(seg.start, seg.end - 0.3)];
      const out = path.join(OUT, `${id}_seg${String(seg.seg).padStart(3, '0')}.jpg`);
      const inputs = ts.flatMap(t => ['-ss', t.toFixed(2), '-i', src]);
      ff([...inputs, '-filter_complex',
        ts.map((_, i) => `[${i}:v]trim=end_frame=1,scale=${W}:-2[v${i}]`).join(';') + `;[v0][v1][v2]hstack=3`,
        '-frames:v', '1', '-update', '1', out]);
      index.push({ type: 'segment', clip: seg.clip, start: seg.start, end: seg.end, flags: seg.flags, image: path.basename(out) });
    }
  }
}
fs.writeFileSync(path.join(OUT, `index_${path.basename(segPath).match(/_(\d{8})/)?.[1] ?? 'all'}.json`), JSON.stringify(index, null, 2));
console.log(`${index.length} images -> out/thumbs`);
