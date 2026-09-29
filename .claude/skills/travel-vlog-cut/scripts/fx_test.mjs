// Build a test draft that uses every catalogued transition / video anim / text anim / audio effect once,
// plus the songs in use. Open it in CapCut and hit Export once: CapCut writes the paid items it blocks to
// Cache/FeedbackOtherInfo.json (commercialization.last_block_info). fx_classify.mjs then sorts free vs paid.
// Usage: node scripts/fx_test.mjs <draft name> <song draft to copy music from>
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { CapCutDraft, DRAFTS_DIR } from '../capcut-mcp/src/core.js';

const [draftName, songDraft] = process.argv.slice(2);
const WORK = path.join(import.meta.dirname, '..');
const E = JSON.parse(fs.readFileSync(path.join(WORK, 'capcut-cli', 'src', 'enums.json'), 'utf8')).capcut;
const manifest = JSON.parse(fs.readFileSync(path.join(WORK, 'out', 'manifest.json'), 'utf8'));
const SRC = manifest.find(m => m.file.includes('_0005_D')); // 54 s of highland road, any clip works
const US = 1e6, us = s => Math.round(s * US);

const dir = path.join(DRAFTS_DIR, draftName);
fs.cpSync(dir, path.join(WORK, 'backup', `${draftName}_${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}`), { recursive: true });
const d = new CapCutDraft(draftName);
const tpl = d.templates();
if (!tpl.video || !tpl.text) throw new Error('fx_test needs one video clip and one plain text');
const songs = new CapCutDraft(songDraft);
const musicTpl = songs.templates().music ?? songs.templates().audio;
const origAudios = songs.content.materials.audios ?? [];
// fx_test has no audio of its own: borrow the song draft's audio segment and track as templates
// (otherwise core.js falls back to the video templates and builds a video-typed track)
if (musicTpl) { tpl.audio = structuredClone(musicTpl); tpl.audio.seg.common_keyframes = []; tpl.audio.refs = tpl.audio.refs.filter(r => r.k !== 'material_animations'); }
if (songs.templates().tracks.audio) tpl.tracks.audio = structuredClone(songs.templates().tracks.audio);
const c = d.content;
for (const k of Object.keys(c.materials)) if (Array.isArray(c.materials[k])) c.materials[k] = [];
c.tracks = c.tracks.filter((t, i, a) => ['video', 'text'].includes(t.type) && a.findIndex(u => u.type === t.type) === i);
for (const t of c.tracks) t.segments = [];
c.canvas_config = { ...c.canvas_config, ratio: '4:3', width: 1920, height: 1440 };
const mats = k => (c.materials[k] ??= []);
const segById = id => c.tracks.flatMap(t => t.segments).find(s => s.id === id);
const vIdx = c.tracks.findIndex(t => t.type === 'video');
const tIdx = c.tracks.findIndex(t => t.type === 'text');
const map = [];
const animBox = seg => {
  const m = { animations: [], id: randomUUID(), multi_language_current: 'none', type: 'sticker_animation' };
  mats('material_animations').push(m); seg.extra_material_refs.push(m.id); return m;
};
const anim = (m, type, materialType, segDur) => {
  const dur = Math.min(m.duration ?? m.default_duration ?? 500000, us(0.9));
  return { anim_adjust_params: null, category_id: `${type}_fav`, category_name: `${type}_fav`, duration: dur, id: m.effect_id, material_type: materialType,
    name: m.title ?? m.name ?? m.slug, panel: materialType === 'video' ? 'video' : '', path: '', platform: 'all', request_id: '', resource_id: m.resource_id,
    source_platform: 1, start: type === 'out' ? us(segDur) - dur : 0, third_resource_id: materialType === 'video' ? '0' : '', type };
};

// video: one transition between every pair of clips, plus intro/outro anims on the first clips
const nV = Math.max(E.transitions.length + 1, E.image_intros.length, E.image_outros.length);
const VD = 2.0;
for (let i = 0; i < nV; i++) {
  const { segmentId } = d.addVideo(SRC.path, { atUs: us(i * VD), durUs: us(VD), srcStartUs: us((i * 0.7) % (SRC.duration - VD - 1)), trackIndex: vIdx });
  const seg = segById(segmentId);
  seg.volume = 0; seg.common_keyframes = [];
  seg.extra_material_refs = seg.extra_material_refs.filter(r => !mats('material_animations').some(m => m.id === r));
  const box = (E.image_intros[i] || E.image_outros[i]) ? animBox(seg) : null;
  if (E.image_intros[i]) { box.animations.push(anim(E.image_intros[i], 'in', 'video', VD)); map.push({ kind: 'video_intro', ...pick(E.image_intros[i]), at: i * VD }); }
  if (E.image_outros[i]) { box.animations.push(anim(E.image_outros[i], 'out', 'video', VD)); map.push({ kind: 'video_outro', ...pick(E.image_outros[i]), at: i * VD }); }
  const t = E.transitions[i];
  if (t && i < nV - 1) {
    const id = randomUUID();
    mats('transitions').push({ category_id: '', category_name: '', duration: Math.min(t.default_duration ?? 500000, us(0.8)), effect_id: t.effect_id, id, is_overlap: t.is_overlap ?? false, name: t.name, platform: 'all', resource_id: t.resource_id, type: 'transition' });
    seg.extra_material_refs.push(id);
    map.push({ kind: 'transition', ...pick(t), at: i * VD + VD });
  }
}
for (const m of mats('videos')) m.duration = us(SRC.duration);

// text: one caption per text intro (paired with an outro); the caption shows the slugs being tested
const nT = Math.max(E.text_intros.length, E.text_outros.length);
const TD = 2.5;
for (let i = 0; i < nT; i++) {
  const a = E.text_intros[i], b = E.text_outros[i];
  const { segmentId } = d.addText(`${i + 1} ${a?.slug ?? '-'} / ${b?.slug ?? '-'}`, { atUs: us(i * TD), durUs: us(TD), trackIndex: tIdx, fontSize: 8 });
  const seg = segById(segmentId);
  seg.extra_material_refs = seg.extra_material_refs.filter(r => !mats('material_animations').some(m => m.id === r));
  const box = animBox(seg);
  if (a) { box.animations.push(anim(a, 'in', 'text', TD)); map.push({ kind: 'text_intro', ...pick(a), at: i * TD }); }
  if (b) { box.animations.push(anim(b, 'out', 'text', TD)); map.push({ kind: 'text_outro', ...pick(b), at: i * TD }); }
}

// audio: a few seconds of each song in use, then every catalogued audio effect (capcut-cli sfx shape, unverified)
if (musicTpl) {
  const aIdx = c.tracks.length;
  d.addTrack('audio', 'songs');
  let at = 0;
  for (const o of origAudios) {
    const { segmentId } = d.addAudio(o.path.replace(/\\/g, '/'), { atUs: us(at), durUs: us(10), srcStartUs: us(30), trackIndex: aIdx });
    const am = mats('audios').find(x => x.id === segById(segmentId).material_id);
    Object.assign(am, { ...structuredClone(o), id: am.id });
    map.push({ kind: 'music', name: o.name, resource_id: o.music_id ?? o.id, at });
    at += 10;
  }
}
const sfxTrack = c.tracks[d.addTrack('audio', 'sfx')];
E.audio_effects.forEach((x, i) => {
  const matId = randomUUID();
  mats('audio_effects').push({ id: matId, name: x.name, effect_id: x.effect_id, resource_id: x.resource_id, formula_id: '', is_vip: false, md5: x.md5 ?? '', type: 'sound_effect', category_id: '', category_name: '', path: '', platform: 'all', source_platform: 0, version: '' });
  sfxTrack.segments.push({ id: randomUUID(), material_id: matId, target_timerange: { start: us(30 + i * 3), duration: us(2.5) }, source_timerange: { start: 0, duration: us(2.5) }, speed: 1, volume: 1, visible: true, clip: null, extra_material_refs: [], render_index: 0 });
  map.push({ kind: 'audio_effect', ...pick(x), at: 30 + i * 3 });
});

function pick(m) { return { slug: m.slug, name: m.title ?? m.name, effect_id: m.effect_id, resource_id: m.resource_id }; }

c.duration = Math.max(...c.tracks.flatMap(t => t.segments.map(s => s.target_timerange.start + s.target_timerange.duration)));
const r = d.save();
const content = path.join(dir, 'draft_content.json');
const tl = path.join(dir, 'Timelines', c.id);
for (const m of [path.join(dir, 'template-2.tmp'), path.join(dir, 'draft_content.json.bak'), path.join(tl, 'draft_content.json'), path.join(tl, 'template-2.tmp'), path.join(tl, 'draft_content.json.bak')]) fs.copyFileSync(content, m);
fs.writeFileSync(path.join(WORK, 'out', 'fx_test_map.json'), JSON.stringify(map, null, 1));
const count = k => map.filter(x => x.kind === k).length;
console.log(`saved ${r.saved}: ${r.durationSec}s | transitions ${count('transition')}, video in ${count('video_intro')}/out ${count('video_outro')}, text in ${count('text_intro')}/out ${count('text_outro')}, music ${count('music')}, audio effects ${count('audio_effect')}`);
