// Contact sheet of start/mid/end frames of every shot in an edit_plan_*_v2.md, from LRF proxies (for checking picks).
// Usage: node scripts/preview_sheet.mjs <edit_plan_v2.md> <manifest.json> <out.jpg>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const [mdPath, manPath, outJpg, perSheetArg] = process.argv.slice(2);
const PER = +(perSheetArg ?? 1e9); // shots per output image; files get _1, _2 ... when split
const md = fs.readFileSync(mdPath, 'utf8');
const man = JSON.parse(fs.readFileSync(manPath, 'utf8'));
const rows = [...md.matchAll(/^\| (\d\d:\d\d\.\d) \| (\d{4}) \| ([\d.]+)s \| ([\d.]+)s \| ([\d.]+)x/gm)];
const tmp = path.join(path.dirname(outJpg), 'frames');
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });
const font = "fontfile='C\\:/Windows/Fonts/arial.ttf'";
let k = 0;
rows.forEach((r, i) => {
  const clip = man.find(m => m.file.includes(`_${r[2]}_`));
  const a = +r[3], d = +r[4] * +r[5];
  for (const f of [0.1, 0.5, 0.95]) {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', (a + d * f).toFixed(2), '-i', clip.proxy, '-frames:v', '1',
      '-vf', `scale=200:150:force_original_aspect_ratio=decrease,pad=200:150:(ow-iw)/2:(oh-ih)/2,drawtext=${font}:text='${i + 1}':x=3:y=3:fontsize=16:fontcolor=yellow:box=1:boxcolor=black@0.6`,
      path.join(tmp, `f${String(k++).padStart(3, '0')}.jpg`)]);
  }
});
const groups = Math.ceil(rows.length / PER);
for (let g = 0; g < groups; g++) {
  const n = Math.min(PER, rows.length - g * PER) * 3;
  const out = groups > 1 ? outJpg.replace(/.jpg$/, `_${g + 1}.jpg`) : outJpg;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-start_number', `${g * PER * 3}`, '-i', path.join(tmp, 'f%03d.jpg'), '-vf', `tile=9x${Math.ceil(n / 9)}:padding=2`, '-frames:v', '1', '-update', '1', out]);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`${rows.length} shots -> ${outJpg}`);
