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
