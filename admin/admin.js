/* WGS admin MOCKUP. All numbers are sample data, and nothing is saved anywhere. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const sum = (a) => a.reduce((s, x) => s + x, 0);
  const toast = (msg) => { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2600); };
  let rnd = 7; const rand = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;   // seeded, so the mockup looks the same every load

  /* ── catalogue ── */
  const CATS = [
    { id: "double", label: "Double CP", live: true },
    { id: "regular", label: "Regular CP", live: true },
    { id: "battlepass", label: "Battle Pass", live: true, named: true, hint: "Delivered with the buyer's Player UID only. The shop page asks for it." },
    { id: "games", label: "Console & PC games", live: false, named: true, hint: "Coming soon. Add games now and switch this on when you launch. It appears as a new tab on the shop page." }
  ];
  const PKGS = [
    { cat: "double", cp: 800, bonus: 800, kes: 1350, tzs: 27000, tag: "" },
    { cat: "double", cp: 2000, bonus: 2000, kes: 3500, tzs: 70000, tag: "" },
    { cat: "double", cp: 4000, bonus: 4000, kes: 6500, tzs: 130000, tag: "Most popular" },
    { cat: "double", cp: 8000, bonus: 8000, kes: 12000, tzs: 240000, tag: "Best value" },
    { cat: "regular", cp: 80, bonus: 0, kes: 200, tzs: 4000, tag: "" },
    { cat: "regular", cp: 400, bonus: 0, kes: 750, tzs: 15000, tag: "" },
    { cat: "regular", cp: 800, bonus: 0, kes: 1350, tzs: 27000, tag: "" },
    { cat: "regular", cp: 2000, bonus: 0, kes: 3500, tzs: 70000, tag: "Popular" },
    { cat: "battlepass", name: "Battle Pass", kes: 750, tzs: 15000, tag: "" },
    { cat: "battlepass", name: "Battle Pass Bundle", kes: 1950, tzs: 39000, tag: "Best value" }
  ];
  PKGS.forEach((p) => (p.show = true));
  const catOf = (id) => CATS.find((c) => c.id === id) || CATS[0];
  const pkgLabel = (p) => p.name || `${fmt(p.cp + (p.bonus || 0))} CP`;
  const pkgLong = (p) => p.name || `${fmt(p.cp)}${p.bonus ? " + " + fmt(p.bonus) : ""} CP`;
  const TZS_PER_KES = 20;
  const toKES = (o) => o.cty === "TZ" ? o.amt / TZS_PER_KES : o.amt;
  const money = (o) => `${o.cty === "TZ" ? "TSH" : "KSH"} ${fmt(o.amt)}`;

  /* ── history: 4–16 Nov are fixed sample days; today (17 Nov) is built from the orders list ── */
  const START = new Date("2026-11-04T00:00:00");
  const TODAY_I = 13, EVENT_I = 8;
  const NOW = new Date("2026-11-17T16:48:00");
  const day = (i) => new Date(START.getTime() + i * 864e5);
  const dShort = (d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const visits = [118, 132, 125, 141, 156, 149, 163, 171, 402, 388, 341, 297, 276, 301];
  const pastTaps = [9, 11, 10, 12, 13, 12, 14, 15, 44, 41, 35, 29, 27];
  const pastBought = [5, 6, 6, 7, 8, 7, 8, 9, 26, 24, 20, 17, 15];
  const avgSale = [4300, 4900, 4100, 5200, 4700, 5600, 4400, 5000, 6100, 5800, 5400, 5900, 5300];

  /* today's orders (sample) */
  const NAMES = ["Brian", "", "Kevin", "Neema", "", "Sam", "Ali", "", "Ochieng", "Asha", "", "Wanjiru", "Juma", "", "Mercy", "Otieno", ""];
  const PAYS = ["M-Pesa", "M-Pesa", "M-Pesa", "M-Pesa", "Binance", "Bank", "PayPal", "Apple Pay"];
  const weights = [3, 2, 4, 1.5, .5, 1, 1, 1, 1.5, .8];
  const pickPkg = () => { let r = rand() * sum(weights); for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; } return 0; };
  let codeN = 4700;
  function makeOrder(t, status) {
    const pi = pickPkg(), p = PKGS[pi], cty = rand() < .8 ? "KE" : "TZ";
    return {
      code: "WGS-" + (codeN += 1 + Math.floor(rand() * 9)), pi, cty, status,
      amt: cty === "TZ" ? p.tzs : p.kes, pay: PAYS[Math.floor(rand() * PAYS.length)],
      name: NAMES[Math.floor(rand() * NAMES.length)], uid: p.cat === "battlepass" ? "6743" + String(Math.floor(1e11 + rand() * 9e11)) : "",
      t: new Date(t), src: "site"
    };
  }
  const orders = [];
  for (let k = 0; k < 31; k++) {
    const t = new Date("2026-11-17T08:05:00").getTime() + k * 16.3 * 60000;
    const st = k >= 27 ? "new" : rand() < .7 ? "done" : "nosale";
    orders.push(makeOrder(t, st));
  }
  orders.reverse();

  const todayOrders = () => orders.filter((o) => o.t.toDateString() === NOW.toDateString());
  function todayStats() {
    const site = todayOrders().filter((o) => o.src === "site");
    const done = todayOrders().filter((o) => o.status === "done");
    return { visits: visits[TODAY_I], taps: site.length, bought: done.length, nosale: site.filter((o) => o.status === "nosale").length, waiting: site.filter((o) => o.status === "new").length, rev: sum(done.map(toKES)) };
  }
  function series() {
    const t = todayStats();
    return {
      taps: [...pastTaps, t.taps], bought: [...pastBought, t.bought],
      nosale: [...pastTaps.map((x, i) => x - pastBought[i]), t.nosale],
      rev: [...pastBought.map((b, i) => b * avgSale[i]), t.rev]
    };
  }

  /* ── tabs ── */
  function show(tab) {
    $$(".tabs button").forEach((b) => b.dataset.tab === tab ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current"));
    $$("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== tab));
    scrollTo(0, 0);
    if (tab === "overview") renderOverview();
  }
  $$(".tabs button").forEach((b) => b.addEventListener("click", () => show(b.dataset.tab)));

  /* ── overview ── */
  let range = 7;
  $$(".range button").forEach((b) => {
    b.setAttribute("aria-pressed", Number(b.dataset.range) === range);
    b.addEventListener("click", () => {
      range = Number(b.dataset.range);
      $$(".range button").forEach((x) => x.setAttribute("aria-pressed", x === b));
      renderOverview();
    });
  });
  const pct = (cur, prev) => {
    if (!prev) return "";
    const p = (cur - prev) / prev * 100;
    return `<span class="${p >= 0 ? "up" : "down"}">${p >= 0 ? "▲" : "▼"} ${Math.abs(p).toFixed(0)}%</span>`;
  };

  function renderToday() {
    const t = todayStats(), s = series(), y = TODAY_I - 1;
    const hour = NOW.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    $("#today-date").textContent = `Tue 17 Nov · up to ${hour} · arrows compare with yesterday`;
    const cell = (label, v, prev, money) => `<div><p>${label}</p><b>${money ? "KSH " : ""}${fmt(v)}</b><small>${pct(v, prev)} yesterday ${money ? "KSH " : ""}${fmt(prev)}</small></div>`;
    $("#today").innerHTML =
      cell("Visitors", t.visits, visits[y]) + cell("Order taps", t.taps, s.taps[y]) +
      cell("Bought", t.bought, s.bought[y]) + cell("Revenue", t.rev, s.rev[y], true);
  }

  function renderOverview() {
    renderToday();
    const s = series(), from = s.taps.length - range;
    const slice = (a) => a.slice(from), prev = (a) => range === 7 ? sum(a.slice(from - 7, from)) : 0;
    const V = slice(visits), T = slice(s.taps), B = slice(s.bought), N = slice(s.nosale), R = slice(s.rev);
    const vs = range === 7 ? " vs previous 7 days" : "";
    $("#k-visits").textContent = fmt(sum(V)); $("#k-visits-d").innerHTML = range === 7 ? pct(sum(V), prev(visits)) + vs : "last 14 days";
    $("#k-taps").textContent = fmt(sum(T)); $("#k-taps-d").innerHTML = range === 7 ? pct(sum(T), prev(s.taps)) + vs : "last 14 days";
    $("#k-conv").textContent = Math.round(sum(B) / (sum(B) + sum(N)) * 100) + "%";
    $("#k-conv-d").textContent = `${fmt(sum(B))} bought · ${fmt(sum(N))} no sale`;
    $("#k-rev").textContent = "KSH " + fmt(sum(R)); $("#k-rev-d").innerHTML = range === 7 ? pct(sum(R), prev(s.rev)) + vs : "last 14 days";

    const total = sum(V);
    bars("#b-pkg", [["4,000 + 4,000 CP", 92], ["800 + 800 CP", 98], ["2,000 + 2,000 CP", 71], ["8,000 + 8,000 CP", 46], ["Battle Pass", 38], ["Regular CP (all)", 33]]
      .sort((a, b) => b[1] - a[1]).map(([k, x]) => [k, x * range / 14]), (x) => fmt(x) + " taps");
    bars("#b-src", [["TikTok", .46], ["WhatsApp status", .31], ["Google", .12], ["Direct / other", .11]].map(([k, sh]) => [k, sh * total]), (x) => fmt(x));
    bars("#b-cty", [["Kenya", .78], ["Tanzania", .22]].map(([k, sh]) => [k, sh * total]), (x) => `${fmt(x)} · ${Math.round(x / total * 100)}%`);
    const wk = sum(s.rev.slice(-7));
    bars("#b-mix", [["Double CP", .71], ["Regular CP", .18], ["Battle Pass", .11]].map(([k, sh]) => [k, sh * wk]), (x) => `KSH ${fmt(x)}`);
    $("#wait-n").textContent = fmt(sum(WAIT.map((w) => w[1])));
    bars("#b-wait", WAIT, (x) => fmt(x));
    renderDaily(s);
    drawTrend(s);
  }
  const WAIT = [["PlayStation", 19], ["PC", 11], ["Xbox", 7]];

  function renderDaily(s) {
    const rows = [];
    for (let i = s.taps.length - 1; i >= s.taps.length - range; i--) {
      const d = day(i);
      rows.push(`<tr class="${i === EVENT_I ? "ev" : ""} ${i === TODAY_I ? "today" : ""}">
        <td>${i === TODAY_I ? "Today" : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</td>
        <td>${fmt(visits[i])}</td><td>${fmt(s.taps[i])}</td><td>${fmt(s.bought[i])}</td><td>${fmt(s.nosale[i])}</td><td>KSH ${fmt(s.rev[i])}</td></tr>`);
    }
    $("#daily tbody").innerHTML = rows.join("");
  }

  function bars(sel, rows, label) {
    const max = Math.max(...rows.map((r) => r[1]));
    $(sel).innerHTML = rows.map(([k, x]) => `
      <div class="bar"><span>${esc(k)}</span><span class="v">${label(x)}</span>
        <div class="track"><div class="fill" style="width:${(x / max * 100).toFixed(1)}%"></div></div></div>`).join("");
  }

  /* trend: two stacked panels (visitors, order taps) sharing one time axis, each on its own scale */
  function drawTrend(s = series()) {
    const box = $("#trend");
    if (!box || box.closest("[hidden]")) return;
    const off = visits.length - range;
    const V = visits.slice(off), T = s.taps.slice(off);
    const W = Math.max(320, box.clientWidth), PH = 104, GAP = 34, L = 34, R = 74, TOP = 18;
    const H = TOP + PH * 2 + GAP + 26;
    const x = (i) => L + (W - L - R) * (i / (V.length - 1));
    const nice = (m) => { const st = Math.pow(10, Math.floor(Math.log10(m))); return Math.ceil(m / st) * st; };
    const panels = [
      { data: V, cls: "1", name: "Visitors", y0: TOP, max: nice(Math.max(...V)) },
      { data: T, cls: "2", name: "Order taps", y0: TOP + PH + GAP, max: nice(Math.max(...T)) }
    ];
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily visitors and order taps, last ${range} days">`;
    panels.forEach((p) => {
      const y = (v) => p.y0 + PH - v / p.max * PH;
      svg += `<text class="ax" x="${L}" y="${p.y0 - 6}" style="fill:var(--text);font-weight:600">${p.name}</text>`;
      [0, .5, 1].forEach((f) => { const yy = y(p.max * f); svg += `<line class="gl" x1="${L}" x2="${W - R + 8}" y1="${yy}" y2="${yy}"/><text class="ax" x="${L - 6}" y="${yy + 4}" text-anchor="end">${fmt(p.max * f)}</text>`; });
      const pts = p.data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
      if (p.cls === "1") svg += `<path class="a1" d="M${x(0)},${y(0)} L${pts.join(" L")} L${x(p.data.length - 1)},${y(0)} Z"/>`;
      svg += `<polyline class="l${p.cls}" points="${pts.join(" ")}"/>`;
      const li = p.data.length - 1;
      svg += `<circle class="mk" cx="${x(li)}" cy="${y(p.data[li])}" r="4" fill="var(--s${p.cls})"/><text class="end" x="${x(li) + 9}" y="${y(p.data[li]) + 4}">${fmt(p.data[li])}</text><g class="hov" data-p="${p.cls}"></g>`;
    });
    const ei = EVENT_I - off;
    if (ei >= 0) svg += `<line class="ev" x1="${x(ei)}" x2="${x(ei)}" y1="${TOP - 2}" y2="${TOP + PH * 2 + GAP}"/><text class="evt" x="${x(ei) + 5}" y="${TOP + 10}">Double CP</text>`;
    const step = range > 7 ? 2 : 1;
    V.forEach((_, i) => { if ((V.length - 1 - i) % step === 0) svg += `<text class="ax" x="${x(i)}" y="${H - 4}" text-anchor="middle">${off + i === TODAY_I ? "Today" : dShort(day(off + i))}</text>`; });
    svg += `<line class="cross" id="cross" y1="${TOP - 2}" y2="${TOP + PH * 2 + GAP}" visibility="hidden"/><rect class="hit" x="${L}" y="0" width="${W - L - R + 8}" height="${H - 18}"/></svg><div class="tip" hidden></div>`;
    box.innerHTML = svg;

    const el = $("svg", box), tip = $(".tip", box), cross = $("#cross", box), hit = $(".hit", box);
    const move = (ev) => {
      const r = el.getBoundingClientRect(), k = r.width / W;
      const px = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left) / k;
      const i = Math.max(0, Math.min(V.length - 1, Math.round((px - L) / (W - L - R) * (V.length - 1))));
      cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("visibility", "visible");
      panels.forEach((p) => { $(`.hov[data-p="${p.cls}"]`, el).innerHTML = `<circle class="mk" cx="${x(i)}" cy="${p.y0 + PH - p.data[i] / p.max * PH}" r="5" fill="var(--s${p.cls})"/>`; });
      tip.hidden = false;
      tip.innerHTML = `<b>${off + i === TODAY_I ? "Today" : dShort(day(off + i))}${off + i === EVENT_I ? " · Double CP starts" : ""}</b>
        <span><i class="sw s1"></i>Visitors<em>${fmt(V[i])}</em></span><span><i class="sw s2"></i>Order taps<em>${fmt(T[i])}</em></span>`;
      tip.style.left = Math.min(Math.max(x(i) * k, 80), r.width - 80) + "px"; tip.style.top = (TOP + 30) * k + "px";
    };
    const leave = () => { tip.hidden = true; cross.setAttribute("visibility", "hidden"); $$(".hov", el).forEach((g) => (g.innerHTML = "")); };
    hit.addEventListener("mousemove", move); hit.addEventListener("touchstart", move, { passive: true }); hit.addEventListener("touchmove", move, { passive: true });
    hit.addEventListener("mouseleave", leave); hit.addEventListener("touchend", () => setTimeout(leave, 1500));
  }
  let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => drawTrend(), 150); });

  /* ── orders inbox ── */
  let filter = "new";
  const ago = (t) => { const m = Math.round((NOW - t) / 60000); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ago`; };
  const flag = (c) => ({ KE: "🇰🇪", TZ: "🇹🇿" }[c] || "🌍");
  function renderOrders(freshCode) {
    const site = orders.filter((o) => o.src === "site");
    const count = (st) => site.filter((o) => o.status === st).length;
    $("#f-new").textContent = count("new"); $("#f-done").textContent = count("done"); $("#f-nosale").textContent = count("nosale");
    const waiting = count("new");
    $("#ord-badge").textContent = waiting || "";
    document.title = (waiting ? `(${waiting}) ` : "") + "WGS Admin · mockup";
    const closed = count("done") + count("nosale");
    $("#conv").innerHTML = closed ? `Today: <b>${count("done")}</b> of ${closed} closed orders bought (${Math.round(count("done") / closed * 100)}%).` : "";
    const list = orders.filter((o) => filter === "all" || o.status === filter);
    $("#orders").innerHTML = list.map((o) => {
      const p = PKGS[o.pi] || {};
      const st = o.status === "new" ? "" : `<span class="st ${o.status}">${o.status === "done" ? "✓ Bought" : "✕ No sale"}</span>`;
      const acts = o.status === "new"
        ? `<button class="ok" data-c="${o.code}" data-s="done" type="button">✓ Bought</button><button class="no" data-c="${o.code}" data-s="nosale" type="button">✕ No sale</button>`
        : `${st}<button data-c="${o.code}" data-s="new" type="button">Undo</button>`;
      return `<li class="order ${o.status === "new" ? "new" : ""} ${o.code === freshCode ? "fresh" : ""}">
        <span class="code">#${o.src === "manual" ? "manual" : o.code.slice(4)}</span>
        <div><h3>${esc(pkgLong(p))} · ${money(o)}</h3>
          <p>${flag(o.cty)} ${esc(o.pay)}${o.name ? " · " + esc(o.name) : ""}${o.uid ? " · UID " + esc(o.uid) : ""} · ${o.t.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} (${ago(o.t)})</p></div>
        <div class="acts">${acts}</div></li>`;
    }).join("") || `<p class="empty">${filter === "new" ? "Nothing waiting. You're all caught up ✓" : "Nothing here yet."}</p>`;
    $$("#orders button[data-c]").forEach((b) => b.addEventListener("click", () => {
      const o = orders.find((x) => x.code === b.dataset.c); o.status = b.dataset.s;
      renderOrders(); renderSales();
      toast(o.status === "done" ? `#${o.code} marked bought. ${money(o)} added to revenue ✓` : o.status === "nosale" ? `#${o.code} marked no sale` : `#${o.code} moved back to waiting`);
    }));
  }
  $$(".filters button").forEach((b) => b.addEventListener("click", () => {
    filter = b.dataset.f; $$(".filters button").forEach((x) => x.setAttribute("aria-pressed", x === b)); renderOrders();
  }));

  /* new-order notification (the real version pushes this to his phone even when the panel is closed) */
  function newOrder() {
    NOW.setMinutes(NOW.getMinutes() + 3);
    const o = makeOrder(NOW, "new"); orders.unshift(o);
    renderOrders(o.code); renderSales();
    if (!$('[data-panel="overview"]').hidden) renderOverview();
    if ($("#notify").checked) {
      $("#ping-t").textContent = `New order #${o.code}`;
      $("#ping-d").textContent = `${pkgLong(PKGS[o.pi])} · ${money(o)} · ${o.pay}${o.name ? " · " + o.name : ""}`;
      $("#ping").hidden = false;
      clearTimeout(newOrder._h); newOrder._h = setTimeout(() => ($("#ping").hidden = true), 7000);
    }
  }
  $("#sim").addEventListener("click", newOrder);
  $("#ping-x").addEventListener("click", () => ($("#ping").hidden = true));
  $("#ping-open").addEventListener("click", () => {
    $("#ping").hidden = true; filter = "new";
    $$(".filters button").forEach((x) => x.setAttribute("aria-pressed", x.dataset.f === "new"));
    show("orders"); renderOrders();
  });
  let autos = 0; const auto = () => { if (autos++ < 3) { newOrder(); setTimeout(auto, 40000); } };
  setTimeout(auto, 6000);

  /* ── manual sale + this week ── */
  const pick = { cat: "double", pkg: 2, pay: "M-Pesa", cty: "KE" };
  function chips(sel, items, key, after) {
    $(sel).innerHTML = items.map(([v, label]) => `<button type="button" data-v="${v}" aria-pressed="${String(pick[key]) === String(v)}">${esc(label)}</button>`).join("");
    $$("button", $(sel)).forEach((b) => b.addEventListener("click", () => {
      pick[key] = key === "pkg" ? Number(b.dataset.v) : b.dataset.v;
      $$("button", $(sel)).forEach((x) => x.setAttribute("aria-pressed", x === b));
      (after || fillAmount)();
    }));
  }
  function fillAmount() { const p = PKGS[pick.pkg]; if (p) $("#l-amt").value = fmt(pick.cty === "TZ" ? p.tzs : p.kes); }
  function salesChips() {
    const live = CATS.filter((c) => PKGS.some((p) => p.cat === c.id));
    if (!live.some((c) => c.id === pick.cat)) pick.cat = live[0].id;
    chips("#c-cat", live.map((c) => [c.id, c.label]), "cat", () => { pick.pkg = PKGS.findIndex((p) => p.cat === pick.cat); salesChips(); });
    const inCat = PKGS.map((p, i) => [i, p]).filter(([, p]) => p.cat === pick.cat);
    if (!inCat.some(([i]) => i === pick.pkg)) pick.pkg = inCat.length ? inCat[0][0] : -1;
    chips("#c-pkg", inCat.map(([i, p]) => [i, pkgLabel(p)]), "pkg");
    chips("#c-pay", ["M-Pesa", "Bank", "Apple Pay", "PayPal", "Binance"].map((x) => [x, x]), "pay");
    chips("#c-cty", [["KE", "🇰🇪 Kenya"], ["TZ", "🇹🇿 Tanzania"]], "cty");
    fillAmount();
  }
  $("#log").addEventListener("submit", (e) => {
    e.preventDefault();
    const amt = Number($("#l-amt").value.replace(/[^\d]/g, ""));
    if (!amt || pick.pkg < 0) { $("#l-amt").focus(); return; }
    orders.unshift({ code: "M-" + Date.now(), pi: pick.pkg, pay: pick.pay, cty: pick.cty, amt, name: $("#l-buyer").value.trim(), uid: "", t: new Date(NOW), status: "done", src: "manual" });
    $("#l-buyer").value = "";
    renderSales(true); renderOrders();
    toast(`Sale logged: ${pick.cty === "TZ" ? "TSH" : "KSH"} ${fmt(amt)} ✓`);
  });

  function renderSales(fresh) {
    const done = orders.filter((o) => o.status === "done");
    $("#sales").innerHTML = done.slice(0, 12).map((o, i) => `
      <li class="${fresh && i === 0 ? "new" : ""}">
        <span>${esc(pkgLong(PKGS[o.pi] || {}))}${o.name ? ` · ${esc(o.name)}` : ""}</span>
        <span class="amt">${money(o)}</span>
        <small>${o.t.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · ${esc(o.pay)} · ${o.src === "manual" ? "logged by hand" : "#" + o.code}</small><small style="text-align:right">${flag(o.cty)}</small>
      </li>`).join("") || '<p class="empty">No sales yet today.</p>';
    const s = series(), wk = sum(s.rev.slice(-7));
    const split = [["M-Pesa", .72], ["Binance", .11], ["Bank", .08], ["PayPal", .06], ["Apple Pay", .03]];
    $("#week").innerHTML = `
      <div><div class="big">KSH ${fmt(wk)}</div><div class="meta">${fmt(sum(s.bought.slice(-7)))} sales in the last 7 days · TSH counted at ${TZS_PER_KES} TSH = 1 KSH</div></div>
      <div><p class="lbl">By payment method</p><div class="split">${split.map(([k, v]) => `<div><b>KSH ${fmt(wk * v)}</b><small>${k}</small></div>`).join("")}</div></div>`;
  }

  /* ── prices (grouped by product type) ── */
  function renderPrices() {
    $("#ptable").innerHTML = CATS.map((c) => {
      const rows = PKGS.map((p, i) => [i, p]).filter(([, p]) => p.cat === c.id);
      return `<div class="pgroup ${c.live ? "" : "off"}" data-c="${c.id}">
        <div class="pgroup-h"><h3>${esc(c.label)}${c.live ? "" : " · coming soon"}</h3>
          <div class="tools"><label class="switch" title="Show this type on the shop page"><input type="checkbox" class="live" ${c.live ? "checked" : ""}><span></span>${c.live ? "On shop" : "Hidden"}</label>
          <button class="btn ghost sm add" type="button">+ Add</button></div></div>
        ${c.hint ? `<p class="hint">${esc(c.hint)}</p>` : ""}
        <div class="ptable">${rows.map(([i, p]) => c.named ? `
          <div class="prow pass" data-i="${i}">
            <label>Name<input data-k="name" value="${esc(p.name)}" placeholder="${c.id === "games" ? "e.g. PS5 game key" : "e.g. Battle Pass"}"></label>
            <label>KSH<input data-k="kes" inputmode="numeric" value="${p.kes}"></label>
            <label>TSH<input data-k="tzs" inputmode="numeric" value="${p.tzs}"></label>
            <label class="tagc">Label<input data-k="tag" value="${esc(p.tag)}" placeholder="e.g. Best value"></label>
            <label class="switch" title="Show on page"><input type="checkbox" class="vis" ${p.show ? "checked" : ""}><span></span></label>
            <button class="x" type="button" aria-label="Remove">✕</button>
          </div>` : `
          <div class="prow" data-i="${i}">
            <label>CP<input data-k="cp" inputmode="numeric" value="${p.cp}"></label>
            <label>Bonus<input data-k="bonus" inputmode="numeric" value="${p.bonus}"></label>
            <label>KSH<input data-k="kes" inputmode="numeric" value="${p.kes}"></label>
            <label>TSH<input data-k="tzs" inputmode="numeric" value="${p.tzs}"></label>
            <label class="tagc">Label<input data-k="tag" value="${esc(p.tag)}" placeholder="e.g. Best value"></label>
            <label class="switch" title="Show on page"><input type="checkbox" class="vis" ${p.show ? "checked" : ""}><span></span></label>
            <button class="x" type="button" aria-label="Remove">✕</button>
          </div>`).join("") || '<p class="empty">No items yet.</p>'}</div></div>`;
    }).join("");
    $$(".pgroup").forEach((g) => {
      const c = catOf(g.dataset.c);
      $(".live", g).addEventListener("change", (e) => { c.live = e.target.checked; renderPrices(); toast(c.live ? `${c.label} will show on the shop page` : `${c.label} hidden from the shop page`); });
      $(".add", g).addEventListener("click", () => {
        PKGS.push(c.named ? { cat: c.id, name: "", kes: 0, tzs: 0, tag: "", show: true } : { cat: c.id, cp: 0, bonus: c.id === "double" ? 0 : 0, kes: 0, tzs: 0, tag: "", show: true });
        renderPrices(); salesChips(); $(`.pgroup[data-c="${c.id}"] .prow:last-child input`).focus();
      });
    });
    $$(".prow").forEach((row) => {
      const p = PKGS[row.dataset.i];
      $$("input[data-k]", row).forEach((inp) => inp.addEventListener("input", () => {
        const k = inp.dataset.k; p[k] = k === "tag" || k === "name" ? inp.value : Number(inp.value.replace(/[^\d]/g, "")) || 0; salesChips();
      }));
      $(".vis", row).addEventListener("change", (e) => (p.show = e.target.checked));
      $(".x", row).addEventListener("click", () => { p.cat = "_removed"; renderPrices(); salesChips(); toast("Removed (publish to apply)"); });
    });
  }
  $("#pub-prices").addEventListener("click", () => toast("Prices published. Shop page updated ✓ (mockup)"));

  /* ── offer ── */
  function renderOffer() {
    $("#o-pt").textContent = $("#o-title").value;
    $("#o-pd").textContent = $("#o-detail").value;
    const end = new Date($("#o-end").value);
    const s = Math.max(0, Math.floor((end - NOW) / 1000));
    $("#o-pc").textContent = isNaN(end) ? "" : `Ends in ${Math.floor(s / 86400)}d ${Math.floor(s % 86400 / 3600)}h`;
    $("#o-prev").classList.toggle("off", !$("#o-on").checked);
  }
  ["#o-title", "#o-detail", "#o-end", "#o-on"].forEach((s) => $(s).addEventListener("input", renderOffer));
  $("#pub-offer").addEventListener("click", () => toast($("#o-on").checked ? "Offer banner is live ✓ (mockup)" : "Offer banner turned off (mockup)"));

  /* ── posts ── */
  const posts = [
    { kind: "drop", title: "Mythic Alias", msg: "New mythic operator drop. Stock up on CP before it lands.", date: "2026-11-19" },
    { kind: "update", title: "Double CP season is back", msg: "All four packages are doubled until 20 Dec. Orders are open now.", date: "2026-11-17", pin: true },
    { kind: "update", title: "Console & PC games are coming", msg: "Tap 'Notify me' on the shop page and we'll message you on launch day.", date: "2026-11-14" }
  ];
  let kind = "update";
  $$(".seg[aria-label='Post type'] button").forEach((b) => b.addEventListener("click", () => {
    kind = b.dataset.kind;
    $$(".seg[aria-label='Post type'] button").forEach((x) => x.setAttribute("aria-pressed", x === b));
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
    { name: "Ochieng", cty: "KE", stars: 5, msg: "Got my 16k CP in like 20 mins. Legit plug 🔥" },
    { name: "Asha", cty: "TZ", stars: 5, msg: "Nilipata CP haraka sana. Asante WGS!" },
    { name: "promo-bot", cty: "Other", stars: 1, msg: "Cheap CP here 👉 bit.ly/xxxx" }
  ];
  const live = [
    { name: "Brian", cty: "KE", stars: 5, msg: "Paid on M-Pesa, CP landed in about 15 minutes." },
    { name: "Kevin", cty: "KE", stars: 4, msg: "Busy during double CP so it took a bit longer, but they kept me updated." }
  ];
  const stars = (n) => "★".repeat(n) + `<span class="off">${"★".repeat(5 - n)}</span>`;
  const revItem = (r, i, actions) => `
    <li><span class="stars" aria-label="${r.stars} of 5">${stars(r.stars)}</span>
      <div><h3>${esc(r.name)} ${flag(r.cty)}</h3><p>${esc(r.msg)}</p></div>
      <div class="acts">${actions(i)}</div></li>`;
  function renderReviews() {
    $("#pending").innerHTML = pending.map((r, i) => revItem(r, i, (k) => `<button class="ok" data-i="${k}" type="button">Approve</button><button class="no" data-i="${k}" type="button">Delete</button>`)).join("") || '<p class="empty">All caught up ✓</p>';
    $("#live").innerHTML = live.map((r, i) => revItem(r, i, (k) => `<button class="no" data-i="${k}" type="button">Hide</button>`)).join("") || '<p class="empty">No reviews showing yet.</p>';
    $("#pend-n").textContent = `(${pending.length})`; $("#live-n").textContent = `(${live.length})`;
    $("#rev-badge").textContent = pending.length || "";
    $$("#pending .ok").forEach((b) => b.addEventListener("click", () => { live.unshift(pending.splice(b.dataset.i, 1)[0]); renderReviews(); toast("Review approved. It's on the shop page ✓"); }));
    $$("#pending .no").forEach((b) => b.addEventListener("click", () => { pending.splice(b.dataset.i, 1); renderReviews(); toast("Review deleted"); }));
    $$("#live .no").forEach((b) => b.addEventListener("click", () => { pending.unshift(live.splice(b.dataset.i, 1)[0]); renderReviews(); toast("Review hidden, moved back to waiting"); }));
  }

  /* ── go ── */
  salesChips(); renderOrders(); renderSales(); renderOverview(); renderPrices(); renderOffer(); renderPosts(); renderReviews();
  const hash = location.hash.slice(1); if (hash && $(`[data-panel="${hash}"]`)) show(hash);
})();
