// Region page renderer. Expects window.DATA (array of scored listings).
(function () {
  const DATA = window.DATA || [];
  const yen = n => n == null ? "—" : (n / 10000).toFixed(2).replace(/\.?0+$/, "") + " 万";
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const scoreColor = s => s >= 78 ? "var(--volt)" : s >= 70 ? "var(--ai)" : s >= 64 ? "var(--ink2)" : "var(--ink3)";
  const moveYm = d => { const m = (d.move_in || "").match(/(\d{4})年\s*(\d+)月/); return m ? +m[1] * 100 + +m[2] : 0; };
  const gmap = d => "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(d.address + (d.anon ? "" : " " + d.name));

  const MUNIS = [...new Set(DATA.map(d => d.municipality))];
  const state = { m: new Set(), t: new Set(), sort: "total" };

  const munBox = document.getElementById("munis");
  if (munBox && MUNIS.length > 1) {
    munBox.innerHTML = `<button class="f" data-m="" aria-pressed="true">全部</button>` +
      MUNIS.map(m => `<button class="f" data-m="${esc(m)}" aria-pressed="false">${esc(m)} <span style="opacity:.6">${DATA.filter(d => d.municipality === m).length}</span></button>`).join("");
    munBox.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      const m = b.dataset.m;
      if (!m) state.m.clear(); else state.m.has(m) ? state.m.delete(m) : state.m.add(m);
      munBox.querySelectorAll(".f").forEach(x => x.setAttribute("aria-pressed", x.dataset.m ? state.m.has(x.dataset.m) : state.m.size === 0));
      render();
    });
  } else if (munBox) munBox.remove();

  document.querySelectorAll("[data-t]").forEach(b => b.addEventListener("click", () => {
    const t = b.dataset.t; state.t.has(t) ? state.t.delete(t) : state.t.add(t);
    b.setAttribute("aria-pressed", state.t.has(t)); render();
  }));
  document.getElementById("sort").addEventListener("change", e => { state.sort = e.target.value; render(); });

  const NEAR = [["school", "小学"], ["nursery", "保育/幼儿园"], ["super", "超市"], ["clinic", "医院"], ["park", "公园"], ["conv", "便利店"]];
  const bar = (label, v) => `<div class="bar"><small>${label}<b>${v.toFixed(1)}</b></small><i><u style="width:${v * 10}%"></u></i></div>`;

  const siteCount = d => new Set(d.sources.map(s => s.site)).size;
  function linkLabels(d) {
    const seen = {};
    return d.sources.map(s => { seen[s.site] = (seen[s.site] || 0) + 1; return seen[s.site] > 1 ? `${s.site} ${seen[s.site]}` : s.site; });
  }
  const isRej = id => !!(Notes.get(id) && Notes.get(id).rejected);
  const openMemo = new Set();
  function memoInner(d) {
    const n = Notes.get(d.id) || { reasons: [], text: "", rejected: false };
    const open = openMemo.has(d.id);
    const sum = (n.reasons.length || n.text) && !open
      ? `<div class="memo-sum">${n.reasons.map(r => `<span class="rchip">${esc(r)}</span>`).join("")}${n.text ? `<p>${esc(n.text)}</p>` : ""}</div>` : "";
    const panel = open ? `<div class="memo-panel">
      <div class="reasons">${Notes.REASONS.map(r => `<button type="button" class="rbtn" data-reason="${esc(r)}" aria-pressed="${n.reasons.includes(r)}">${esc(r)}</button>`).join("")}</div>
      <textarea data-text rows="2" placeholder="为什么不选它？例如：看了照片厨房太小、晚上路太暗……">${esc(n.text)}</textarea>
      <div class="memo-foot"><span class="saved">自动保存在本机浏览器</span><button type="button" class="linkbtn" data-memo>收起</button></div>
    </div>` : "";
    return `<div class="memo-bar">
      <button type="button" class="rejbtn" data-rej aria-pressed="${n.rejected}">${n.rejected ? "✕ 不考虑（点击撤销）" : "✕ 不考虑"}</button>
      ${open ? "" : `<button type="button" class="linkbtn" data-memo>✎ ${n.text || n.reasons.length ? "编辑理由" : "写理由 / 备注"}</button>`}
    </div>${sum}${panel}`;
  }
  function refreshMemo(id) {
    const box = document.querySelector(`[data-memo-for="${CSS.escape(id)}"]`); if (!box) return;
    box.innerHTML = memoInner(BY_ID.get(id));
    box.closest(".card").classList.toggle("rejected", isRej(id));
    rejCount();
  }
  function rejCount() {
    const n = DATA.filter(d => isRej(d.id)).length;
    const el = document.getElementById("rejcount"); if (el) el.textContent = n ? ` ${n}` : "";
  }
  function card(d) {
    const pf = d.parkingFee;
    const real = pf == null ? `${yen(d.total_yen)}<em>停车另计</em>` : `${yen(d.total_yen + pf)}<em>含停车 ${pf ? pf.toLocaleString() + " 円" : "免费"}</em>`;
    const tags = [
      ...(d.offsite ? [`<span class="chip warn">车位不在场内</span>`] : []),
      ...(d.tags || []).filter(t => t !== "车位不在场内").map(t => `<span class="chip ${/3LDK|独栋|联排|平房/.test(t) ? "sun" : /在建|定期|告知|需确认/.test(t) ? "warn" : ""}">${esc(t)}</span>`),
      ...(siteCount(d) > 1 ? [`<span class="chip site">${siteCount(d)} 个网站在招</span>`] : []),
    ].join("");
    const sur = Array.isArray(d.surroundings) && d.surroundings.length ? d.surroundings.join("、") : "页面未记载";
    const labels = linkLabels(d);
    const links = d.sources.map((s, i) => `<a class="${i ? "" : "main"}" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(labels[i])} ↗</a>`).join("");
    const rej = isRej(d.id);
    return `<article class="card${rej ? " rejected" : ""}" id="${esc(d.id)}">
  <button class="favbtn" type="button" data-fav="${esc(d.id)}" aria-pressed="${Favs.has(d.id)}" aria-label="收藏">${Favs.has(d.id) ? "★" : "☆"}</button>
  <div class="top">
    <div class="score"><b style="color:${scoreColor(d.total)}">${d.total}</b><span>/ 100</span><div class="rk">#${d.rank}</div></div>
    <div>
      <div class="nm">${esc(d.name)}</div>
      <div class="addr">${esc(d.address.replace("神奈川県", ""))}</div>
      <div class="tags">${tags}</div>
    </div>
  </div>
  <div class="nums">
    <div><small>月租＋管理费</small><b>${yen(d.total_yen)}</b><em>${yen(d.rent)} ＋ ${d.mgmt ? d.mgmt.toLocaleString() + " 円" : "0"}</em></div>
    <div><small>实付</small><b>${real}</b></div>
    <div><small>户型 / 面积</small><b>${esc((d.layout || "").replace(/[（(].*/, ""))}</b><em>${d.area_m2}㎡ · ${esc(d.floor || "")}</em></div>
    <div><small>建成</small><b>${esc((d.built || "").replace(/[（(].*/, ""))}</b><em>${esc((d.structure || "").slice(0, 16))}</em></div>
  </div>
  <div class="bars">${bar("周边", d.env)}${bar("性价比", d.cp)}${bar("设施", d.fac)}${bar("育儿", d.kid)}</div>
  <div class="pc">${d.pros ? `<p class="pro">${esc(d.pros)}</p>` : ""}${d.cons ? `<p class="con">${esc(d.cons)}</p>` : ""}</div>
  <div class="acc">🚉 ${(d.access || []).slice(0, 2).map(esc).join(" ／ ")}</div>
  <div class="near">${NEAR.map(([k, l]) => `<span class="${d.near[k] == null ? "na" : d.near[k] <= 500 ? "ok" : d.near[k] > 1000 ? "far" : ""}">${l} <b>${d.near[k] == null ? "—" : d.near[k] >= 1000 ? (d.near[k] / 1000).toFixed(1) + "km" : d.near[k] + "m"}</b></span>`).join("")}</div>
  <div class="links">${links}<a href="${gmap(d)}" target="_blank" rel="noopener">Google 地图 ↗</a></div>
  <div class="memo" data-memo-for="${esc(d.id)}">${memoInner(d)}</div>
  <details class="more"><summary>押金・设备・周边</summary><dl>
    <dt>押金 / 礼金</dt><dd>${esc(d.deposit)} / ${esc(d.key)}</dd>
    <dt>停车位</dt><dd>${esc(d.parking)}</dd>
    <dt>朝向</dt><dd>${esc(d.direction || "未记载")}</dd>
    <dt>可入住</dt><dd>${esc(d.move_in || "未记载")}</dd>
    <dt>设备</dt><dd>${esc((d.facilities || []).join("・")) || "未记载"}</dd>
    <dt>周边</dt><dd>${esc(sur)}</dd>
    ${d.note ? `<dt>备注</dt><dd>${esc(d.note)}</dd>` : ""}
  </dl></details>
</article>`;
  }

  function render() {
    let xs = DATA.filter(d =>
      (state.m.size === 0 || state.m.has(d.municipality)) &&
      (!state.t.has("3ldk") || /3S?LDK/.test(d.layout)) &&
      (!state.t.has("walk") || d.walk <= 15) &&
      (!state.t.has("freepark") || d.parkingFee === 0) &&
      (!state.t.has("onsite") || !d.offsite) &&
      (!state.t.has("multi") || siteCount(d) > 1) &&
      (!state.t.has("fav") || Favs.has(d.id)) &&
      (!state.t.has("hiderej") || !isRej(d.id)) &&
      (!state.t.has("onlyrej") || isRej(d.id)) &&
      (!state.t.has("now") || (moveYm(d) === 0 ? /即|相談/.test(d.move_in || "") : moveYm(d) <= 202612)));
    const k = state.sort, asc = k === "monthly";
    const val = d => k === "monthly" ? d.total_yen + (d.parkingFee ?? 10000) : d[k];
    xs = xs.slice().sort((a, b) => asc ? val(a) - val(b) : val(b) - val(a));
    document.getElementById("count").textContent = `${xs.length} / ${DATA.length} 套`;
    document.getElementById("list").innerHTML = xs.length ? xs.map(card).join("") :
      `<div class="empty">${state.t.has("fav") ? "这一区还没有收藏。点卡片右上角的 ☆ 收藏。" : "没有符合的房源，减少筛选条件试试。"}</div>`;
    favCount(); rejCount();
  }
  const BY_ID = new Map(DATA.map(d => [d.id, d]));
  const LIST = document.getElementById("list");
  const idOfEl = el => el.closest("[data-memo-for]")?.dataset.memoFor;
  LIST.addEventListener("click", e => {
    const mb = e.target.closest("[data-rej],[data-memo],[data-reason]");
    if (mb) {
      const id = idOfEl(mb), d = BY_ID.get(id); if (!d) return;
      if (mb.hasAttribute("data-rej")) {
        const on = !isRej(id);
        Notes.setRejected(d, on);
        if (on) openMemo.add(id); else openMemo.delete(id);
        if (state.t.has("hiderej") || state.t.has("onlyrej")) { if (!on || state.t.has("hiderej")) { render(); return; } }
      } else if (mb.hasAttribute("data-memo")) {
        openMemo.has(id) ? openMemo.delete(id) : openMemo.add(id);
      } else {
        Notes.toggleReason(d, mb.dataset.reason);
      }
      refreshMemo(id);
      if (openMemo.has(id) && mb.hasAttribute("data-memo")) document.querySelector(`[data-memo-for="${CSS.escape(id)}"] textarea`)?.focus();
      return;
    }
    const b = e.target.closest("[data-fav]"); if (!b) return;
    const on = Favs.toggle(BY_ID.get(b.dataset.fav));
    b.setAttribute("aria-pressed", on); b.textContent = on ? "★" : "☆";
    if (state.t.has("fav") && !on) render(); else favCount();
  });
  function favCount() {
    const n = DATA.filter(d => Favs.has(d.id)).length, all = Favs.count();
    const el = document.getElementById("favcount"); if (el) el.textContent = n ? ` ${n}` : "";
    const hub = document.getElementById("favhub"); if (hub) hub.textContent = all ? `· 全县收藏 ${all} 套 →` : "";
  }
  Favs.onChange(() => { render(); });
  const timers = {};
  LIST.addEventListener("input", e => {
    const ta = e.target.closest("[data-text]"); if (!ta) return;
    const id = idOfEl(ta), d = BY_ID.get(id);
    clearTimeout(timers[id]);
    timers[id] = setTimeout(() => { Notes.setText(d, ta.value.trim()); rejCount(); }, 400);
  });
  LIST.addEventListener("focusout", e => {
    const ta = e.target.closest("[data-text]"); if (!ta) return;
    const id = idOfEl(ta); clearTimeout(timers[id]); Notes.setText(BY_ID.get(id), ta.value.trim());
  });
  Notes.onChange(kind => { if (kind === "external") render(); });
  render();
  if (location.hash) setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView(), 50);
})();
