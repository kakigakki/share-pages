// Auto-planner for the long cut: fills each song of a playlist with the best moments of a time window
// from out/index/all.json, in chronological order, and writes an edit plan for to_capcut2.mjs.
// The storyline (which window goes with which song, pinned hero shots, captions) comes from a spec file.
// Usage: node scripts/build_long.mjs <spec.json> <out plan.json>
import fs from 'node:fs';
import path from 'node:path';

const [specPath, outPath] = process.argv.slice(2);
const WORK = path.join(import.meta.dirname, '..');
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const index = JSON.parse(fs.readFileSync(path.join(WORK, 'out', 'index', 'all.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(WORK, 'out', 'manifest.json'), 'utf8'));
const fileOf = id => manifest.find(m => m.file.includes(`_${id}_D`)).file;
const AVG = spec.avgShot ?? 4.6;
const MOVES = ['push', 'panR', 'push', 'pull', 'panL'];
const LIVE = /吃东西|说笑|参拜|接水/;
const WATER = /溪|泉|水流|瀑/;

const plan = {
  name: spec.name, title: spec.title, version: spec.version, style: spec.style,
  canvas: spec.canvas, bgm: spec.bgm, look: spec.look, titles: spec.titles,
  songAnchors: spec.songAnchors, anchors: {}, acts: [], texts: [],
};
let off = 0, mv = 0;
const report = [];
spec.songs.forEach((song, si) => {
  const P = `P${si + 1}`;
  const item = spec.bgm.playlist[si];
  const len = item.len;
  const anchors = spec.songAnchors[item.key];
  const cuts = [0, ...Object.values(anchors).filter(t => t > 0 && t < len), len].sort((a, b) => a - b);
  const names = t => (t === 0 ? `${P}_start` : t === len ? `${P}_end` : `${P}_${Object.keys(anchors).find(k => anchors[k] === t)}`);

  // candidate pool: the song's time window, usable moments only
  const pool = index.filter(m => m.day === song.day && m.time_local >= song.from && m.time_local < song.to
    && m.score >= (song.minScore ?? 3) && m.camera !== '口袋/误拍' && m.orientation !== '倒置'
    && !(song.exclude ?? []).includes(m.clip)
    && !(spec.excludeMoments ?? []).includes(`${m.clip}@${m.start}`)
    && manifest.find(x => x.file === m.file).duration >= 4
    && !(m.score < 4 && /人脸近景/.test(m.issues ?? ""))
    && !/地名|店名|文字/.test(m.issues ?? "") && !/导览牌|导览地图|招牌|店铺入口/.test(m.desc)
    && !(m.orientation === '侧转90度' && !(song.pins ?? []).some(p => p.clip === m.clip)));
  const pins = (song.pins ?? []).map(p => ({ ...p, pinned: true }));
  // a pinned shot owns its stretch of footage: drop pool moments that overlap it
  const pinSpan = p => [p.in ?? p.out - (p.w ?? 5) * (p.speed ?? 1), (p.in ?? p.out) + (p.w ?? 5) * (p.speed ?? 1)];
  const free = pool.filter(m => !pins.some(p => { const [a, b] = pinSpan(p); return p.clip === m.clip && m.start < b && m.end > a; }));
  const nTarget = Math.round(len / (song.avgShot ?? AVG));
  // best moments first, then back into time order; pinned shots always in
  const ranked = [...free].sort((a, b) => b.score - a.score || (b.end - b.start) - (a.end - a.start));
  // at most maxPerClip shots per source clip (hero moments exempt), so one long take cannot dominate
  const perClip = {}, chosen = [];
  for (const m of ranked) {
    if (chosen.length >= Math.max(0, nTarget - pins.length)) break;
    const n = (perClip[m.clip] ?? 0) + pins.filter(p => p.clip === m.clip).length;
    if (m.score < 5 && n >= (song.maxPerClip ?? spec.maxPerClip ?? 3)) continue;
    perClip[m.clip] = (perClip[m.clip] ?? 0) + 1;
    chosen.push(m);
  }
  const shots = [
    ...chosen.map(m => ({ m, clip: m.clip, in: m.start + Math.min(0.5, (m.end - m.start) / 4), max: m.end, t: m.day + m.time_local })),
    ...pins.map(p => {
      const m = index.find(x => x.clip === p.clip && x.start <= (p.in ?? p.out - 1) && x.end > (p.in ?? p.out - 1));
      // last: true forces a pin to close the song regardless of when it was shot
      return { m, pin: p, clip: p.clip, t: p.last ? '~' : m.day + m.time_local + String(p.in ?? 0).padStart(6, '0') };
    }),
  ].sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0)); // plain code-unit order: "~" (last pins) sorts after digits

  // distribute shots over the song's sections in order, proportional to section length
  const secs = cuts.slice(0, -1).map((a, i) => ({ a, b: cuts[i + 1] }));
  let k = 0;
  secs.forEach((sec, i) => {
    const left = shots.length - k, secsLeft = secs.length - i;
    const want = i === secs.length - 1 ? left : Math.max(1, Math.min(left - (secsLeft - 1), Math.round(((sec.b - sec.a) / len) * shots.length)));
    const group = shots.slice(k, k + want);
    k += want;
    if (!group.length) return;
    const act = { id: `${song.id}·${i + 1}`, from: names(sec.a), to: names(sec.b), shots: [] };
    for (const s of group) {
      const m = s.m;
      const w = s.pin?.w ?? 4 + (m.score - 3) * 0.8;
      const shot = { clip: fileOf(s.clip), w };
      if (s.pin?.out != null) shot.out = s.pin.out; else shot.in = s.pin?.in ?? +s.in.toFixed(2);
      const speed = s.pin?.speed ?? (m.camera === '车内固定' ? 1.5 : 1);
      if (speed !== 1) shot.speed = speed;
      if (m.orientation === '竖') shot.blurBg = 3;
      if (m.orientation === '侧转90度') Object.assign(shot, { rotation: 90, scale: 0.75, blurBg: 3 });
      else shot.move = s.pin?.move ?? (m.camera === '固定' || m.camera === '车内固定' ? 'push' : MOVES[mv++ % MOVES.length]);
      if (LIVE.test((m.actions ?? []).join()) || WATER.test(m.desc)) Object.assign(shot, { vol: 0.5, duck: 0.65 });
      if (s.pin?.vol != null) shot.vol = s.pin.vol;
      if (s.pin?.intro) shot.intro = s.pin.intro;
      if (s.pin?.outro) shot.outro = s.pin.outro;
      if (!s.pin) { shot._min = m.start; shot._max = s.max; } // planner-only: bounds of the indexed moment
      shot._desc = m.desc;
      shot._actions = m.actions;
      act.shots.push(shot);
    }
    // continuous footage of one clip cut back to back reads as a jump cut: soften it with a dissolve
    act.shots.forEach((x, j) => { const y = act.shots[j + 1]; if (y && !x.transition && x.clip === y.clip && x._max != null && y._min != null && Math.abs(y._min - x._max) < 0.5) x.transition = { name: 'Dissolve', dur: 0.8 }; });
    const last = act.shots.at(-1);
    if (!last.outro) last.transition = i === secs.length - 1 ? { name: 'Black Fade', dur: 1.2 } : { name: 'Dissolve', dur: 1.0 };
    plan.acts.push(act);
  });
  // the very last song ends on a fade-out instead of a transition
  if (si === spec.songs.length - 1) { const l = plan.acts.at(-1).shots.at(-1); delete l.transition; l.outro = 'fade-out'; }
  // captions: `match` (regex on the shot's indexed description/actions) pins a caption to the first matching
  // shot of this song after the previous matched caption, so text follows the picture; `at` is the fallback
  const songShots = plan.acts.filter(a => a.id.startsWith(`${song.id}·`)).flatMap(a => a.shots.map((s, i) => ({ act: a.id, i, s })));
  let cursor = 0;
  for (const t of song.texts ?? []) {
    const { match, offset, ...rest } = t;
    let at = t.at?.replace(/^P\?/, P);
    if (match) {
      const re = new RegExp(match);
      const k = songShots.findIndex((x, j) => j >= cursor && re.test(`${x.s._desc ?? ''} ${(x.s._actions ?? []).join(' ')}`));
      if (k >= 0) { at = `shot:${songShots[k].act}#${songShots[k].i + 1}+${offset ?? 0.6}`; cursor = k + 1; }
      else console.log(`caption "${t.text}": no shot matches /${match}/, using ${at}`);
    }
    plan.texts.push({ ...rest, at });
  }
  report.push(`${P} ${item.key} ${len}s ${song.id}: pool ${pool.length}, shots ${shots.length} (${pins.length} pinned)`);
  off += len;
});
plan.anchors.END = +off.toFixed(3);
fs.writeFileSync(outPath, JSON.stringify(plan, null, 1));
console.log(report.join('\n'));
console.log(`total ${off.toFixed(1)}s, ${plan.acts.reduce((n, a) => n + a.shots.length, 0)} shots, ${plan.acts.length} acts -> ${outPath}`);
