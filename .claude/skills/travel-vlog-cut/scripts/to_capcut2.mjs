// Step 6 v2: music-driven cinematic cut into an existing CapCut draft.
// Uses capcut-mcp's core.js for clips/text/audio and writes transitions, animations, keyframes, speed,
// blurred background and volume curves directly, following capcut-cli's documented draft schema
// (capcut-cli/docs/draft-schema, ids from capcut-cli/src/enums.json).
// The draft must contain one video clip, one plain text and one audio clip (templates). CapCut must be closed.
// Usage: node scripts/to_capcut2.mjs <edit_plan_v2.json> <draft name> [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { CapCutDraft, DRAFTS_DIR } from '../capcut-mcp/src/core.js';

const [planPath, draftName, ...opts] = process.argv.slice(2);
const dry = opts.includes('--dry');
const WORK = path.join(import.meta.dirname, '..');
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const day = plan.name ?? plan.day.replaceAll('-', '');
// all-footage manifest, so one plan can span several days
const manifest = JSON.parse(fs.readFileSync(path.join(WORK, 'out', 'manifest.json'), 'utf8'));
const byFile = Object.fromEntries(manifest.map(m => [m.file, m]));
const bgm = JSON.parse(fs.readFileSync(path.join(WORK, 'out', 'bgm.json'), 'utf8'));
const enums = JSON.parse(fs.readFileSync(path.join(WORK, 'capcut-cli', 'src', 'enums.json'), 'utf8')).capcut;
const US = 1e6;
const us = s => Math.round(s * US);

// Verified video fade ids (capcut-cli IMAGE_ANIMS, captured from real CapCut projects)
const VIDEO_ANIMS = {
  'fade-in': { name: 'Fade In', effect_id: '6798320778182922760', resource_id: '6798320778182922760', category_id: '2037708296', third_resource_id: '6798320778182922760', type: 'in', dur: 0.8 },
  'fade-out': { name: 'Fade Out', effect_id: '6798320902548230669', resource_id: '6798320902548230669', category_id: '2037708296', third_resource_id: '0', type: 'out', dur: 1.5 },
};
const BLUR_LEVELS = [0.0625, 0.375, 0.75, 1.0];

// ---------- 1. timing: split each act by weight, snap inner cuts to strong onsets ----------
// Songs laid end to end. bgm.playlist: [{key, file, analysis, len}] (analysis = out/<file> from beats.mjs);
// otherwise bgm.file repeated bgm.repeat times. songAnchors[key] (song-relative) expand to P1_x, P2_x, ... per song.
const SONGS = [];
{
  const list = plan.bgm.playlist ?? Array.from({ length: plan.bgm.repeat ?? 1 }, () => ({ key: 'main', file: plan.bgm.file, len: plan.bgm.loopLen }));
  let off = 0;
  for (const s of list) {
    const an = s.analysis ? JSON.parse(fs.readFileSync(path.join(WORK, 'out', s.analysis), 'utf8')) : bgm;
    const len = s.len ?? an.duration;
    SONGS.push({ ...s, an, len, at: off });
    off = +(off + len).toFixed(3);
  }
}
const A = { ...plan.anchors };
SONGS.forEach((s, i) => {
  const anchors = plan.songAnchors?.[s.key] ?? (s.key === 'main' ? plan.songAnchors : null) ?? {};
  for (const [n, t] of Object.entries(anchors)) if (typeof t === 'number') A[`P${i + 1}_${n}`] = +(s.at + t).toFixed(3);
  A[`P${i + 1}_start`] = s.at;
  A[`P${i + 1}_end`] = +(s.at + s.len).toFixed(3);
});
const onsetsAll = SONGS.flatMap(s => s.an.onsets.map(o => ({ t: o.t + s.at, s: o.s })));
const snap = t => {
  let best = t, score = -Infinity;
  for (const o of onsetsAll) {
    const d = Math.abs(o.t - t);
    if (d > 0.3) continue;
    const sc = o.s - d;
    if (sc > score) { score = sc; best = o.t; }
  }
  return best;
};
const shots = [], overruns = [];
for (const act of plan.acts) {
  const a = A[act.from], b = A[act.to];
  const W = act.shots.reduce((s, x) => s + x.w, 0);
  let acc = 0;
  const cuts = [a];
  act.shots.forEach((s, i) => { acc += s.w; cuts.push(i === act.shots.length - 1 ? b : snap(a + ((b - a) * acc) / W)); });
  act.shots.forEach((s, i) => {
    const at = cuts[i], dur = cuts[i + 1] - cuts[i];
    const speed = s.speed ?? 1;
    const src = byFile[s.clip];
    let inS = s.out != null ? s.out - dur * speed : s.in;
    // planner shots carry their indexed moment's bounds: slide the in-point back rather than run past the moment
    if (s._max != null && inS + dur * speed > s._max) inS = Math.max(s._min ?? 0, s._max - dur * speed);
    // a short moment at the very end of a file: borrow from the moment before rather than run past the file
    if (s._max != null && inS + dur * speed > src.duration - 0.05) inS = Math.max(0, src.duration - 0.05 - dur * speed);
    // footage already used by an earlier shot of the same clip is never reused: push the in-point past it
    const len = dur * speed;
    const clash = t => shots.find(p => p.clip === s.clip && t < p.outS && t + len > p.inS);
    for (let c = clash(inS), n = 0; c && n < 10; c = clash(inS), n++) {
      const after = c.outS + 0.1, before = c.inS - 0.1 - len;
      // prefer the footage right after the used stretch; if that runs past the file, take what is before it
      const next = after + len <= src.duration - 0.05 && !clash(after) ? after : before >= 0 && !clash(before) ? before : null;
      if (next == null) { overruns.push(`${act.id}#${i + 1} ${s.clip.slice(20, 24)} reuses footage (no free stretch)`); break; }
      inS = next;
    }
    if (s._max != null && inS + dur * speed > s._max + 1) overruns.push(`${act.id}#${i + 1} ${s.clip.slice(20, 24)} +${(inS + dur * speed - s._max).toFixed(1)}s`);
    const outS = inS + dur * speed;
    if (dur < 1.2) throw new Error(`${act.id}#${i + 1} too short after snapping: ${dur.toFixed(2)}s`);
    if (inS < 0 || outS > src.duration) throw new Error(`${act.id}#${i + 1} ${s.clip} ${inS.toFixed(2)}-${outS.toFixed(2)} outside 0-${src.duration}`);
    shots.push({ ...s, act: act.id, idx: i + 1, at, dur, speed, inS, outS, src });
  });
}
const END = A.END;

const resolveAt = x => {
  if (typeof x === 'number') return x;
  let m = x.match(/^([A-Za-z0-9_]+?)([+-][\d.]+)?$/);
  if (m && m[1] in A) return A[m[1]] + (m[2] ? +m[2] : 0);
  m = x.match(/^shot:(.+)#(\d+)([+-][\d.]+)?$/);
  if (m) { const s = shots.find(v => v.act === m[1] && v.idx === +m[2]); if (!s) throw new Error(`no shot ${x}`); return s.at + (m[3] ? +m[3] : 0); }
  throw new Error(`bad at: ${x}`);
};

// ---------- human-readable plan ----------
const hms = t => `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(1).padStart(4, '0')}`;
const md = [`# ${plan.title ?? plan.day} 剪辑计划 v${plan.version ?? 2}（${plan.style}）`, '', `BGM：${plan.bgm.name}，用 0–${END}s，结尾 ${plan.bgm.fadeOut}s 淡出。共 ${shots.length} 个镜头。`, ''];
for (const act of plan.acts) {
  md.push(`## ${act.id}（${hms(A[act.from])}–${hms(A[act.to])}）`, '', '| 时间线 | 素材 | 源入点 | 时长 | 速度 | 运镜 | 原声 | 转场/动画 |', '|---|---|---|---|---|---|---|---|');
  for (const s of shots.filter(v => v.act === act.id)) {
    md.push(`| ${hms(s.at)} | ${s.clip.match(/_(\d{4})_D/)[1]} | ${s.inS.toFixed(1)}s | ${s.dur.toFixed(2)}s | ${s.speed}x | ${s.move ?? '-'} | ${s.vol ?? 0} | ${[s.transition?.name ?? s.transition?.slug, s.intro, s.outro, s.blurBg ? '模糊背景' : ''].filter(Boolean).join(' ') || '硬切'} |`);
  }
  md.push('');
}
md.push('## 字幕', '', ...plan.texts.map(t => `- ${hms(resolveAt(t.at))} 「${t.text}」 ${t.dur}s（${t.in} / ${t.out}）`));
fs.writeFileSync(path.join(WORK, 'out', `edit_plan_${day}_v${plan.version ?? 2}.md`), md.join('\n'));
console.log(`${shots.length} shots, ${END}s -> out/edit_plan_${day}_v${plan.version ?? 2}.md`);
if (overruns.length) console.log(`shots running past their indexed moment (>1s): ${overruns.join(", ")}`);
if (dry) process.exit(0);

// ---------- 2. draft ----------
const dir = path.join(DRAFTS_DIR, draftName);
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
fs.cpSync(dir, path.join(WORK, 'backup', `${draftName}_${stamp}`), { recursive: true });
const d = new CapCutDraft(draftName);
const tpl = d.templates();
tpl.audio ??= tpl.music; // CapCut library songs are typed "music"
for (const k of ['video', 'text', 'audio']) if (!tpl[k]) throw new Error(`draft has no ${k} template`);
// Templates are harvested from whatever the draft holds now, possibly a previous run of this script:
// strip per-shot decorations so they don't get copied onto every new segment.
for (const k of ['video', 'text', 'audio']) {
  const t = tpl[k];
  t.refs = t.refs.filter(r => !['material_animations', 'transitions'].includes(r.k));
  for (const r of t.refs) if (r.k === 'canvases') Object.assign(r.m, { type: 'canvas_color', blur: 0 });
  for (const r of t.refs) if (r.k === 'speeds') r.m.speed = 1;
  t.seg.common_keyframes = [];
  if (k === 'text') { // titles must be fully opaque whatever opacity the template text was left at
    const ct = JSON.parse(t.mat.content);
    for (const st of ct.styles ?? []) if (st.fill) st.fill.alpha = 1;
    t.mat.content = JSON.stringify(ct);
    t.mat.text_alpha = 1;
  }
  t.seg.speed = 1;
  if (t.seg.clip) Object.assign(t.seg.clip, { alpha: 1, rotation: 0, scale: { x: 1, y: 1 }, transform: { x: 0, y: 0 } });
}
const c = d.content;
// keep the songs' app-authored materials (music_id etc.) so each placed song stays linked to its library track
const origAudios = structuredClone(c.materials.audios ?? []);
for (const k of Object.keys(c.materials)) if (Array.isArray(c.materials[k])) c.materials[k] = [];
c.tracks = c.tracks.filter(t => ['video', 'text', 'audio'].includes(t.type));
c.tracks = c.tracks.filter((t, i) => c.tracks.findIndex(u => u.type === t.type) === i); // one track per type
if (plan.canvas) c.canvas_config = { ...c.canvas_config, ...plan.canvas };
for (const t of c.tracks) t.segments = [];
for (const type of ['video', 'audio', 'text']) if (!c.tracks.some(t => t.type === type)) d.addTrack(type);
const vIdx = c.tracks.findIndex(t => t.type === 'video');
const aIdx = c.tracks.findIndex(t => t.type === 'audio');
const tIdx = c.tracks.findIndex(t => t.type === 'text');
const mats = k => (c.materials[k] ??= []);
const segById = id => c.tracks.flatMap(t => t.segments).find(s => s.id === id);

const kf = (seg, property, points) => {
  seg.common_keyframes ??= [];
  seg.common_keyframes.push({
    id: randomUUID(), material_id: '', property_type: property,
    keyframe_list: points.map(([t, v]) => ({ curveType: 'Line', graphID: '', left_control: { x: 0, y: 0 }, right_control: { x: 0, y: 0 }, id: randomUUID(), time_offset: us(t), values: [v] })),
  });
};
const animContainer = seg => {
  for (const r of seg.extra_material_refs) { const m = mats('material_animations').find(x => x.id === r); if (m) { m.animations = []; return m; } }
  const m = { animations: [], id: randomUUID(), multi_language_current: 'none', type: 'sticker_animation' };
  mats('material_animations').push(m); seg.extra_material_refs.push(m.id); return m;
};

// App-authored transitions/animations captured from this draft (out/fx_library.json) take priority:
// they carry the ids and cache paths CapCut itself wrote. Fall back to capcut-cli's catalogue.
const libPath = path.join(WORK, 'out', 'fx_library.json');
const lib = fs.existsSync(libPath) ? JSON.parse(fs.readFileSync(libPath, 'utf8')) : { transitions: [], anims: {} };
const ANIM_NAMES = { 'fade-in': 'Fade In', 'fade-out': 'Fade Out', typewriter: 'Typewriter' };
// out/fx_free.json (from fx_test.mjs + fx_classify.mjs): effects CapCut blocked at export are refused here,
// so a draft never ends up needing Pro
const freePath = path.join(WORK, 'out', 'fx_free.json');
const PAID = new Set();
if (fs.existsSync(freePath)) for (const list of Object.values(JSON.parse(fs.readFileSync(freePath, 'utf8')).paid)) for (const x of list) PAID.add(String(x.resource_id));
const noPaid = (m, what) => { if (PAID.has(String(m.resource_id))) throw new Error(`${what} is a paid (Pro) effect in CapCut; pick a free one from out/fx_free.json`); return m; };
const findTransition = ({ name, slug }) => noPaid(findTransition0({ name, slug }), `transition ${name ?? slug}`);
const findTransition0 = ({ name, slug }) => {
  const app = lib.transitions.find(t => t.name === name);
  if (app) return structuredClone(app);
  const m = enums.transitions.find(x => (slug && x.slug === slug) || (name && x.name === name));
  if (!m) throw new Error(`unknown transition ${name ?? slug}`);
  return { category_id: '', category_name: '', effect_id: m.effect_id, is_overlap: m.is_overlap ?? false, name: m.name, platform: 'all', resource_id: m.resource_id, type: 'transition' };
};
const findAnim = (materialType, type, slug) => noPaid(findAnim0(materialType, type, slug), `${materialType} ${type} animation ${slug}`);
const findAnim0 = (materialType, type, slug) => {
  const app = lib.anims[`${materialType}:${type}:${ANIM_NAMES[slug] ?? slug}`];
  if (app) return structuredClone(app);
  if (materialType === 'video') {
    const a = VIDEO_ANIMS[slug];
    return { anim_adjust_params: null, category_id: a.category_id, category_name: a.category_id, id: a.effect_id, material_type: 'video', name: a.name, panel: 'video', path: '', platform: 'all', request_id: '', resource_id: a.resource_id, source_platform: 1, third_resource_id: a.third_resource_id, type };
  }
  const m = enums[type === 'in' ? 'text_intros' : 'text_outros'].find(x => x.slug === slug);
  if (!m) throw new Error(`unknown text anim ${slug}`);
  return { anim_adjust_params: null, category_id: `${type}_fav`, category_name: `${type}_fav`, id: m.effect_id, material_type: 'text', name: m.title ?? m.name ?? slug, panel: '', path: '', platform: 'all', request_id: '', resource_id: m.resource_id, source_platform: 1, third_resource_id: '', type };
};
const LOOK = { push: 0.07, pan: 0.05, panScale: 1.1, clipAudioFade: 0, ...plan.look };

// ---------- 3. video ----------
for (const s of shots) {
  const { segmentId } = d.addVideo(s.src.path, { atUs: us(s.at), durUs: us(s.dur), srcStartUs: us(s.inS), trackIndex: vIdx });
  const seg = segById(segmentId);
  seg.source_timerange.duration = us(s.dur * s.speed);
  seg.speed = s.speed;
  const spd = seg.extra_material_refs.map(r => mats('speeds').find(x => x.id === r)).find(Boolean);
  if (spd) spd.speed = s.speed;
  const T = s.dur;
  const vol = s.vol ?? 0;
  seg.volume = vol;
  seg.last_nonzero_volume = 1;
  // live sound eases in and out instead of popping on at the cut
  if (vol > 0 && LOOK.clipAudioFade > 0) {
    const f = Math.min(LOOK.clipAudioFade, T / 3);
    seg.volume = 1;
    kf(seg, 'KFTypeVolume', [[0, 0], [f, vol], [T - f, vol], [T, 0]]);
  }
  // slow camera moves
  if (s.move === 'push') kf(seg, 'UNIFORM_SCALE', [[0, 1.0], [T, 1 + LOOK.push]]);
  if (s.move === 'pull') kf(seg, 'UNIFORM_SCALE', [[0, 1 + LOOK.push], [T, 1.0]]);
  if (s.move === 'panL' || s.move === 'panR') {
    const dx = s.move === 'panR' ? LOOK.pan : -LOOK.pan;
    kf(seg, 'UNIFORM_SCALE', [[0, LOOK.panScale], [T, LOOK.panScale]]);
    kf(seg, 'KFTypePositionX', [[0, -dx], [T, dx]]);
  }
  // static fixes, e.g. a clip shot with the camera on its side: rotation in degrees clockwise, scale to fit
  if (s.rotation != null) seg.clip.rotation = s.rotation;
  if (s.scale != null) seg.clip.scale = { x: s.scale, y: s.scale };
  if (s.blurBg) {
    const cv = seg.extra_material_refs.map(r => mats('canvases').find(x => x.id === r)).find(Boolean);
    if (cv) { cv.type = 'canvas_blur'; cv.blur = BLUR_LEVELS[s.blurBg - 1]; }
  }
  for (const [key, type] of [['intro', 'in'], ['outro', 'out']]) {
    if (!s[key]) continue;
    const a = findAnim('video', type, s[key]);
    const dur = us(Math.min(VIDEO_ANIMS[s[key]]?.dur ?? 0.8, T / 2));
    animContainer(seg).animations.push({ ...a, duration: dur, start: type === 'out' ? us(T) - dur : 0 });
  }
  if (s.transition) {
    const tr = findTransition(s.transition);
    tr.id = randomUUID();
    tr.duration = us(s.transition.dur);
    mats('transitions').push(tr);
    seg.extra_material_refs.push(tr.id);
  }
}
for (const m of mats('videos')) {
  const src = manifest.find(x => x.path.replace(/\\/g, '/') === m.path);
  if (src) m.duration = us(src.duration);
}

// ---------- 4. BGM: fade in, gentle ducks, long fade out ----------
{
  const R = plan.bgm.duckRamp ?? 0.3, F = plan.bgm.fadeOut, FI = plan.bgm.fadeIn ?? 0;
  const ducks = shots.filter(v => v.duck).map(s => ({ a: s.at, b: s.at + s.dur, v: s.duck }));
  // envelope = min over duck windows (R-second ramps), times fade in/out; sampled densely so ramps stay smooth
  const env = t => {
    let g = 1;
    for (const w of ducks) {
      let k = 1;
      if (t >= w.a && t <= w.b) k = w.v;
      else if (t > w.a - R && t < w.a) k = 1 - ((1 - w.v) * (t - (w.a - R))) / R;
      else if (t > w.b && t < w.b + R) k = w.v + ((1 - w.v) * (t - w.b)) / R;
      g = Math.min(g, k);
    }
    if (FI > 0 && t < FI) g *= t / FI;
    if (t > END - F) g *= Math.max(0, (END - t) / F);
    // short fades where one song hands over to the next
    const SF = plan.bgm.songFade ?? 0;
    for (const s of SONGS.slice(1)) {
      const d0 = Math.abs(t - s.at);
      if (SF > 0 && d0 < SF) g *= d0 / SF;
    }
    return +g.toFixed(3);
  };
  const norm = p => p.replace(/\\/g, '/').toLowerCase();
  // one audio segment per song; the global envelope is sampled into each segment's own time base
  for (const s of SONGS) {
    const a = s.at, b = Math.min(END, s.at + s.len);
    if (b - a < 0.5) break;
    const { segmentId } = d.addAudio(s.file, { atUs: us(a), durUs: us(b - a), srcStartUs: 0, trackIndex: aIdx });
    const seg = segById(segmentId);
    const am = mats('audios').find(x => x.id === seg.material_id);
    const orig = origAudios.find(x => norm(x.path) === norm(s.file));
    if (am && orig) Object.assign(am, { ...structuredClone(orig), id: am.id }); // exact library metadata for this song
    else if (am && tpl.audio.mat.type) am.type = tpl.audio.mat.type;
    seg.volume = 1;
    const pts = [];
    for (let t = a; t < b; t += 0.25) pts.push([+(t - a).toFixed(2), env(t)]);
    pts.push([+(b - a).toFixed(3), env(b)]);
    // drop points that sit on a straight line between their neighbours
    const keep = pts.filter((p, i) => i === 0 || i === pts.length - 1 || Math.abs(p[1] - (pts[i - 1][1] + pts[i + 1][1]) / 2) > 1e-3);
    kf(seg, 'KFTypeVolume', keep);
  }
}

// ---------- 5. titles ----------
const TT = { corner: null, size: 12, margin: 0.06, animDur: 0.6, ...plan.titles };
const canvasAspect = c.canvas_config.width / c.canvas_config.height;
for (const t of plan.texts) {
  const at = resolveAt(t.at);
  const dur = Math.min(t.dur, END - at);
  const size = t.size ?? TT.size;
  const { segmentId } = d.addText(t.text, { atUs: us(at), durUs: us(dur), trackIndex: tIdx, fontSize: size });
  const seg = segById(segmentId);
  if (TT.corner === 'top-left') {
    // Estimated glyph box: a CJK glyph is ~0.006*size of canvas height (Latin ~55% as wide), in half-canvas units.
    // 0.0037 left long captions cut off at the left edge in CapCut 9.5, so the width is estimated generously.
    // CapCut positions a text box by its centre, and +y is up.
    const glyphH = (TT.glyph ?? 0.006) * size * 2;
    const w = [...t.text].reduce((acc, ch) => acc + (/[　-鿿＀-￯]/.test(ch) ? 1 : 0.55), 0) * glyphH / canvasAspect;
    seg.clip.transform = { x: +(-1 + TT.margin * 2 + w / 2).toFixed(4), y: +(1 - TT.margin * 2 - glyphH / 2).toFixed(4) };
  }
  const cont = animContainer(seg);
  for (const [slug, type] of [[t.in, 'in'], [t.out, 'out']]) {
    if (!slug) continue;
    const a = findAnim('text', type, slug);
    const ad = us(Math.min(type === 'in' && slug === 'typewriter' ? 1.5 : TT.animDur, dur / 2));
    cont.animations.push({ ...a, duration: ad, start: type === 'out' ? us(dur) - ad : 0 });
  }
}

// ---------- 6. save + mirror into every timeline copy ----------
c.duration = Math.max(...c.tracks.flatMap(t => t.segments.map(s => s.target_timerange.start + s.target_timerange.duration)));
const v = d.validate();
if (!v.ok) throw new Error(`validation failed: ${v.issues.join('; ')}`);
const r = d.save();
const content = path.join(dir, 'draft_content.json');
const tl = path.join(dir, 'Timelines', c.id);
for (const m of [path.join(dir, 'template-2.tmp'), path.join(dir, 'draft_content.json.bak'), path.join(tl, 'draft_content.json'), path.join(tl, 'template-2.tmp'), path.join(tl, 'draft_content.json.bak')]) fs.copyFileSync(content, m);
console.log(`saved ${r.saved}: ${r.durationSec}s | ${shots.length} clips, ${mats('transitions').length} transitions, ${plan.texts.length} titles | warnings ${v.warnings.length}`);
