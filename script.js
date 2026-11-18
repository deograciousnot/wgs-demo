/* WGS shop page. Content is loaded live from the database (edited in the admin panel).
   Visitors can only ADD rows here (order taps, reviews, anonymous stats). They can never read or change anything private. */
(() => {
  const CFG = window.WGS_CONFIG || {};
  const FB = window.WGS_FALLBACK || {};
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const state = { cur: "kes", pkg: null, cat: null, list: [], cats: [], pkgs: [], set: {} };
  try { state.cur = localStorage.getItem("wgs-cur") || "kes"; } catch (e) {}

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => Number(String(v ?? "").replace(/[^\d.]/g, "")) || 0;
  const fmtN = (n) => Math.round(n).toLocaleString("en-US");
  const money = (v, cur) => num(v) ? (cur === "kes" ? "KSH " : "TSH ") + fmtN(num(v)) : "Ask us";
  const dateGB = (d, o = { day: "numeric", month: "short", year: "numeric" }) => { const x = new Date(d); return isNaN(x) ? "" : x.toLocaleDateString("en-GB", o); };
  const wa = (text) => `https://wa.me/${state.set.whatsapp || "254748365147"}?text=${encodeURIComponent(text)}`;
  const safeUrl = (u) => /^https:\/\//i.test(u || "") ? u : "";

  /* ── database (plain REST calls, no library needed) ── */
  const H = { apikey: CFG.key };
  async function get(path) {
    const res = await fetch(`${CFG.url}/rest/v1/${path}`, { headers: H });
    if (!res.ok) throw new Error(`${path}: ${res.status}`);
    return res.json();
  }
  function add(table, row) {   // keepalive so the row still saves if WhatsApp opens and the page goes to the background
    if (!CFG.url) return Promise.resolve();
    return fetch(`${CFG.url}/rest/v1/${table}`, {
      method: "POST", keepalive: true,
      headers: { ...H, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(row)
    }).catch(() => {});
  }

  /* ── anonymous visit stats ── */
  const visitor = (() => {
    try { let v = localStorage.getItem("wgs-vid"); if (!v) { v = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem("wgs-vid", v); } return v; }
    catch (e) { return "s-" + Math.random().toString(36).slice(2); }
  })();
  const country = (() => {
    const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || "");
    return tz === "Africa/Nairobi" ? "KE" : tz === "Africa/Dar_es_Salaam" ? "TZ" : tz === "Africa/Kampala" ? "UG" : "Other";
  })();
  const source = (() => {
    const q = new URLSearchParams(location.search);
    const s = (q.get("src") || q.get("utm_source") || "").toLowerCase();
    if (s) return s.slice(0, 30);
    const r = document.referrer.toLowerCase();
    if (!r || r.includes(location.host)) return "direct";
    for (const k of ["tiktok", "youtube", "whatsapp", "google", "instagram", "facebook", "twitter", "t.co"]) if (r.includes(k)) return k === "t.co" ? "twitter" : k;
    return "other";
  })();
  const track = (type, ref = "") => add("events", { type, ref: String(ref).slice(0, 80), country, source, visitor });

  /* ── load ── */
  async function load() {
    try {
      const [settings, categories, packages, offers, posts, reviews] = await Promise.all([
        get("settings?select=key,value"),
        get("categories?select=*&order=sort"),
        get("packages?select=*&show=eq.true&order=category,sort"),
        get("offers?select=*&show=eq.true&order=updated_at.desc&limit=1"),
        get("posts?select=*&order=pinned.desc,date.desc&limit=40"),
        get("reviews?select=name,country,stars,message,created_at&status=eq.live&order=created_at.desc&limit=30")
      ]);
      return { settings: Object.fromEntries(settings.map((r) => [r.key, r.value])), categories, packages, offers, posts, reviews };
    } catch (e) {
      console.warn("Database not reachable, showing backup content.", e);
      return FB;
    }
  }

  /* ── prices ── */
  const catOf = (id) => state.cats.find((c) => c.id === id) || {};
  const isNamed = (p) => !!catOf(p.category).named || (!p.cp && !!p.name);
  const needsUid = (p) => !!catOf(p.category).uid;
  const label = (p) => isNamed(p) ? (p.name || "Item") : `${fmtN(p.cp)}${num(p.bonus) ? " + " + fmtN(p.bonus) : ""} CP`;

  function renderCats() {
    const live = state.cats.filter((c) => c.live && state.pkgs.some((p) => p.category === c.id));
    if (!live.some((c) => c.id === state.cat)) state.cat = live.length ? live[0].id : null;
    $("#cats").hidden = live.length < 2;
    $("#cats").innerHTML = live.map((c) => `<button type="button" role="tab" data-c="${esc(c.id)}" aria-selected="${c.id === state.cat}">${esc(c.label)}</button>`).join("");
    $$("#cats button").forEach((b) => b.addEventListener("click", () => {
      state.cat = b.dataset.c; state.pkg = null; renderCats(); renderPrices(); updateOrder();
    }));
  }

  function renderPrices() {
    const grid = $("#grid");
    state.list = state.pkgs.filter((p) => p.category === state.cat);
    if (!state.list.length) { grid.innerHTML = '<p class="loading">Prices coming soon. Message us on WhatsApp.</p>'; return; }
    grid.innerHTML = state.list.map((p, i) => {
      const bonus = num(p.bonus);
      const head = isNamed(p)
        ? `<div class="pass">${esc(p.name)}</div><p class="bonus">${esc(p.note || "")}${p.note && needsUid(p) ? " · " : ""}${needsUid(p) ? "<b>UID only</b>" : ""}</p>`
        : `<div class="cp">${fmtN(p.cp)}${bonus ? ` <small>+ ${fmtN(bonus)}</small>` : ""}</div>
           <p class="bonus">${bonus ? `<b>${fmtN(num(p.cp) + bonus)} CP</b> total` : "CP"}</p>`;
      return `<button type="button" class="card" data-i="${i}" aria-pressed="${state.pkg === i}">
        ${p.tag ? `<span class="tag">${esc(p.tag)}</span>` : ""}
        ${head}
        <div class="price">${money(p[state.cur], state.cur)}</div>
        ${p.usd ? `<div class="usd">≈ $${esc(p.usd)}</div>` : ""}
        <span class="go">${state.pkg === i ? "Selected ✓" : "Choose"}</span>
      </button>`;
    }).join("");
    $$("#grid .card").forEach((b) => b.addEventListener("click", () => {
      state.pkg = Number(b.dataset.i); state.code = newCode(); renderPrices(); updateOrder();
      if (matchMedia("(max-width: 760px)").matches) $("#order").scrollIntoView({ behavior: "smooth", block: "start" });
    }));
  }

  $$(".switch button").forEach((b) => b.addEventListener("click", () => {
    state.cur = b.dataset.cur;
    try { localStorage.setItem("wgs-cur", state.cur); } catch (e) {}
    syncSwitch(); renderPrices(); updateOrder();
  }));
  function syncSwitch() { $$(".switch button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.cur === state.cur)); }

  /* ── order → WhatsApp (and a row in the admin's orders inbox) ── */
  const newCode = () => "WGS-" + String(Math.floor(1000 + Math.random() * 9000));
  state.code = newCode();
  function current() {
    const p = state.list[state.pkg];
    if (!p) return null;
    return {
      p, price: money(p[state.cur], state.cur), amount: num(p[state.cur]),
      pay: ($('input[name="pay"]:checked') || {}).value || "M-Pesa",
      name: $("#name").value.trim(), uid: $("#uid").value.replace(/\s+/g, "")
    };
  }
  function updateOrder() {
    const send = $("#send"), o = current();
    $("#uid-field").hidden = !(o && needsUid(o.p));
    const off = (text) => { send.setAttribute("aria-disabled", "true"); send.href = "#"; send.textContent = text; };
    if (!o) { $("#pick").textContent = "Choose a package above."; return off("Order on WhatsApp"); }
    const total = num(o.p.cp) + num(o.p.bonus);
    $("#pick").innerHTML = (isNamed(o.p)
      ? `<b>${esc(o.p.name)}</b>`
      : `<b>${fmtN(total)} CP</b>${num(o.p.bonus) ? ` (${fmtN(o.p.cp)} + ${fmtN(o.p.bonus)} bonus)` : ""}`) + ` · ${esc(o.price)} <span class="code">#${state.code}</span>`;
    if (needsUid(o.p) && o.uid.length < 6) return off("Enter your Player UID");
    send.textContent = "Order on WhatsApp";
    const msg = [
      `Hi WGS 👋 I'd like to order (#${state.code}):`,
      `• ${label(o.p)}${!isNamed(o.p) && num(o.p.bonus) ? ` (${fmtN(total)} total)` : ""}`,
      `• Price: ${o.price}`,
      `• Paying with: ${o.pay}`,
      `• Country: ${state.cur === "kes" ? "Kenya" : "Tanzania"}`,
      needsUid(o.p) ? `• Player UID: ${o.uid}` : "",
      o.name ? `• Name: ${o.name}` : ""
    ].filter(Boolean).join("\n");
    send.href = wa(msg);
    send.removeAttribute("aria-disabled");
  }
  $$('input[name="pay"]').forEach((r) => r.addEventListener("change", updateOrder));
  $("#name").addEventListener("input", updateOrder);
  $("#uid").addEventListener("input", updateOrder);
  $("#send").addEventListener("click", () => {
    const o = current();
    if (!o || $("#send").getAttribute("aria-disabled") === "true") return;
    add("orders", {
      code: state.code, item: label(o.p), category: o.p.category, amount: o.amount,
      currency: state.cur === "kes" ? "KES" : "TZS", pay: o.pay, country: state.cur === "kes" ? "KE" : "TZ",
      uid: needsUid(o.p) ? o.uid.slice(0, 30) : "", name: o.name.slice(0, 40)
    });
    track("tap", label(o.p));
    setTimeout(() => { state.code = newCode(); updateOrder(); }, 600);
  });

  /* ── offer banner + countdown ── */
  let timer;
  function renderOffer(o) {
    const box = $("#offer");
    const end = o && o.ends_at ? new Date(o.ends_at) : null;
    if (!o || (end && end < new Date())) { box.hidden = true; return; }
    $("#offer-title").textContent = o.title;
    $("#offer-detail").textContent = o.detail || "";
    box.hidden = false;
    clearInterval(timer);
    const tick = () => {
      if (!end || isNaN(end)) { $("#offer-count").hidden = true; return; }
      const s = Math.max(0, Math.floor((end - Date.now()) / 1000));
      if (!s) { box.hidden = true; clearInterval(timer); return; }
      const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
      $("#offer-count").textContent = `Ends in ${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
    };
    tick(); timer = setInterval(tick, 1000);
  }

  /* ── updates + drops ── */
  function renderPosts(posts) {
    const news = posts.filter((p) => p.kind === "update");
    $("#newslist").innerHTML = news.length ? news.map((a) => `
      <article class="post${a.pinned ? " pinned" : ""}">
        <p class="meta">${a.pinned ? '<span class="pin">📌 Pinned</span>' : ""}<span>${dateGB(a.date)}</span></p>
        <h3>${esc(a.title)}</h3>
        <p>${esc(a.message)}</p>
      </article>`).join("") : '<p class="sub">No updates right now.</p>';

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const drops = posts.filter((p) => p.kind === "drop" && !(new Date(p.date + "T00:00") < today))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    $("#drops").hidden = !drops.length;
    const days = (d) => { const n = Math.round((new Date(d + "T00:00") - today) / 864e5); return isNaN(n) ? "" : n === 0 ? "Today" : n === 1 ? "Tomorrow" : `In ${n} days`; };
    $("#droplist").innerHTML = drops.map((d) => `
      <article class="drop">
        <div class="pic">${safeUrl(d.image_url) ? `<img src="${esc(d.image_url)}" alt="${esc(d.title)}" loading="lazy">` : ""}</div>
        <span class="date">${dateGB(d.date, { day: "numeric", month: "short" })}</span>
        <div class="body"><h3>${esc(d.title)}</h3><p>${esc(d.message)}</p><span class="soon-t">${days(d.date)}</span></div>
      </article>`).join("");
  }

  /* ── reviews ── */
  const flag = { KE: "🇰🇪", TZ: "🇹🇿", UG: "🇺🇬" };
  function renderReviews(list) {
    const stars = (n) => { n = Math.max(1, Math.min(5, num(n) || 5)); return "★".repeat(n) + `<span class="off">${"★".repeat(5 - n)}</span>`; };
    $("#reviewlist").innerHTML = list.length ? list.map((r) => `
      <figure class="review">
        <div class="stars" aria-label="${num(r.stars)} out of 5">${stars(r.stars)}</div>
        <blockquote>${esc(r.message)}</blockquote>
        <figcaption><b>${esc(r.name)}</b> ${flag[r.country] || ""}</figcaption>
      </figure>`).join("") : '<p class="sub">No reviews yet. Bought from us? Be the first.</p>';
    if (list.length) {
      const avg = list.reduce((s, r) => s + num(r.stars), 0) / list.length;
      $("#rating").innerHTML = `<b>★ ${avg.toFixed(1)}</b> from ${list.length} review${list.length > 1 ? "s" : ""} · real reviews from real orders.`;
    }
  }
  const form = $("#review-form"), opener = $("#review-open");
  opener.addEventListener("click", () => {
    form.hidden = !form.hidden;
    opener.setAttribute("aria-expanded", String(!form.hidden));
    if (!form.hidden) $("#r-name").focus();
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#r-send");
    if (btn.disabled) return;
    btn.disabled = true; btn.textContent = "Sending…";
    const row = {
      name: $("#r-name").value.trim().slice(0, 40),
      country: $("#r-country").value,
      stars: Number(($('input[name="stars"]:checked') || {}).value || 5),
      message: $("#r-msg").value.trim().slice(0, 400)
    };
    let ok = false;
    try {
      const res = await fetch(`${CFG.url}/rest/v1/reviews`, { method: "POST", headers: { ...H, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(row) });
      ok = res.ok;
    } catch (err) {}
    btn.disabled = false; btn.textContent = "Send review";
    if (ok) {
      form.reset(); form.hidden = true; opener.setAttribute("aria-expanded", "false");
      opener.textContent = "Thanks! Your review is in ✓";
    } else {
      $("#r-note").textContent = "Couldn't send right now. Please try again, or send it to us on WhatsApp.";
    }
  });

  /* ── console & PC games waitlist ── */
  const soon = () => {
    const plat = ($('.plats button[aria-pressed="true"]') || {}).textContent || "PlayStation";
    $("#soon-wa").href = wa(`Hi WGS 👋 Please notify me when console & PC games launch. My platform: ${plat}`);
  };
  $$(".plats button").forEach((b) => b.addEventListener("click", () => {
    $$(".plats button").forEach((x) => x.setAttribute("aria-pressed", x === b)); soon();
  }));
  $("#soon-wa").addEventListener("click", () => track("notify", ($('.plats button[aria-pressed="true"]') || {}).textContent || "PlayStation"));

  /* ── settings-driven bits ── */
  const ICONS = {
    youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1c.4-1.6.5-3.2.5-4.8s-.1-3.2-.5-4.8zM9.7 15V9l5.8 3-5.8 3z"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.6 2h-3.4v13.4a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V9.1a6.4 6.4 0 1 0 5.4 6.3V8.6a8 8 0 0 0 4.7 1.5V6.7a4.7 4.7 0 0 1-4.7-4.7z"/></svg>',
    catalogue: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z"/></svg>'
  };
  function applySettings(s) {
    state.set = s;
    const hi = wa("Hi WGS 👋");
    ["#nav-wa", "#fab"].forEach((sel) => ($(sel).href = hi));
    if (s.buyers) { $("#stat-buyers").textContent = s.buyers; $$(".js-buyers").forEach((e) => (e.textContent = s.buyers)); }
    if (s.delivery) { $("#stat-delivery").textContent = s.delivery; $$(".js-delivery").forEach((e) => (e.textContent = s.delivery)); }
    if (safeUrl(s.catalogue)) { $("#catalogue").href = s.catalogue; $("#catalogue").hidden = false; }
    const links = [["youtube", "YouTube"], ["tiktok", "TikTok"], ["catalogue", "Catalogue"]].filter(([k]) => safeUrl(s[k]));
    $("#socials").innerHTML = links.map(([k, name]) => `<a href="${esc(s[k])}" target="_blank" rel="noopener">${ICONS[k]}${name}</a>`).join("");
    $("#follow").hidden = !links.length;
    soon();
  }

  /* ── go ── */
  $("#year").textContent = new Date().getFullYear();
  syncSwitch();
  load().then((d) => {
    state.cats = (d.categories || []).slice().sort((a, b) => a.sort - b.sort);
    state.pkgs = (d.packages || []).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0));
    applySettings(d.settings || {});
    renderCats(); renderPrices(); updateOrder();
    renderOffer((d.offers || [])[0]);
    renderPosts(d.posts || []);
    renderReviews(d.reviews || []);
    const last = state.pkgs.map((p) => p.updated_at).filter(Boolean).sort().pop();
    if (last) $("#updated").textContent = `Prices change with in-game events. Last updated ${dateGB(last)}.`;
  });
  track("view");
})();
