// Step 2: read metadata of every MP4 (read-only) and write out/manifest.json sorted by capture time.
// Usage: node scripts/manifest.mjs <footage_dir> [yyyymmdd filter]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [src, day] = process.argv.slice(2);
if (!src) throw new Error('usage: node manifest.mjs <footage_dir> [yyyymmdd]');
const OUT = path.join(import.meta.dirname, '..', 'out');
fs.mkdirSync(OUT, { recursive: true });

const files = fs.readdirSync(src).filter(f => /\.mp4$/i.test(f) && (!day || f.includes(`_${day}`)));
const rows = files.map(f => {
  const p = path.join(src, f);
  const j = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', p]));
  const v = j.streams.find(s => s.codec_type === 'video' && s.codec_name !== 'mjpeg');
  const [n, d] = v.r_frame_rate.split('/').map(Number);
  // proxy next to the MP4 (DCIM layout) or in the trip folder's 02_代理 (01_原片/camera -> ../../02_代理)
  const lrfName = f.replace(/\.mp4$/i, '.LRF');
  const lrf = [path.join(src, lrfName), path.join(src, '..', '..', '02_代理', lrfName)].find(x => fs.existsSync(x)) ?? null;
  // DJI filenames carry local capture time: DJI_YYYYMMDDhhmmss_NNNN_D
  const m = f.match(/_(\d{8})(\d{6})_(\d{4})_/);
  return {
    file: f,
    path: p,
    proxy: lrf,
    shot_local: m ? `${m[1].slice(0, 4)}-${m[1].slice(4, 6)}-${m[1].slice(6)}T${m[2].slice(0, 2)}:${m[2].slice(2, 4)}:${m[2].slice(4)}` : null,
    creation_utc: j.format.tags?.creation_time ?? null,
    camera: j.format.tags?.encoder ?? null,
    gps: null, // Osmo Nano writes no GPS
    duration: +(+j.format.duration).toFixed(3),
    width: v.width,
    height: v.height,
    fps: +(n / d).toFixed(3),
    codec: v.codec_name,
    size_bytes: +j.format.size,
  };
}).sort((a, b) => (a.shot_local ?? '').localeCompare(b.shot_local ?? ''));

const name = day ? `manifest_${day}.json` : 'manifest.json';
fs.writeFileSync(path.join(OUT, name), JSON.stringify(rows, null, 2));
const total = rows.reduce((s, r) => s + r.duration, 0);
console.log(`${rows.length} files, ${(total / 60).toFixed(1)} min -> out/${name}`);
