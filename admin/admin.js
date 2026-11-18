/* WGS admin panel. Talks to Supabase as the signed-in admin.
   Security lives in the database rules (schema.sql): this page can only do what an admin account is allowed to do. */
(() => {
  const CFG = window.WGS_CONFIG;
  const sb = supabase.createClient(CFG.url, CFG.key);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fmt = (n) => Math.round(Number(n) || 0).toLocaleString("en-US");
  const num = (v) => Number(String(v ?? "").replace(/[^\d.]/g, "")) || 0;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const sum = (a) => a.reduce((s, x) => s + x, 0);
  const TZ = "Africa/Nairobi";
  const dayKey = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: TZ });          // YYYY-MM-DD in Kenya time
  const dShort = (k) => new Date(k + "T12:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const dLong = (k) => new Date(k + "T12:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const hhmm = (d) => new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
  const toast = (msg) => { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2800); };
  const fail = (what, error) => { console.error(what, error); toast(`Couldn't ${what}. Check your connection and try again.`); };

  const D = { settings: {}, cats: [], pkgs: [], offer: null, posts: [], reviews: [], orders: [], visits: [], breakdown: [] };
  let range = 7, cur = "KES";
  const rate = () => num(D.settings.rate) || 20;

  /* ══ sign-in ══════════════════════════════════════════════════════════ */
  const showOnly = (id) => ["#login-form", "#reset-form", "#denied"].forEach((s) => ($(s).hidden = s !== id));
  let recovering = location.hash.includes("type=recovery");
  async function boot(session) {
    if (recovering) return;
    if (!session) { $("#app").hidden = true; $("#login").hidden = false; showOnly("#login-form"); return; }
    const { data, error } = await sb.from("admins").select("user_id").eq("user_id", session.user.id).maybeSingle();
    if (error || !data) { $("#app").hidden = true; $("#login").hidden = false; showOnly("#denied"); return; }
    $("#login").hidden = true; $("#app").hidden = false;
    $("#who").textContent = session.user.email;
    await loadAll();
    startRealtime();
    pushState();
    const hash = location.hash.slice(1); if (hash && $(`[data-panel="${hash}"]`)) show(hash);
  }
  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#l-go").disabled = true; $("#l-err").textContent = "";
    const { data, error } = await sb.auth.signInWithPassword({ email: $("#l-email").value.trim(), password: $("#l-pass").value });
    $("#l-go").disabled = false;
    if (error) { $("#l-err").textContent = "Wrong email or password."; return; }
    $("#l-pass").value = "";
    boot(data.session);
  });
  $("#l-forgot").addEventListener("click", async () => {
    const email = $("#l-email").value.trim();
    if (!email) { $("#l-err").textContent = "Type your email first, then tap Forgot password."; return; }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    $("#l-err").textContent = error ? "Couldn't send the reset email. Try again later." : "Check your email for a reset link.";
  });
  $("#reset-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const { error } = await sb.auth.updateUser({ password: $("#r-pass").value });
    if (error) { $("#r-err").textContent = error.message; return; }
    toast("Password saved ✓"); recovering = false; history.replaceState(null, "", location.pathname);
    const { data } = await sb.auth.getSession(); boot(data.session);
  });
  sb.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") { recovering = true; $("#app").hidden = true; $("#login").hidden = false; showOnly("#reset-form"); }
    if (event === "SIGNED_OUT") { $("#app").hidden = true; $("#login").hidden = false; showOnly("#login-form"); }
  });
  const signOut = () => sb.auth.signOut();
  $("#signout").addEventListener("click", signOut);
  $("#denied-out").addEventListener("click", signOut);

  /* ══ data ═════════════════════════════════════════════════════════════ */
  async function loadAll() {
    // Orders older than 24 h with no reply become "No sale".
    await sb.from("orders").update({ status: "nosale", auto_closed: true, closed_at: new Date().toISOString() })
      .eq("status", "new").lt("created_at", new Date(Date.now() - 864e5).toISOString());
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    const r = await Promise.all([
      sb.from("settings").select("key,value"),
      sb.from("categories").select("*").order("sort"),
      sb.from("packages").select("*").order("sort"),
      sb.from("offers").select("*").order("updated_at", { ascending: false }).limit(1),
      sb.from("posts").select("*").order("date", { ascending: false }),
      sb.from("reviews").select("*").order("created_at", { ascending: false }),
      sb.from("orders").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(2000),
      sb.rpc("admin_visits", { n_days: 28 }),
      sb.rpc("admin_breakdown", { n_days: 7 })
    ]);
    const bad = r.find((x) => x.error);
    if (bad) fail("load everything", bad.error);
    D.settings = Object.fromEntries((r[0].data || []).map((x) => [x.key, x.value]));
    D.cats = r[1].data || []; D.pkgs = r[2].data || []; D.offer = (r[3].data || [])[0] || null;
    D.posts = r[4].data || []; D.reviews = r[5].data || []; D.orders = r[6].data || [];
    D.visits = r[7].data || []; D.breakdown = r[8].data || [];
    $("#rate").value = rate();
    renderAll();
  }
  async function reloadBreakdown() {
    const { data, error } = await sb.rpc("admin_breakdown", { n_days: range });
    if (!error) D.breakdown = data || [];
  }
  function renderAll() {
    renderOverview(); renderOrders(); salesChips(); renderPrices(); renderOffer(); renderPosts(); renderReviews(); renderSettings();
  }

  /* ══ tabs ═════════════════════════════════════════════════════════════ */
  function show(tab) {
    $$(".tabs button").forEach((b) => b.dataset.tab === tab ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current"));
    $$("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== tab));
    history.replaceState(null, "", "#" + tab);
    scrollTo(0, 0);
    if (tab === "overview") renderOverview();
  }
  $$(".tabs button").forEach((b) => b.addEventListener("click", () => show(b.dataset.tab)));

  /* ══ money ════════════════════════════════════════════════════════════ */
  const toKES = (o) => o.currency === "TZS" ? o.amount / rate() : o.amount;
  const mny = (kes) => cur === "KES" ? `KSH ${fmt(kes)}` : `TSH ${fmt(kes * rate())}`;
  const money = (o) => `${o.currency === "TZS" ? "TSH" : "KSH"} ${fmt(o.amount)}`;
  const recv = (ke, tz) => `<span class="recv">received <b>KSH ${fmt(ke)}</b>${tz ? ` + <b>TSH ${fmt(tz)}</b>` : ""}</span>`;
  $$(".range button[data-cur]").forEach((b) => b.addEventListener("click", () => {
    cur = b.dataset.cur; $$(".range button[data-cur]").forEach((x) => x.setAttribute("aria-pressed", x === b)); renderOverview();
  }));
  $("#rate").addEventListener("change", async (e) => {
    const r = num(e.target.value);
    if (!(r > 0)) { e.target.value = rate(); return; }
    const { error } = await sb.from("settings").upsert({ key: "rate", value: String(r), updated_at: new Date().toISOString() });
    if (error) return fail("save the rate", error);
    D.settings.rate = String(r); renderOverview(); renderSettings(); toast(`Rate saved: 1 KSH = ${fmt(r)} TSH`);
  });
  $$(".range button[data-range]").forEach((b) => b.addEventListener("click", async () => {
    range = Number(b.dataset.range); $$(".range button[data-range]").forEach((x) => x.setAttribute("aria-pressed", x === b));
    await reloadBreakdown(); renderOverview();
  }));

  /* ══ overview ═════════════════════════════════════════════════════════ */
  function days(n, endOffset = 0) {   // list of day keys, oldest first
    const out = []; const now = Date.now();
    for (let i = n - 1 + endOffset; i >= endOffset; i--) out.push(dayKey(now - i * 864e5));
    return out;
  }
  function perDay(keys) {
    const vis = Object.fromEntries(D.visits.map((v) => [v.day, Number(v.visitors)]));
    const rows = Object.fromEntries(keys.map((k) => [k, { day: k, visitors: vis[k] || 0, taps: 0, bought: 0, nosale: 0, ke: 0, tz: 0, rev: 0 }]));
    D.orders.forEach((o) => {
      const r = rows[dayKey(o.created_at)]; if (!r) return;
      if (o.source === "site") r.taps++;
      if (o.status === "done") { r.bought++; if (o.currency === "TZS") r.tz += o.amount; else r.ke += o.amount; }
      if (o.status === "nosale" && o.source === "site") r.nosale++;
    });
    Object.values(rows).forEach((r) => (r.rev = r.ke + r.tz / rate()));
    return keys.map((k) => rows[k]);
  }
  const pct = (c, p) => { if (!p) return ""; const x = (c - p) / p * 100; return `<span class="${x >= 0 ? "up" : "down"}">${x >= 0 ? "▲" : "▼"} ${Math.abs(x).toFixed(0)}%</span>`; };

  function renderOverview() {
    if ($('[data-panel="overview"]').hidden) return;
    const user = $("#who").textContent;
    $("#hello").textContent = `Habari${user ? ", " + user.split("@")[0] : ""} 👋`;
    const [y, t] = perDay(days(2));
    $("#today-date").textContent = `${new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: TZ })} · arrows compare with yesterday`;
    const cell = (label, v, p, isM, extra = "") => `<div><p>${label}</p><b>${isM ? mny(v) : fmt(v)}</b><small>${pct(v, p)} yesterday ${isM ? mny(p) : fmt(p)}</small>${extra}</div>`;
    $("#today").innerHTML = cell("Visitors", t.visitors, y.visitors) + cell("Order taps", t.taps, y.taps) + cell("Bought", t.bought, y.bought) + cell("Revenue", t.rev, y.rev, true, recv(t.ke, t.tz));

    const R = perDay(days(range)), P = perDay(days(range, range));
    const S = (rows, k) => sum(rows.map((r) => r[k]));
    const vs = ` vs previous ${range} days`;
    $("#k-visits").textContent = fmt(S(R, "visitors")); $("#k-visits-d").innerHTML = (pct(S(R, "visitors"), S(P, "visitors")) || "") + vs;
    $("#k-taps").textContent = fmt(S(R, "taps")); $("#k-taps-d").innerHTML = (pct(S(R, "taps"), S(P, "taps")) || "") + vs;
    const closed = S(R, "bought") + S(R, "nosale");
    $("#k-conv").textContent = closed ? Math.round(S(R, "bought") / closed * 100) + "%" : "–";
    $("#k-conv-d").textContent = `${fmt(S(R, "bought"))} bought · ${fmt(S(R, "nosale"))} no sale`;
    $("#k-rev").textContent = mny(S(R, "rev")); $("#k-rev-d").innerHTML = (pct(S(R, "rev"), S(P, "rev")) || "") + vs + recv(S(R, "ke"), S(R, "tz"));
    $("#k-group").textContent = D.settings.group_members ? fmt(num(D.settings.group_members)) : "–";

    const from = days(range)[0];
    const inRange = D.orders.filter((o) => dayKey(o.created_at) >= from);
    const count = (arr, f) => { const m = {}; arr.forEach((x) => { const k = f(x); m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
    bars("#b-pkg", count(inRange.filter((o) => o.source === "site"), (o) => o.item).slice(0, 6), (x) => `${fmt(x)} taps`, "No order taps yet.");
    const bd = (kind) => D.breakdown.filter((b) => b.kind === kind).map((b) => [b.label, Number(b.n)]).sort((a, b) => b[1] - a[1]);
    const nice = { tiktok: "TikTok", youtube: "YouTube", whatsapp: "WhatsApp", google: "Google", instagram: "Instagram", facebook: "Facebook", twitter: "X / Twitter", direct: "Direct / unknown", other: "Other sites" };
    bars("#b-src", bd("source").map(([k, n]) => [nice[k] || k, n]), (x) => fmt(x) + " visitors", "No visits yet.");
    const cty = { KE: "Kenya", TZ: "Tanzania", UG: "Uganda", Other: "Elsewhere" };
    const cRows = bd("country").map(([k, n]) => [cty[k] || k, n]); const cTot = sum(cRows.map((r) => r[1]));
    bars("#b-cty", cRows, (x) => `${fmt(x)} · ${Math.round(x / (cTot || 1) * 100)}%`, "No visits yet.");
    const w = bd("waitlist"); $("#wait-n").textContent = fmt(sum(w.map((r) => r[1])));
    bars("#b-wait", w, (x) => fmt(x), "Nobody yet. It fills up as people tap Notify me.");
    const catLabel = (id) => (D.cats.find((c) => c.id === id) || {}).label || id || "Other";
    const mix = {}; inRange.filter((o) => o.status === "done").forEach((o) => { const k = catLabel(o.category); mix[k] = (mix[k] || 0) + toKES(o); });
    bars("#b-mix", Object.entries(mix).sort((a, b) => b[1] - a[1]), (x) => mny(x), "No sales in this period yet.");

    $("#daily tbody").innerHTML = perDay(days(range)).reverse().map((r, i) => `
      <tr class="${i === 0 ? "today" : ""}"><td>${i === 0 ? "Today" : dLong(r.day)}</td><td>${fmt(r.visitors)}</td><td>${fmt(r.taps)}</td><td>${fmt(r.bought)}</td><td>${fmt(r.nosale)}</td><td>${mny(r.rev)}</td></tr>`).join("");
    drawTrend(R);
  }
  function bars(sel, rows, label, empty) {
    if (!rows.length) { $(sel).innerHTML = `<p class="empty-note">${empty}</p>`; return; }
    const max = Math.max(...rows.map((r) => r[1])) || 1;
    $(sel).innerHTML = rows.map(([k, x]) => `
      <div class="bar"><span>${esc(k)}</span><span class="v">${label(x)}</span>
        <div class="track"><div class="fill" style="width:${(x / max * 100).toFixed(1)}%"></div></div></div>`).join("");
  }

  /* trend: two stacked panels (visitors, order taps) sharing one time axis, each on its own scale */
  function drawTrend(rows) {
    const box = $("#trend"); if (!box || box.closest("[hidden]")) return;
    const V = rows.map((r) => r.visitors), T = rows.map((r) => r.taps), K = rows.map((r) => r.day);
    const W = Math.max(320, box.clientWidth), PH = 104, GAP = 34, L = 34, R = 74, TOP = 18, H = TOP + PH * 2 + GAP + 26;
    const x = (i) => L + (W - L - R) * (i / Math.max(1, V.length - 1));
    const nice = (m) => { m = Math.max(m, 4); const st = Math.pow(10, Math.floor(Math.log10(m))); return Math.ceil(m / st) * st; };
    const panels = [{ data: V, cls: "1", name: "Visitors", y0: TOP, max: nice(Math.max(...V)) }, { data: T, cls: "2", name: "Order taps", y0: TOP + PH + GAP, max: nice(Math.max(...T)) }];
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
    const step = range > 7 ? 2 : 1;
    K.forEach((k, i) => { if ((K.length - 1 - i) % step === 0) svg += `<text class="ax" x="${x(i)}" y="${H - 4}" text-anchor="middle">${i === K.length - 1 ? "Today" : dShort(k)}</text>`; });
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
      tip.innerHTML = `<b>${i === K.length - 1 ? "Today" : dLong(K[i])}</b><span><i class="sw s1"></i>Visitors<em>${fmt(V[i])}</em></span><span><i class="sw s2"></i>Order taps<em>${fmt(T[i])}</em></span>`;
      tip.style.left = Math.min(Math.max(x(i) * k, 80), r.width - 80) + "px"; tip.style.top = (TOP + 30) * k + "px";
    };
    const leave = () => { tip.hidden = true; cross.setAttribute("visibility", "hidden"); $$(".hov", el).forEach((g) => (g.innerHTML = "")); };
    hit.addEventListener("mousemove", move); hit.addEventListener("touchstart", move, { passive: true }); hit.addEventListener("touchmove", move, { passive: true });
    hit.addEventListener("mouseleave", leave); hit.addEventListener("touchend", () => setTimeout(leave, 1500));
  }
  let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => renderOverview(), 200); });

  /* ══ orders ═══════════════════════════════════════════════════════════ */
  let filter = "new", shown = 40;
  const flag = (c) => ({ KE: "🇰🇪", TZ: "🇹🇿", UG: "🇺🇬" }[c] || "🌍");
  const ago = (t) => { const m = Math.round((Date.now() - new Date(t)) / 60000); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)} h ago` : `${Math.floor(m / 1440)} d ago`; };
  function renderOrders(freshId) {
    const site = D.orders.filter((o) => o.source === "site");
    const c = (st) => site.filter((o) => o.status === st).length;
    $("#f-new").textContent = c("new"); $("#f-done").textContent = c("done"); $("#f-nosale").textContent = c("nosale");
    $("#ord-badge").textContent = c("new") || "";
    document.title = (c("new") ? `(${c("new")}) ` : "") + "WGS Admin";
    const todayK = dayKey(Date.now()), tod = site.filter((o) => dayKey(o.created_at) === todayK);
    const tDone = tod.filter((o) => o.status === "done").length, tClosed = tDone + tod.filter((o) => o.status === "nosale").length;
    $("#conv").innerHTML = tClosed ? `Today: <b>${tDone}</b> of ${tClosed} closed orders bought (${Math.round(tDone / tClosed * 100)}%).` : "";
    const list = D.orders.filter((o) => filter === "all" || o.status === filter);
    $("#orders").innerHTML = list.slice(0, shown).map((o) => {
      const st = o.status === "new" ? "" : `<span class="st ${o.status}">${o.status === "done" ? "✓ Bought" : "✕ No sale"}${o.auto_closed ? " (auto)" : ""}</span>`;
      const acts = o.status === "new"
        ? `<button class="ok" data-id="${o.id}" data-s="done" type="button">✓ Bought</button><button class="no" data-id="${o.id}" data-s="nosale" type="button">✕ No sale</button>`
        : `${st}<button data-id="${o.id}" data-s="new" type="button">Undo</button>`;
      return `<li class="order ${o.status === "new" ? "new" : ""} ${o.id === freshId ? "fresh" : ""}">
        <span class="code">${o.source === "manual" ? "manual" : "#" + esc(o.code.replace(/^WGS-/, ""))}</span>
        <div><h3>${esc(o.item)} · ${money(o)}</h3>
          <p>${flag(o.country)} ${esc(o.pay)}${o.name ? " · " + esc(o.name) : ""}${o.uid ? " · UID " + esc(o.uid) : ""} · ${dLong(dayKey(o.created_at))} ${hhmm(o.created_at)} (${ago(o.created_at)})</p></div>
        <div class="acts">${acts}</div></li>`;
    }).join("") || `<p class="empty">${filter === "new" ? "Nothing waiting. You're all caught up ✓" : "Nothing here yet."}</p>`;
    $("#more").hidden = list.length <= shown;
    $$("#orders button[data-id]").forEach((b) => b.addEventListener("click", () => setStatus(b.dataset.id, b.dataset.s)));
  }
  $("#more").addEventListener("click", () => { shown += 40; renderOrders(); });
  async function setStatus(id, status) {
    const o = D.orders.find((x) => x.id === id); if (!o) return;
    const patch = { status, closed_at: status === "new" ? null : new Date().toISOString(), auto_closed: false };
    const { error } = await sb.from("orders").update(patch).eq("id", id);
    if (error) return fail("update the order", error);
    Object.assign(o, patch); renderOrders(); renderOverview();
    toast(status === "done" ? `#${o.code} marked bought. ${money(o)} added ✓` : status === "nosale" ? `#${o.code} marked no sale` : `#${o.code} moved back to waiting`);
  }
  $$(".filters button").forEach((b) => b.addEventListener("click", () => {
    filter = b.dataset.f; shown = 40; $$(".filters button").forEach((x) => x.setAttribute("aria-pressed", x === b)); renderOrders();
  }));

  /* new-order alerts: sound + in-page ping + system notification */
  let swReg = null;
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").then((r) => (swReg = r)).catch(() => {});
  navigator.serviceWorker?.addEventListener("message", (e) => { if (e.data && e.data.open) show(e.data.open); });
  const notifyOn = () => { try { return localStorage.getItem("wgs-notify") !== "off"; } catch (e) { return true; } };
  $("#notify").checked = notifyOn();
  $("#notify").addEventListener("change", async (e) => {
    try { localStorage.setItem("wgs-notify", e.target.checked ? "on" : "off"); } catch (err) {}
    if (e.target.checked && "Notification" in window && Notification.permission === "default") {
      const p = await Notification.requestPermission();
      toast(p === "granted" ? "Notifications on ✓" : "Sound and in-page alerts are on. Allow notifications in your browser for pop-ups.");
    }
  });
  let actx;
  function beep() {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      [0, .18].forEach((t, i) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.frequency.value = i ? 1175 : 880; o.type = "sine";
        g.gain.setValueAtTime(.0001, actx.currentTime + t); g.gain.exponentialRampToValueAtTime(.25, actx.currentTime + t + .02); g.gain.exponentialRampToValueAtTime(.0001, actx.currentTime + t + .16);
        o.connect(g).connect(actx.destination); o.start(actx.currentTime + t); o.stop(actx.currentTime + t + .18);
      });
    } catch (e) {}
  }
  document.addEventListener("click", () => { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } catch (e) {} }, { once: true });
  function alertNew(o) {
    if (!notifyOn()) return;
    beep();
    const body = `${o.item} · ${money(o)} · ${o.pay}${o.name ? " · " + o.name : ""}`;
    $("#ping-t").textContent = `New order #${o.code}`; $("#ping-d").textContent = body; $("#ping").hidden = false;
    clearTimeout(alertNew._h); alertNew._h = setTimeout(() => ($("#ping").hidden = true), 9000);
    if (document.hidden && !pushOn && "Notification" in window && Notification.permission === "granted") {   // with phone alerts on, the push message shows it instead
      const opts = { body, icon: "../img/icon-192.png", badge: "../img/favicon.png", tag: o.id };
      if (swReg) swReg.showNotification(`New order #${o.code}`, opts); else try { new Notification(`New order #${o.code}`, opts); } catch (e) {}
    }
  }
  /* phone alerts (web push): this device asks the database to ping it for every new order */
  const b64 = (s) => { const r = atob((s + "=".repeat((4 - s.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(r, (c) => c.charCodeAt(0)); };
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  let pushOn = false;
  function pushNote(text, ok) { const n = $("#push-note"); n.hidden = !text; n.textContent = text; n.classList.toggle("ok", !!ok); }
  async function pushState() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      $("#push").disabled = true;
      pushNote(isIOS && !standalone
        ? "On iPhone: tap Share → Add to Home Screen, open WGS Admin from your home screen, sign in, then switch on Phone alerts."
        : "This browser can't receive phone alerts. Use Chrome on Android, or the home-screen app on iPhone.");
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      pushOn = !!sub && Notification.permission === "granted";
    } catch (e) { pushOn = false; }
    $("#push").checked = pushOn;
    pushNote(pushOn ? "Phone alerts are on for this device. New orders ping you even when the panel is closed." : "", true);
  }
  $("#push").addEventListener("change", async (e) => {
    const want = e.target.checked; e.target.disabled = true;
    try {
      const reg = await navigator.serviceWorker.ready;
      if (want) {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") throw new Error("permission");
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(CFG.vapidPublic) });
        const j = sub.toJSON();
        const device = `${/android/i.test(navigator.userAgent) ? "Android" : isIOS ? "iPhone" : "Computer"} · added ${new Date().toLocaleDateString("en-GB")}`;
        const { error } = await sb.from("push_subscriptions").upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, device }, { onConflict: "endpoint" });
        if (error) { await sub.unsubscribe(); throw error; }
        toast("Phone alerts on ✓");
      } else {
        const sub = await reg.pushManager.getSubscription();
        if (sub) { await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint); await sub.unsubscribe(); }
        toast("Phone alerts off for this device");
      }
    } catch (err) {
      console.error(err);
      toast(err && err.message === "permission"
        ? "Notifications are blocked for this site. Allow them in your browser settings, then try again."
        : "Couldn't change phone alerts. Try again.");
    }
    e.target.disabled = false; pushState();
  });

  $("#ping-x").addEventListener("click", () => ($("#ping").hidden = true));
  $("#ping-open").addEventListener("click", () => {
    $("#ping").hidden = true; filter = "new"; $$(".filters button").forEach((x) => x.setAttribute("aria-pressed", x.dataset.f === "new")); show("orders"); renderOrders();
  });

  let channel;
  function startRealtime() {
    if (channel) return;
    channel = sb.channel("orders-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (p) => {
        if (p.eventType === "INSERT") {
          if (D.orders.some((o) => o.id === p.new.id)) return;
          D.orders.unshift(p.new); renderOrders(p.new.id); renderOverview();
          if (p.new.source === "site") alertNew(p.new);
        } else if (p.eventType === "UPDATE") {
          const o = D.orders.find((x) => x.id === p.new.id); if (o) Object.assign(o, p.new); renderOrders(); renderOverview();
        } else if (p.eventType === "DELETE") {
          D.orders = D.orders.filter((x) => x.id !== p.old.id); renderOrders(); renderOverview();
        }
      })
      .subscribe();
  }
  // Coming back to the tab (e.g. phone was locked): refresh so nothing is missed.
  document.addEventListener("visibilitychange", async () => {
    if (document.hidden || $("#app").hidden) return;
    const { data } = await sb.from("orders").select("*").gte("created_at", new Date(Date.now() - 30 * 864e5).toISOString()).order("created_at", { ascending: false }).limit(2000);
    if (data) { const before = new Set(D.orders.map((o) => o.id)); D.orders = data; renderOrders(); renderOverview(); const fresh = data.filter((o) => !before.has(o.id) && o.source === "site"); if (fresh.length) alertNew(fresh[0]); }
  });

  /* manual sale */
  const pick = { cat: null, pkg: null, pay: "M-Pesa", cty: "KE" };
  const pkgLabel = (p) => { const c = D.cats.find((x) => x.id === p.category) || {}; return c.named || (!p.cp && p.name) ? (p.name || "Item") : `${fmt(p.cp)}${p.bonus ? " + " + fmt(p.bonus) : ""} CP`; };
  function chips(sel, items, key, after) {
    $(sel).innerHTML = items.map(([v, label]) => `<button type="button" data-v="${esc(v)}" aria-pressed="${String(pick[key]) === String(v)}">${esc(label)}</button>`).join("") || '<p class="empty-note">No packages in this type yet.</p>';
    $$("button", $(sel)).forEach((b) => b.addEventListener("click", () => { pick[key] = b.dataset.v; $$("button", $(sel)).forEach((x) => x.setAttribute("aria-pressed", x === b)); (after || fillAmount)(); }));
  }
  function fillAmount() { const p = D.pkgs.find((x) => x.id === pick.pkg); if (p) $("#l-amt").value = fmt(pick.cty === "TZ" ? p.tzs : p.kes); }
  function salesChips() {
    const cats = D.cats.filter((c) => D.pkgs.some((p) => p.category === c.id));
    if (!cats.some((c) => c.id === pick.cat)) pick.cat = cats.length ? cats[0].id : null;
    chips("#c-cat", cats.map((c) => [c.id, c.label]), "cat", () => { pick.pkg = null; salesChips(); });
    const inCat = D.pkgs.filter((p) => p.category === pick.cat);
    if (!inCat.some((p) => p.id === pick.pkg)) pick.pkg = inCat.length ? inCat[0].id : null;
    chips("#c-pkg", inCat.map((p) => [p.id, pkgLabel(p)]), "pkg");
    chips("#c-pay", ["M-Pesa", "Bank transfer", "Apple Pay", "PayPal", "Binance"].map((x) => [x, x]), "pay");
    chips("#c-cty", [["KE", "🇰🇪 Kenya"], ["TZ", "🇹🇿 Tanzania"]], "cty");
    fillAmount();
  }
  $("#log").addEventListener("submit", async (e) => {
    e.preventDefault();
    const p = D.pkgs.find((x) => x.id === pick.pkg), amount = num($("#l-amt").value);
    if (!p || !amount) { $("#l-amt").focus(); return; }
    const row = { code: "M-" + Date.now().toString(36).slice(-5).toUpperCase(), item: pkgLabel(p), category: p.category, amount, currency: pick.cty === "TZ" ? "TZS" : "KES", pay: pick.pay, country: pick.cty, name: $("#l-buyer").value.trim(), status: "done", source: "manual", closed_at: new Date().toISOString() };
    const { data, error } = await sb.from("orders").insert(row).select().single();
    if (error) return fail("log the sale", error);
    if (!D.orders.some((o) => o.id === data.id)) D.orders.unshift(data);
    $("#l-buyer").value = ""; renderOrders(data.id); renderOverview();
    toast(`Sale logged: ${money(data)} ✓`);
  });

  /* ══ prices ═══════════════════════════════════════════════════════════ */
  const dirty = new Set();
  function renderPrices() {
    const cats = D.cats.slice().sort((a, b) => a.sort - b.sort);
    $("#ptable").innerHTML = cats.map((c) => {
      const rows = D.pkgs.filter((p) => p.category === c.id).sort((a, b) => a.sort - b.sort);
      const row = (p) => c.named ? `
          <div class="prow pass ${dirty.has(p.id) ? "dirty" : ""}" data-id="${p.id}">
            <label>Name<input data-k="name" value="${esc(p.name)}" maxlength="60" placeholder="${c.id === "games" ? "e.g. PS5 game key" : "e.g. Battle Pass"}"></label>
            <label>KSH<input data-k="kes" inputmode="numeric" value="${p.kes}"></label>
            <label>TSH<input data-k="tzs" inputmode="numeric" value="${p.tzs}"></label>
            <label class="tagc">Label<input data-k="tag" value="${esc(p.tag)}" maxlength="20" placeholder="e.g. Best value"></label>
            <label class="switch" title="Show on page"><input type="checkbox" class="vis" ${p.show ? "checked" : ""}><span></span></label>
            <button class="x" type="button" aria-label="Remove">✕</button>
          </div>` : `
          <div class="prow ${dirty.has(p.id) ? "dirty" : ""}" data-id="${p.id}">
            <label>CP<input data-k="cp" inputmode="numeric" value="${p.cp}"></label>
            <label>Bonus<input data-k="bonus" inputmode="numeric" value="${p.bonus}"></label>
            <label>KSH<input data-k="kes" inputmode="numeric" value="${p.kes}"></label>
            <label>TSH<input data-k="tzs" inputmode="numeric" value="${p.tzs}"></label>
            <label class="tagc">Label<input data-k="tag" value="${esc(p.tag)}" maxlength="20" placeholder="e.g. Best value"></label>
            <label class="switch" title="Show on page"><input type="checkbox" class="vis" ${p.show ? "checked" : ""}><span></span></label>
            <button class="x" type="button" aria-label="Remove">✕</button>
          </div>`;
      return `<div class="pgroup ${c.live ? "" : "off"}" data-c="${esc(c.id)}">
        <div class="pgroup-h"><h3>${esc(c.label)}${c.live ? "" : " · hidden"}</h3>
          <div class="tools"><label class="switch" title="Show this type as a tab on the shop page"><input type="checkbox" class="live" ${c.live ? "checked" : ""}><span></span>${c.live ? "On shop" : "Hidden"}</label>
          <button class="btn ghost sm add" type="button">+ Add</button></div></div>
        ${c.hint ? `<p class="hint">${esc(c.hint)}</p>` : ""}
        <div class="ptable">${rows.map(row).join("") || '<p class="empty-note">No items yet.</p>'}</div></div>`;
    }).join("");
    $("#dirty").textContent = dirty.size ? `${dirty.size} unpublished change${dirty.size > 1 ? "s" : ""}` : "";
    $$(".pgroup").forEach((g) => {
      const c = D.cats.find((x) => x.id === g.dataset.c);
      $(".live", g).addEventListener("change", async (e) => {
        const { error } = await sb.from("categories").update({ live: e.target.checked }).eq("id", c.id);
        if (error) { e.target.checked = !e.target.checked; return fail("change that", error); }
        c.live = e.target.checked; renderPrices(); toast(c.live ? `${c.label} is now on the shop page ✓` : `${c.label} hidden from the shop page`);
      });
      $(".add", g).addEventListener("click", async () => {
        const sort = Math.max(0, ...D.pkgs.filter((p) => p.category === c.id).map((p) => p.sort)) + 1;
        const { data, error } = await sb.from("packages").insert({ category: c.id, sort, show: false }).select().single();
        if (error) return fail("add an item", error);
        D.pkgs.push(data); dirty.add(data.id); renderPrices(); salesChips();
        $(`.prow[data-id="${data.id}"] input`).focus();
        toast("New item added, hidden until you switch it on and publish");
      });
    });
    $$(".prow").forEach((row) => {
      const p = D.pkgs.find((x) => x.id === row.dataset.id);
      $$("input[data-k]", row).forEach((inp) => inp.addEventListener("input", () => {
        const k = inp.dataset.k; p[k] = k === "tag" || k === "name" ? inp.value : num(inp.value);
        dirty.add(p.id); row.classList.add("dirty"); $("#dirty").textContent = `${dirty.size} unpublished change${dirty.size > 1 ? "s" : ""}`;
      }));
      $(".vis", row).addEventListener("change", (e) => { p.show = e.target.checked; dirty.add(p.id); row.classList.add("dirty"); $("#dirty").textContent = `${dirty.size} unpublished change${dirty.size > 1 ? "s" : ""}`; });
      $(".x", row).addEventListener("click", async () => {
        if (!confirm(`Remove "${pkgLabel(p)}" from the price list?`)) return;
        const { error } = await sb.from("packages").delete().eq("id", p.id);
        if (error) return fail("remove it", error);
        D.pkgs = D.pkgs.filter((x) => x.id !== p.id); dirty.delete(p.id); renderPrices(); salesChips(); toast("Removed ✓");
      });
    });
  }
  $("#pub-prices").addEventListener("click", async () => {
    if (!dirty.size) return toast("Nothing to publish. Prices are up to date ✓");
    const btn = $("#pub-prices"); btn.disabled = true;
    const now = new Date().toISOString();
    const results = await Promise.all([...dirty].map((id) => {
      const p = D.pkgs.find((x) => x.id === id); if (!p) return { error: null };
      return sb.from("packages").update({ name: p.name, note: p.note, cp: p.cp, bonus: p.bonus, kes: p.kes, tzs: p.tzs, tag: p.tag, show: p.show, updated_at: now }).eq("id", id);
    }));
    btn.disabled = false;
    const bad = results.find((r) => r.error);
    if (bad) return fail("publish all prices", bad.error);
    dirty.clear(); renderPrices(); salesChips(); toast("Prices published. Shop page updated ✓");
  });

  /* ══ offer ════════════════════════════════════════════════════════════ */
  const toLocalInput = (iso) => { if (!iso) return ""; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  function renderOffer() {
    const o = D.offer || {};
    $("#o-title").value = o.title || ""; $("#o-detail").value = o.detail || ""; $("#o-end").value = toLocalInput(o.ends_at); $("#o-on").checked = !!o.show;
    previewOffer();
  }
  function previewOffer() {
    $("#o-pt").textContent = $("#o-title").value || "Offer title"; $("#o-pd").textContent = $("#o-detail").value;
    const end = new Date($("#o-end").value), s = Math.max(0, Math.floor((end - Date.now()) / 1000));
    $("#o-pc").textContent = isNaN(end) ? "" : s ? `Ends in ${Math.floor(s / 86400)}d ${Math.floor(s % 86400 / 3600)}h` : "Ended";
    $("#o-prev").classList.toggle("off", !$("#o-on").checked);
    $("#o-state").textContent = $("#o-on").checked ? "On" : "Off";
  }
  ["#o-title", "#o-detail", "#o-end", "#o-on"].forEach((s) => $(s).addEventListener("input", previewOffer));
  $("#pub-offer").addEventListener("click", async () => {
    const title = $("#o-title").value.trim();
    if (!title) { $("#o-title").focus(); return toast("Give the offer a title first"); }
    const end = $("#o-end").value ? new Date($("#o-end").value).toISOString() : null;
    const row = { title, detail: $("#o-detail").value.trim(), ends_at: end, show: $("#o-on").checked, updated_at: new Date().toISOString() };
    const q = D.offer ? sb.from("offers").update(row).eq("id", D.offer.id).select().single() : sb.from("offers").insert(row).select().single();
    const { data, error } = await q;
    if (error) return fail("publish the offer", error);
    D.offer = data; toast(row.show ? "Offer banner is live ✓" : "Offer saved and turned off");
  });

  /* ══ posts ════════════════════════════════════════════════════════════ */
  let kind = "update", editing = null;
  const todayISO = () => dayKey(Date.now());
  function setKind(k) {
    kind = k;
    $$(".seg[aria-label='Post type'] button").forEach((x) => x.setAttribute("aria-pressed", x.dataset.kind === k));
    $$(".only-update").forEach((e) => (e.hidden = kind !== "update"));
    $$(".only-drop").forEach((e) => (e.hidden = kind !== "drop"));
  }
  $$(".seg[aria-label='Post type'] button").forEach((b) => b.addEventListener("click", () => setKind(b.dataset.kind)));
  function startEdit(id) {
    const p = D.posts.find((x) => x.id === id); if (!p) return;
    editing = id; setKind(p.kind);
    $("#p-title").value = p.title; $("#p-msg").value = p.message; $("#p-date").value = p.date; $("#p-pin").checked = !!p.pinned;
    $("#p-submit").textContent = "Save changes"; $("#p-cancel").hidden = false; $("#post").classList.add("editing");
    renderPosts(); $("#post").scrollIntoView({ behavior: "smooth", block: "start" }); $("#p-title").focus({ preventScroll: true });
  }
  function stopEdit() {
    editing = null; $("#post").reset(); $("#p-date").value = todayISO(); setKind("update");
    $("#p-submit").textContent = "Post it"; $("#p-cancel").hidden = true; $("#post").classList.remove("editing"); renderPosts();
  }
  $("#p-cancel").addEventListener("click", stopEdit);
  function renderPosts() {
    if (!$("#p-date").value) $("#p-date").value = todayISO();
    const list = D.posts.slice().sort((a, b) => (b.pinned - a.pinned) || String(b.date).localeCompare(String(a.date)));
    $("#posts").innerHTML = list.map((p) => `
      <li class="${p.id === editing ? "is-edit" : ""}">
        ${p.image_url ? `<img src="${esc(p.image_url)}" alt="">` : `<span class="kind ${p.kind}">${p.kind === "drop" ? "Drop" : p.pinned ? "📌 Pinned" : "Update"}</span>`}
        <div><h3>${esc(p.title)}</h3><p>${esc(p.message)}</p><p style="font-size:.78rem;margin-top:4px">${p.kind === "drop" ? "Drop · " : ""}${dLong(p.date)}${p.edited ? " · edited" : ""}</p></div>
        <div class="acts">${p.id === editing ? '<span class="st" style="color:var(--gold)">Editing…</span>' : `<button class="edit" data-id="${p.id}" type="button">Edit</button><button class="del" data-id="${p.id}" type="button">Delete</button>`}</div>
      </li>`).join("") || '<p class="empty">No posts yet.</p>';
    $$("#posts .edit").forEach((b) => b.addEventListener("click", () => startEdit(b.dataset.id)));
    $$("#posts .del").forEach((b) => b.addEventListener("click", async () => {
      const p = D.posts.find((x) => x.id === b.dataset.id);
      if (!confirm(`Delete "${p.title}"? It disappears from the shop page.`)) return;
      const { error } = await sb.from("posts").delete().eq("id", p.id);
      if (error) return fail("delete the post", error);
      D.posts = D.posts.filter((x) => x.id !== p.id); renderPosts(); toast("Post deleted");
    }));
  }
  async function shrink(file) {   // posters: max 1200px wide JPEG, so they load fast on data bundles
    const img = await createImageBitmap(file);
    const s = Math.min(1, 1200 / img.width), c = document.createElement("canvas");
    c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return new Promise((r) => c.toBlob(r, "image/jpeg", 0.82));
  }
  $("#post").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#p-submit"); btn.disabled = true;
    try {
      let image_url;
      const f = $("#p-img").files[0];
      if (kind === "drop" && f) {
        const blob = await shrink(f);
        const path = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
        const up = await sb.storage.from("posters").upload(path, blob, { contentType: "image/jpeg" });
        if (up.error) throw up.error;
        image_url = sb.storage.from("posters").getPublicUrl(path).data.publicUrl;
      }
      const row = { kind, title: $("#p-title").value.trim(), message: $("#p-msg").value.trim(), date: $("#p-date").value || todayISO(), pinned: kind === "update" && $("#p-pin").checked, updated_at: new Date().toISOString() };
      if (image_url !== undefined) row.image_url = image_url;
      if (kind !== "drop") row.image_url = "";
      if (editing) {
        row.edited = true;
        const { data, error } = await sb.from("posts").update(row).eq("id", editing).select().single();
        if (error) throw error;
        Object.assign(D.posts.find((x) => x.id === editing), data); stopEdit(); toast("Changes saved. Shop page updated ✓");
      } else {
        const { data, error } = await sb.from("posts").insert(row).select().single();
        if (error) throw error;
        D.posts.unshift(data); stopEdit(); toast("Posted to the shop page ✓");
      }
    } catch (err) { fail("save the post", err); }
    btn.disabled = false;
  });

  /* ══ reviews ══════════════════════════════════════════════════════════ */
  const stars = (n) => "★".repeat(n) + `<span class="off">${"★".repeat(5 - n)}</span>`;
  function renderReviews() {
    const pend = D.reviews.filter((r) => r.status === "pending"), live = D.reviews.filter((r) => r.status === "live");
    const item = (r, acts) => `<li><span class="stars" aria-label="${r.stars} of 5">${stars(r.stars)}</span>
      <div><h3>${esc(r.name)} ${flag(r.country)}</h3><p>${esc(r.message)}</p><p style="font-size:.78rem;margin-top:4px">${dLong(dayKey(r.created_at))}</p></div>
      <div class="acts">${acts(r)}</div></li>`;
    $("#pending").innerHTML = pend.map((r) => item(r, (x) => `<button class="ok" data-id="${x.id}" data-a="live" type="button">Approve</button><button class="no" data-id="${x.id}" data-a="delete" type="button">Delete</button>`)).join("") || '<p class="empty">All caught up ✓</p>';
    $("#live").innerHTML = live.map((r) => item(r, (x) => `<button class="no" data-id="${x.id}" data-a="pending" type="button">Hide</button>`)).join("") || '<p class="empty">No reviews showing yet.</p>';
    $("#pend-n").textContent = `(${pend.length})`; $("#live-n").textContent = `(${live.length})`;
    $("#rev-badge").textContent = pend.length || "";
    $$("#pending button, #live button").forEach((b) => b.addEventListener("click", async () => {
      const r = D.reviews.find((x) => x.id === b.dataset.id), a = b.dataset.a;
      if (a === "delete") {
        if (!confirm(`Delete the review from ${r.name}?`)) return;
        const { error } = await sb.from("reviews").delete().eq("id", r.id);
        if (error) return fail("delete the review", error);
        D.reviews = D.reviews.filter((x) => x.id !== r.id); renderReviews(); return toast("Review deleted");
      }
      const { error } = await sb.from("reviews").update({ status: a }).eq("id", r.id);
      if (error) return fail("update the review", error);
      r.status = a; renderReviews(); toast(a === "live" ? "Review approved. It's on the shop page ✓" : "Review hidden");
    }));
  }

  /* ══ settings ═════════════════════════════════════════════════════════ */
  function renderSettings() { $$("#settings [data-s]").forEach((i) => (i.value = D.settings[i.dataset.s] || "")); }
  $("#settings").addEventListener("submit", async (e) => {
    e.preventDefault();
    const now = new Date().toISOString();
    const rows = $$("#settings [data-s]").map((i) => ({ key: i.dataset.s, value: i.value.trim(), updated_at: now }));
    const wa = rows.find((r) => r.key === "whatsapp"); wa.value = wa.value.replace(/\D/g, "");
    if (wa.value.length < 10) return toast("Check the WhatsApp number (e.g. 2547…)");
    const { error } = await sb.from("settings").upsert(rows);
    if (error) return fail("save settings", error);
    rows.forEach((r) => (D.settings[r.key] = r.value)); $("#rate").value = rate(); renderSettings(); renderOverview(); toast("Settings saved ✓");
  });
  $("#pw").addEventListener("submit", async (e) => {
    e.preventDefault();
    const { error } = await sb.auth.updateUser({ password: $("#pw-new").value });
    if (error) return toast(error.message);
    $("#pw-new").value = ""; toast("Password updated ✓");
  });

  /* ══ go ═══════════════════════════════════════════════════════════════ */
  sb.auth.getSession().then(({ data }) => boot(data.session));
})();
