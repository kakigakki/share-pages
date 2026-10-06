// Hub: render favorites saved from region pages.
(function () {
  const REG = window.REG || {};
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const yen = n => (n / 10000).toFixed(2).replace(/\.?0+$/, "") + " 万";
  const box = document.getElementById("favlist");
  if (!box) return;
  function draw() {
    const xs = Favs.all();
    box.innerHTML = xs.length ? xs.map(d => `<div class="mrow">
      <b class="sc">${d.total}</b>
      <a class="n" href="./${esc(d.region)}/#${esc(d.id)}">${esc(d.name)}<small>${esc(REG[d.region] || "")} · ${esc(d.municipality)} · ${esc((d.layout || "").replace(/[（(].*/, ""))} ${d.area_m2}㎡</small></a>
      <span class="p">${yen(d.total_yen)}<small>${d.parkingFee === 0 ? "车位免费" : d.parkingFee ? "停车 " + d.parkingFee.toLocaleString() : "停车另计"}</small></span>
      <button class="rm" type="button" data-rm="${esc(d.id)}">移除</button>
    </div>`).join("") : `<div class="favempty">还没有收藏。打开下面的区域页，点卡片右上角的 ☆。</div>`;
  }
  box.addEventListener("click", e => { const b = e.target.closest("[data-rm]"); if (b) Favs.remove(b.dataset.rm); });
  Favs.onChange(draw);
  draw();
})();

// Hub: rejected listings and reason tally.
(function () {
  const REG = window.REG || {};
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const yen = n => (n / 10000).toFixed(2).replace(/\.?0+$/, "") + " 万";
  const box = document.getElementById("rejlist"), stats = document.getElementById("rstats");
  if (!box || !window.Notes) return;
  function draw() {
    const xs = Notes.all().filter(n => n.rejected);
    const tally = {};
    xs.forEach(n => (n.reasons.length ? n.reasons : ["未选理由"]).forEach(r => tally[r] = (tally[r] || 0) + 1));
    stats.innerHTML = xs.length ? Object.entries(tally).sort((a, b) => b[1] - a[1])
      .map(([r, c]) => `<span class="rchip">${esc(r)} × ${c}</span>`).join("") : "";
    box.innerHTML = xs.length ? xs.map(n => `<div class="mrow">
      <b class="sc">${n.total}</b>
      <a class="n" href="./${esc(n.region)}/#${esc(n.id)}">${esc(n.name)}<small>${esc(REG[n.region] || "")} · ${esc(n.municipality)} · ${esc((n.layout || "").replace(/[（(].*/, ""))} ${n.area_m2}㎡ · ${yen(n.total_yen)}</small></a>
      <button class="rm" type="button" data-restore="${esc(n.id)}">恢复</button>
      <div class="why">${n.reasons.map(r => `<span class="rchip">${esc(r)}</span>`).join("")}${n.text ? esc(n.text) : ""}</div>
    </div>`).join("") : `<div class="favempty">还没有标记「不考虑」的房源。在区域页的卡片上点「✕ 不考虑」，再选理由或写备注。</div>`;
  }
  box.addEventListener("click", e => { const b = e.target.closest("[data-restore]"); if (b) { Notes.restore(b.dataset.restore); draw(); } });
  Notes.onChange(draw);
  draw();
})();
