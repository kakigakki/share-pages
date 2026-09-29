// After fx_test was opened in CapCut, Export was clicked (and cancelled) and CapCut was closed:
// paid   = listed in Cache/FeedbackOtherInfo.json commercialization.last_block_info (newer than --since)
// free   = recognized by CapCut (it filled the material's cache path on open) and not blocked
// unknown= not recognized (id unknown to this CapCut build, or not downloaded) - do not use
// Usage: node scripts/fx_classify.mjs <draft name> [--since <ISO time of the previous block record>]
import fs from 'node:fs';
import path from 'node:path';
import { DRAFTS_DIR } from '../capcut-mcp/src/core.js';

const [draftName, , since] = process.argv.slice(2);
const WORK = path.join(import.meta.dirname, '..');
const map = JSON.parse(fs.readFileSync(path.join(WORK, 'out', 'fx_test_map.json'), 'utf8'));
const fb = JSON.parse(fs.readFileSync(path.join(DRAFTS_DIR, '..', '..', 'Cache', 'FeedbackOtherInfo.json'), 'utf8'));
const block = fb.commercialization?.last_block_info ?? {};
if (since && !(block.time > Date.parse(since))) throw new Error(`no new block record since ${since} (last one ${new Date(block.time).toISOString()}): was Export clicked?`);
const paid = new Map((block.block_svip_benefits ?? []).map(b => [String(b.resourceId), b]));

const c = JSON.parse(fs.readFileSync(path.join(DRAFTS_DIR, draftName, 'draft_content.json'), 'utf8'));
const recognized = new Set();
for (const t of c.materials.transitions ?? []) if (t.path) recognized.add(t.resource_id);
for (const m of c.materials.material_animations ?? []) for (const a of m.animations) if (a.path) recognized.add(a.resource_id);
for (const a of c.materials.audio_effects ?? []) if (a.path) recognized.add(a.resource_id);
for (const a of c.materials.audios ?? []) recognized.add(a.music_id ?? a.id);

const out = { checked_at: new Date().toISOString(), capcut_block_time: block.time ? new Date(block.time).toISOString() : null, free: {}, paid: {}, unknown: {} };
for (const e of map) {
  const bucket = paid.has(String(e.resource_id)) ? 'paid' : recognized.has(e.resource_id) ? 'free' : 'unknown';
  (out[bucket][e.kind] ??= []).push({ slug: e.slug, name: e.name, resource_id: e.resource_id, effect_id: e.effect_id, capcut_name: paid.get(String(e.resource_id))?.name });
}
fs.writeFileSync(path.join(WORK, 'out', 'fx_free.json'), JSON.stringify(out, null, 1));
for (const b of ['free', 'paid', 'unknown']) console.log(b.padEnd(8), Object.entries(out[b]).map(([k, v]) => `${k} ${v.length}`).join(' | ') || '-');
console.log(`blocked items in record: ${paid.size} -> out/fx_free.json`);
