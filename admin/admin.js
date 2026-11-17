/* WGS admin MOCKUP. All numbers are sample data, and nothing is saved anywhere. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const toast = (msg) => { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2600); };

  /* ── sample data ── */
  const START = new Date("2026-11-04T00:00:00");
  const visits = [118, 132, 125, 141, 156, 149, 163, 171, 402, 388, 341, 297, 276, 301];
  const taps   = [  9,  11,  10,  12,  13,  12,  14,  15,  44,  41,  35,  29,  27,  31];
  const day = (i) => new Date(START.getTime() + i * 864e5);
  const dShort = (d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const EVENT_I = 8; // 12 Nov, double CP starts

  const PKGS = [
    { cp: 800, bonus: 800, kes: 1350, tzs: 27000, tag: "" },
    { cp: 2000, bonus: 2000, kes: 3500, tzs: 70000, tag: "" },
    { cp: 4000, bonus: 4000, kes: 6500, tzs: 130000, tag: "Most popular" },
    { cp: 8000, bonus: 8000, kes: 12000, tzs: 240000, tag: "Best value" }
  ];
  const TZS_PER_KES = 20;
  const pkgName = (p) => `${fmt(p.cp)} + ${fmt(p.bonus)} CP`;
  const sales = [
    { pkg: 2, pay: "M-Pesa", cty: "KE", amt: 6500, buyer: "Kevin", t: "2026-11-17T14:20" },
    { pkg: 0, pay: "M-Pesa", cty: "KE", amt: 1350, buyer: "", t: "2026-11-17T11:05" },
    { pkg: 3, pay: "Binance", cty: "KE", amt: 12000, buyer: "Sam", t: "2026-11-16T21:40" },
    { pkg: 1, pay: "M-Pesa", cty: "TZ", amt: 70000, buyer: "Neema", t: "2026-11-16T18:12" },
    { pkg: 2, pay: "M-Pesa", cty: "KE", amt: 6500, buyer: "", t: "2026-11-16T09:30" },
    { pkg: 0, pay: "Bank", cty: "KE", amt: 1350, buyer: "Ali", t: "2026-11-15T20:02" },
    { pkg: 2, pay: "PayPal", cty: "KE", amt: 6500, buyer: "", t: "2026-11-15T16:45" },
    { pkg: 1, pay: "M-Pesa", cty: "KE", amt: 3500, buyer: "Brian", t: "2026-11-14T13:10" },
    { pkg: 3, pay: "M-Pesa", cty: "KE", amt: 12000, buyer: "", t: "2026-11-13T22:31" },
    { pkg: 0, pay: "M-Pesa", cty: "TZ", amt: 27000, buyer: "", t: "2026-11-13T10:15" }
  ];
  const toKES = (s) => s.cty === "TZ" ? s.amt / TZS_PER_KES : s.amt;

  /* ── tabs ── */
  function show(tab) {
    $$(".tabs button").forEach((b) => b.dataset.tab === tab ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current"));
    $$("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== tab));
    scrollTo(0, 0);
    if (tab === "overview") drawTrend();
  }
  $$(".tabs button").forEach((b) => b.addEventListener("click", () => show(b.dataset.tab)));

  /* ── overview ── */
  let range = 14;
  $$(".range button").forEach((b) => b.addEventListener("click", () => {
    range = Number(b.dataset.range);
    $$(".range button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    renderOverview();
  }));

  const sum = (a) => a.reduce((s, x) => s + x, 0);
  function delta(cur, prev) {
    if (!prev) return "";
    const p = (cur - prev) / prev * 100;
    return `<span class="${p >= 0 ? "up" : "down"}">${p >= 0 ? "▲" : "▼"} ${Math.abs(p).toFixed(0)}%</span> vs previous 7 days`;
  }
  function renderOverview() {
    const v = visits.slice(-range), t = taps.slice(-range);
    const pv = range === 7 ? sum(visits.slice(0, 7)) : 0, pt = range === 7 ? sum(taps.slice(0, 7)) : 0;
    $("#k-visits").textContent = fmt(sum(v));
    $("#k-visits-d").innerHTML = delta(sum(v), pv) || `last ${range} days`;
    $("#k-taps").textContent = fmt(sum(t));
    $("#k-taps-d").innerHTML = delta(sum(t), pt) || `last ${range} days`;
    $("#k-rate").textContent = (sum(t) / sum(v) * 100).toFixed(1) + "%";
    renderMoney();
    const total = sum(v);
    bars("#b-pkg", PKGS.map((p, i) => [pkgName(p), [98, 71, 92, 46][i] * range / 14]), (x) => fmt(x) + " taps");
    bars("#b-src", [["TikTok", .46], ["WhatsApp status", .31], ["Google", .12], ["Direct / other", .11]].map(([k, s]) => [k, s * total]), (x) => fmt(x));
    bars("#b-cty", [["Kenya", .78], ["Tanzania", .22]].map(([k, s]) => [k, s * total]), (x) => `${fmt(x)} · ${Math.round(x / total * 100)}%`);
    drawTrend();
  }
  function renderMoney() {
    const wk = sales.filter((s) => new Date(s.t) >= new Date("2026-11-11T00:00"));
    $("#k-rev").textContent = "KSH " + fmt(sum(wk.map(toKES)));
    $("#k-rev-d").textContent = `${wk.length} sales this week`;
  }
  function bars(sel, rows, label) {
    const max = Math.max(...rows.map((r) => r[1]));
    $(sel).innerHTML = rows.map(([k, x]) => `
      <div class="bar"><span>${esc(k)}</span><span class="v">${label(x)}</span>
        <div class="track"><div class="fill" style="width:${(x / max * 100).toFixed(1)}%"></div></div></div>`).join("");
  }

  /* trend: two stacked panels (visitors, order taps) sharing one time axis, each with its own scale */
  function drawTrend() {
    const box = $("#trend");
    if (!box || box.closest("[hidden]")) return;
    const off = visits.length - range;
    const V = visits.slice(off), T = taps.slice(off);
    const W = Math.max(320, box.clientWidth), PH = 104, GAP = 34, L = 34, R = 74, TOP = 18;
    const H = TOP + PH * 2 + GAP + 26;
    const x = (i) => L + (W - L - R) * (i / (V.length - 1));
    const nice = (m) => { const s = Math.pow(10, Math.floor(Math.log10(m))); return Math.ceil(m / s) * s; };
    const panels = [
      { data: V, cls: "1", name: "Visitors", y0: TOP, max: nice(Math.max(...V)) },
      { data: T, cls: "2", name: "Order taps", y0: TOP + PH + GAP, max: nice(Math.max(...T)) }
    ];
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily visitors and order taps, last ${range} days">`;
    panels.forEach((p) => {
      const y = (v) => p.y0 + PH - v / p.max * PH;
      s += `<text class="ax" x="${L}" y="${p.y0 - 6}" style="fill:var(--text);font-weight:600">${p.name}</text>`;
      [0, .5, 1].forEach((f) => { const yy = y(p.max * f); s += `<line class="gl" x1="${L}" x2="${W - R + 8}" y1="${yy}" y2="${yy}"/><text class="ax" x="${L - 6}" y="${yy + 4}" text-anchor="end">${fmt(p.max * f)}</text>`; });
      const pts = p.data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
      if (p.cls === "1") s += `<path class="a1" d="M${x(0)},${y(0)} L${pts.join(" L")} L${x(p.data.length - 1)},${y(0)} Z"/>`;
      s += `<polyline class="l${p.cls}" points="${pts.join(" ")}"/>`;
      const li = p.data.length - 1;
      s += `<circle class="mk" cx="${x(li)}" cy="${y(p.data[li])}" r="4" fill="var(--s${p.cls})"/>`;
      s += `<text class="end" x="${x(li) + 9}" y="${y(p.data[li]) + 4}">${fmt(p.data[li])}</text>`;
      s += `<g class="hov" data-p="${p.cls}"></g>`;
    });
    const ei = EVENT_I - off;
    if (ei >= 0) s += `<line class="ev" x1="${x(ei)}" x2="${x(ei)}" y1="${TOP - 2}" y2="${TOP + PH * 2 + GAP}"/><text class="evt" x="${x(ei) + 5}" y="${TOP + 10}">Double CP</text>`;
    const step = range > 7 ? 2 : 1;
    V.forEach((_, i) => { if ((V.length - 1 - i) % step === 0) s += `<text class="ax" x="${x(i)}" y="${H - 4}" text-anchor="middle">${dShort(day(off + i))}</text>`; });
    s += `<line class="cross" id="cross" y1="${TOP - 2}" y2="${TOP + PH * 2 + GAP}" visibility="hidden"/>`;
    s += `<rect class="hit" x="${L}" y="0" width="${W - L - R + 8}" height="${H - 18}"/></svg><div class="tip" hidden></div>`;
    box.innerHTML = s;

    const svg = $("svg", box), tip = $(".tip", box), cross = $("#cross", box), hit = $(".hit", box);
    const move = (ev) => {
      const r = svg.getBoundingClientRect(), k = r.width / W;
      const px = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left) / k;
      const i = Math.max(0, Math.min(V.length - 1, Math.round((px - L) / (W - L - R) * (V.length - 1))));
      cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("visibility", "visible");
      panels.forEach((p) => {
        const y = p.y0 + PH - p.data[i] / p.max * PH;
        $(`.hov[data-p="${p.cls}"]`, svg).innerHTML = `<circle class="mk" cx="${x(i)}" cy="${y}" r="5" fill="var(--s${p.cls})"/>`;
      });
      tip.hidden = false;
      tip.innerHTML = `<b>${dShort(day(off + i))}${off + i === EVENT_I ? " · Double CP starts" : ""}</b>
        <span><i class="sw s1"></i>Visitors<em>${fmt(V[i])}</em></span>
        <span><i class="sw s2"></i>Order taps<em>${fmt(T[i])}</em></span>`;
      const tx = Math.min(Math.max(x(i) * k, 80), r.width - 80);
      tip.style.left = tx + "px"; tip.style.top = (TOP + 30) * k + "px";
    };
    const leave = () => { tip.hidden = true; cross.setAttribute("visibility", "hidden"); $$(".hov", svg).forEach((g) => (g.innerHTML = "")); };
    hit.addEventListener("mousemove", move); hit.addEventListener("touchstart", move, { passive: true }); hit.addEventListener("touchmove", move, { passive: true });
    hit.addEventListener("mouseleave", leave); hit.addEventListener("touchend", () => setTimeout(leave, 1500));
  }
  let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(drawTrend, 150); });

  /* ── sales ── */
  const pick = { pkg: 2, pay: "M-Pesa", cty: "KE" };
  function chips(sel, items, key) {
    $(sel).innerHTML = items.map(([v, label]) => `<button type="button" data-v="${v}" aria-pressed="${String(pick[key]) === String(v)}">${label}</button>`).join("");
    $$("button", $(sel)).forEach((b) => b.addEventListener("click", () => {
      pick[key] = key === "pkg" ? Number(b.dataset.v) : b.dataset.v;
      $$("button", $(sel)).forEach((x) => x.setAttribute("aria-pressed", x === b));
      fillAmount();
    }));
  }
  function fillAmount() { const p = PKGS[pick.pkg]; if (p) $("#l-amt").value = fmt(pick.cty === "TZ" ? p.tzs : p.kes); }
  function salesChips() {
    chips("#c-pkg", PKGS.map((p, i) => [i, `${fmt(p.cp + p.bonus)} CP`]), "pkg");
    chips("#c-pay", ["M-Pesa", "Bank", "Apple Pay", "PayPal", "Binance"].map((x) => [x, x]), "pay");
    chips("#c-cty", [["KE", "🇰🇪 Kenya"], ["TZ", "🇹🇿 Tanzania"]], "cty");
    fillAmount();
  }
  const when = (t) => { const d = new Date(t); return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) + " · " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); };
  function renderSales(fresh) {
    $("#sales").innerHTML = sales.slice(0, 12).map((s, i) => `
      <li class="${fresh && i === 0 ? "new" : ""}">
        <span>${PKGS[s.pkg] ? pkgName(PKGS[s.pkg]) : "Custom"}${s.buyer ? ` · ${esc(s.buyer)}` : ""}</span>
        <span class="amt">${s.cty === "TZ" ? "TSH" : "KSH"} ${fmt(s.amt)}</span>
        <small>${when(s.t)} · ${esc(s.pay)}</small><small style="text-align:right">${s.cty === "TZ" ? "🇹🇿" : "🇰🇪"}</small>
      </li>`).join("");
    const wk = sales.filter((s) => new Date(s.t) >= new Date("2026-11-11T00:00"));
    const by = (k) => { const m = {}; wk.forEach((s) => (m[k(s)] = (m[k(s)] || 0) + toKES(s))); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
    const topPkg = by((s) => PKGS[s.pkg] ? `${fmt(PKGS[s.pkg].cp + PKGS[s.pkg].bonus)} CP` : "Custom")[0];
    $("#week").innerHTML = `
      <div><div class="big">KSH ${fmt(sum(wk.map(toKES)))}</div><div class="meta">${wk.length} sales since Wed 11 Nov · TSH counted at ${TZS_PER_KES} TSH = 1 KSH</div></div>
      <div><p class="lbl">By payment method</p><div class="split">${by((s) => s.pay).map(([k, v]) => `<div><b>KSH ${fmt(v)}</b><small>${esc(k)}</small></div>`).join("")}</div></div>
      <div class="meta">Top earner this week: <b style="color:var(--text)">${topPkg ? esc(topPkg[0]) : "–"}</b></div>`;
    renderMoney();
  }
  $("#log").addEventListener("submit", (e) => {
    e.preventDefault();
    const amt = Number($("#l-amt").value.replace(/[^\d]/g, ""));
    if (!amt) { $("#l-amt").focus(); return; }
    sales.unshift({ pkg: pick.pkg, pay: pick.pay, cty: pick.cty, amt, buyer: $("#l-buyer").value.trim(), t: "2026-11-17T" + new Date().toTimeString().slice(0, 5) });
    $("#l-buyer").value = "";
    renderSales(true);
    toast(`Sale logged: ${pick.cty === "TZ" ? "TSH" : "KSH"} ${fmt(amt)} ✓`);
  });

  /* ── prices ── */
  function renderPrices() {
    $("#ptable").innerHTML = PKGS.map((p, i) => `
      <div class="prow" data-i="${i}">
        <label>CP<input data-k="cp" inputmode="numeric" value="${p.cp}"></label>
        <label>Bonus<input data-k="bonus" inputmode="numeric" value="${p.bonus}"></label>
        <label>KSH<input data-k="kes" inputmode="numeric" value="${p.kes}"></label>
        <label>TSH<input data-k="tzs" inputmode="numeric" value="${p.tzs}"></label>
        <label class="tagc">Label<input data-k="tag" value="${esc(p.tag)}" placeholder="e.g. Best value"></label>
        <label class="switch" title="Show on page"><input type="checkbox" checked><span></span></label>
        <button class="x" type="button" aria-label="Remove package">✕</button>
      </div>`).join("");
    $$(".prow").forEach((row) => {
      const p = PKGS[row.dataset.i];
      $$("input[data-k]", row).forEach((inp) => inp.addEventListener("input", () => { const k = inp.dataset.k; p[k] = k === "tag" ? inp.value : Number(inp.value.replace(/[^\d]/g, "")) || 0; salesChips(); }));
      $(".x", row).addEventListener("click", () => { PKGS.splice(row.dataset.i, 1); renderPrices(); salesChips(); toast("Package removed (publish to apply)"); });
    });
  }
  $("#add-pkg").addEventListener("click", () => { PKGS.push({ cp: 0, bonus: 0, kes: 0, tzs: 0, tag: "" }); renderPrices(); $(".prow:last-child input").focus(); });
  $("#pub-prices").addEventListener("click", () => toast("Prices published. Shop page updated ✓ (mockup)"));

  /* ── offer ── */
  function renderOffer() {
    $("#o-pt").textContent = $("#o-title").value;
    $("#o-pd").textContent = $("#o-detail").value;
    const end = new Date($("#o-end").value);
    const s = Math.max(0, Math.floor((end - new Date("2026-11-17T16:48")) / 1000));
    $("#o-pc").textContent = isNaN(end) ? "" : `Ends in ${Math.floor(s / 86400)}d ${Math.floor(s % 86400 / 3600)}h`;
    $("#o-prev").classList.toggle("off", !$("#o-on").checked);
  }
  ["#o-title", "#o-detail", "#o-end", "#o-on"].forEach((s) => $(s).addEventListener("input", renderOffer));
  $("#pub-offer").addEventListener("click", () => toast($("#o-on").checked ? "Offer banner is live ✓ (mockup)" : "Offer banner turned off (mockup)"));

  /* ── posts ── */
  const posts = [
    { kind: "drop", title: "Mythic Alias", msg: "New mythic operator drop. Stock up on CP before it lands.", date: "2026-11-19" },
    { kind: "update", title: "Double CP season is back", msg: "All four packages are doubled until 20 Dec. Orders are open now.", date: "2026-11-17", pin: true },
    { kind: "update", title: "Before you order", msg: "Unlink any accounts you don't use and have your verification method ready.", date: "2026-11-12" }
  ];
  let kind = "update";
  $$(".seg button").forEach((b) => b.addEventListener("click", () => {
    kind = b.dataset.kind;
    $$(".seg button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    $$(".only-update").forEach((e) => (e.hidden = kind !== "update"));
    $$(".only-drop").forEach((e) => (e.hidden = kind !== "drop"));
  }));
  $("#p-date").value = "2026-11-17";
  function renderPosts() {
    $("#posts").innerHTML = posts.map((p, i) => `
      <li>
        ${p.img ? `<img src="${p.img}" alt="">` : `<span class="kind ${p.kind}">${p.kind === "drop" ? "Drop" : p.pin ? "📌 Pinned" : "Update"}</span>`}
        <div><h3>${esc(p.title)}</h3><p>${esc(p.msg)}</p><p style="font-size:.78rem;margin-top:4px">${new Date(p.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p></div>
        <div class="acts"><button class="del" data-i="${i}" type="button">Delete</button></div>
      </li>`).join("") || '<p class="empty">No posts yet.</p>';
    $$("#posts .del").forEach((b) => b.addEventListener("click", () => { posts.splice(b.dataset.i, 1); renderPosts(); toast("Post deleted"); }));
  }
  $("#post").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = $("#p-img").files[0];
    posts.unshift({ kind, title: $("#p-title").value.trim(), msg: $("#p-msg").value.trim(), date: $("#p-date").value || "2026-11-17", pin: kind === "update" && $("#p-pin").checked, img: kind === "drop" && f ? URL.createObjectURL(f) : "" });
    e.target.reset(); $("#p-date").value = "2026-11-17";
    renderPosts(); toast("Posted to the shop page ✓ (mockup)");
  });

  /* ── reviews ── */
  const pending = [
    { name: "Ochieng", cty: "KE", stars: 5, msg: "Got my 16k CP in like 20 mins. Legit plug 🔥", date: "2026-11-17" },
    { name: "Asha", cty: "TZ", stars: 5, msg: "Nilipata CP haraka sana. Asante WGS!", date: "2026-11-16" },
    { name: "promo-bot", cty: "Other", stars: 1, msg: "Cheap CP here 👉 bit.ly/xxxx", date: "2026-11-16" }
  ];
  const live = [
    { name: "Brian", cty: "KE", stars: 5, msg: "Paid on M-Pesa, CP landed in about 15 minutes.", date: "2026-11-15" },
    { name: "Kevin", cty: "KE", stars: 4, msg: "Busy during double CP so it took a bit longer, but they kept me updated.", date: "2026-11-02" }
  ];
  const flag = (c) => ({ KE: "🇰🇪", TZ: "🇹🇿" }[c] || "🌍");
  const stars = (n) => "★".repeat(n) + `<span class="off">${"★".repeat(5 - n)}</span>`;
  const revItem = (r, i, actions) => `
    <li><span class="stars" aria-label="${r.stars} of 5">${stars(r.stars)}</span>
      <div><h3>${esc(r.name)} ${flag(r.cty)}</h3><p>${esc(r.msg)}</p></div>
      <div class="acts">${actions(i)}</div></li>`;
  function renderReviews() {
    $("#pending").innerHTML = pending.map((r, i) => revItem(r, i, (i) => `<button class="ok" data-i="${i}" type="button">Approve</button><button class="no" data-i="${i}" type="button">Delete</button>`)).join("") || '<p class="empty">All caught up ✓</p>';
    $("#live").innerHTML = live.map((r, i) => revItem(r, i, (i) => `<button class="no" data-i="${i}" type="button">Hide</button>`)).join("") || '<p class="empty">No reviews showing yet.</p>';
    $("#pend-n").textContent = `(${pending.length})`; $("#live-n").textContent = `(${live.length})`;
    $("#rev-badge").textContent = pending.length || "";
    $$("#pending .ok").forEach((b) => b.addEventListener("click", () => { live.unshift(pending.splice(b.dataset.i, 1)[0]); renderReviews(); toast("Review approved. It's on the shop page ✓"); }));
    $$("#pending .no").forEach((b) => b.addEventListener("click", () => { pending.splice(b.dataset.i, 1); renderReviews(); toast("Review deleted"); }));
    $$("#live .no").forEach((b) => b.addEventListener("click", () => { pending.unshift(live.splice(b.dataset.i, 1)[0]); renderReviews(); toast("Review hidden, moved back to waiting"); }));
  }

  /* ── go ── */
  salesChips(); renderSales(); renderOverview(); renderPrices(); renderOffer(); renderPosts(); renderReviews();
  const hash = location.hash.slice(1); if (hash && $(`[data-panel="${hash}"]`)) show(hash);
})();
