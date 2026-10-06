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
