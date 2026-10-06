// Favorites shared by the hub and every region page. Stored per browser in localStorage.
(function () {
  const KEY = "kanagawa-rent-2026:favs";
  let mem = {};
  function load() {
    try { const v = JSON.parse(localStorage.getItem(KEY) || "{}"); mem = v && typeof v === "object" ? v : {}; } catch (e) { /* storage blocked: keep in-memory */ }
    return mem;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* ignore */ } }
  load();
  const listeners = [];
  window.Favs = {
    all: () => Object.values(load()).sort((a, b) => b.savedAt - a.savedAt),
    has: id => !!mem[id],
    count: () => Object.keys(mem).length,
    toggle(d) {
      load();
      if (mem[d.id]) delete mem[d.id];
      else mem[d.id] = {
        id: d.id, name: d.name, region: d.region, municipality: d.municipality, total: d.total,
        total_yen: d.total_yen, parkingFee: d.parkingFee, layout: d.layout, area_m2: d.area_m2,
        url: d.sources && d.sources[0] && d.sources[0].url, savedAt: Date.now(),
      };
      save(); listeners.forEach(f => f());
      return !!mem[d.id];
    },
    remove(id) { load(); delete mem[id]; save(); listeners.forEach(f => f()); },
    onChange: f => listeners.push(f),
  };
  // other tabs
  window.addEventListener("storage", e => { if (e.key === KEY) { load(); listeners.forEach(f => f()); } });
})();

// Per-listing memo: why not this one. Stored per browser in localStorage.
(function () {
  const KEY = "kanagawa-rent-2026:notes";
  let mem = {};
  function load() {
    try { const v = JSON.parse(localStorage.getItem(KEY) || "{}"); mem = v && typeof v === "object" ? v : {}; } catch (e) { /* storage blocked */ }
    return mem;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* ignore */ } }
  load();
  const listeners = [];
  const snap = d => ({ name: d.name, region: d.region, municipality: d.municipality, total: d.total,
    total_yen: d.total_yen, layout: d.layout, area_m2: d.area_m2 });
  function upsert(d, patch) {
    load();
    const cur = mem[d.id] || { id: d.id, rejected: false, reasons: [], text: "" };
    Object.assign(cur, snap(d), patch, { updatedAt: Date.now() });
    if (!cur.rejected && !cur.text && !cur.reasons.length) delete mem[d.id]; else mem[d.id] = cur;
    save();
    return mem[d.id] || null;
  }
  window.Notes = {
    REASONS: ["太小", "太贵", "离站远", "要坐公交", "周边不方便", "车位不好", "初期费用高", "定期借家", "入住太晚", "楼层/朝向", "设备不够", "噪音/环境", "其他"],
    get: id => mem[id] || null,
    all: () => Object.values(load()).sort((a, b) => b.updatedAt - a.updatedAt),
    setRejected(d, on) { const r = upsert(d, on ? { rejected: true } : { rejected: false, reasons: [] }); listeners.forEach(f => f("rejected", d.id)); return r; },
    toggleReason(d, reason) {
      const cur = (mem[d.id] && mem[d.id].reasons) || [];
      const reasons = cur.includes(reason) ? cur.filter(x => x !== reason) : cur.concat(reason);
      const r = upsert(d, { reasons, rejected: (mem[d.id] && mem[d.id].rejected) || reasons.length > 0 });
      listeners.forEach(f => f("reason", d.id)); return r;
    },
    setText(d, text) { const r = upsert(d, { text }); listeners.forEach(f => f("text", d.id)); return r; },
    restore(id) { load(); if (mem[id]) { mem[id].rejected = false; mem[id].reasons = []; if (!mem[id].text) delete mem[id]; save(); } listeners.forEach(f => f("rejected", id)); },
    remove(id) { load(); delete mem[id]; save(); listeners.forEach(f => f("rejected", id)); },
    onChange: f => listeners.push(f),
  };
  window.addEventListener("storage", e => { if (e.key === KEY) { load(); listeners.forEach(f => f("external")); } });
})();
