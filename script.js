(() => {
  const C = window.WGS;
  const $ = (s) => document.querySelector(s);
  const state = { cur: "kes", pkg: null, cat: null, data: {} };
  try { state.cur = localStorage.getItem("wgs-cur") || "kes"; } catch (e) {}

  /* ── tiny CSV reader (handles quotes and commas inside quotes) ── */
  function parseCSV(text) {
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') q = false;
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); rows.push(row); row = []; cell = "";
      } else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    const head = (rows.shift() || []).map((h) => h.trim().toLowerCase());
    return rows.filter((r) => r.some((c) => c.trim())).map((r) =>
      Object.fromEntries(head.map((h, i) => [h, (r[i] || "").trim()])));
  }

  async function load(key) {
    const url = C.sheets[key];
    if (!url) return C.demo[key];
    try {
      const res = await fetch(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now());
      if (!res.ok) throw new Error(res.status);
      return parseCSV(await res.text());
    } catch (e) {
      console.warn("Sheet failed, using demo data for", key, e);
      return C.demo[key];
    }
  }

  const yes = (v) => /^(y|yes|true|1|on)$/i.test(String(v || "").trim());
  const num = (v) => Number(String(v || "").replace(/[^\d.]/g, ""));
  const money = (v, cur) => {
    const n = num(v);
    if (!n) return "Ask us";
    return (cur === "kes" ? "KSH " : "TSH ") + n.toLocaleString("en-US");
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const wa = (text) => `https://wa.me/${C.whatsapp}?text=${encodeURIComponent(text)}`;

  /* ── prices ── */
  const cats = C.categories || [{ id: "", label: "" }];
  const shown = () => (state.data.prices || []).filter((p) => yes(p.show) || p.show === undefined);
  const inCat = (p, id) => !id || (p.category || cats[0].id) === id;
  const isPass = (p) => p.category === "battlepass" || !!p.name;
  const label = (p) => isPass(p) ? (p.name || "Battle Pass") : `${num(p.cp).toLocaleString("en-US")}${num(p.bonus) ? " + " + num(p.bonus).toLocaleString("en-US") : ""} CP`;
  const needsUid = (p) => yes(p.uid) || p.category === "battlepass";

  function renderCats() {
    const all = shown();
    const live = cats.filter((c) => all.some((p) => inCat(p, c.id)));
    if (!live.some((c) => c.id === state.cat)) state.cat = live.length ? live[0].id : "";
    $("#cats").hidden = live.length < 2;
    $("#cats").innerHTML = live.map((c) => `<button type="button" role="tab" data-c="${esc(c.id)}" aria-selected="${c.id === state.cat}">${esc(c.label)}</button>`).join("");
    $("#cats").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      state.cat = b.dataset.c; state.pkg = null; renderCats(); renderPrices(); updateOrder();
    }));
  }

  function renderPrices() {
    const grid = $("#grid");
    const list = shown().filter((p) => inCat(p, state.cat));
    state.list = list;
    if (!list.length) { grid.innerHTML = '<p class="loading">Prices coming soon. Message us on WhatsApp.</p>'; return; }
    grid.innerHTML = list.map((p, i) => {
      const bonus = num(p.bonus);
      const head = isPass(p)
        ? `<div class="pass">${esc(p.name || "Battle Pass")}</div><p class="bonus">${esc(p.note || "")}${p.note ? " · " : ""}<b>UID only</b></p>`
        : `<div class="cp">${num(p.cp).toLocaleString("en-US")}${bonus ? ` <small>+ ${bonus.toLocaleString("en-US")}</small>` : ""}</div>
           <p class="bonus">${bonus ? `<b>${(num(p.cp) + bonus).toLocaleString("en-US")} CP</b> total` : "CP"}</p>`;
      return `<button type="button" class="card" data-i="${i}" aria-pressed="${state.pkg === i}">
        ${p.tag ? `<span class="tag">${esc(p.tag)}</span>` : ""}
        ${head}
        <div class="price">${money(p[state.cur], state.cur)}</div>
        ${p.usd ? `<div class="usd">≈ $${esc(p.usd)}</div>` : ""}
        <span class="go">${state.pkg === i ? "Selected ✓" : "Choose"}</span>
      </button>`;
    }).join("");
    grid.querySelectorAll(".card").forEach((b) => b.addEventListener("click", () => {
      state.pkg = Number(b.dataset.i); state.code = newCode(); renderPrices(); updateOrder();
      if (matchMedia("(max-width: 760px)").matches) $("#order").scrollIntoView({ behavior: "smooth", block: "start" });
    }));
  }

  document.querySelectorAll(".switch button").forEach((b) => {
    b.addEventListener("click", () => {
      state.cur = b.dataset.cur;
      try { localStorage.setItem("wgs-cur", state.cur); } catch (e) {}
      syncSwitch(); renderPrices(); updateOrder();
    });
  });
  function syncSwitch() {
    document.querySelectorAll(".switch button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.cur === state.cur));
  }

  /* ── order → WhatsApp ── */
  // Each order gets a short code so the shop can match the WhatsApp chat to the order in the admin panel.
  const newCode = () => "WGS-" + String(Math.floor(1000 + Math.random() * 9000));
  state.code = newCode();
  function updateOrder() {
    const send = $("#send");
    const p = state.list && state.list[state.pkg];
    $("#uid-field").hidden = !(p && needsUid(p));
    if (!p) { $("#pick").textContent = "Choose a package above."; send.setAttribute("aria-disabled", "true"); send.href = "#"; send.textContent = "Order on WhatsApp"; return; }
    const price = money(p[state.cur], state.cur);
    const total = num(p.cp) + num(p.bonus);
    $("#pick").innerHTML = (isPass(p)
      ? `<b>${esc(p.name || "Battle Pass")}</b>`
      : `<b>${total.toLocaleString("en-US")} CP</b>${num(p.bonus) ? ` (${esc(p.cp)} + ${esc(p.bonus)} bonus)` : ""}`) + ` · ${esc(price)} <span class="code">#${state.code}</span>`;
    const pay = (document.querySelector('input[name="pay"]:checked') || {}).value || "M-Pesa";
    const name = $("#name").value.trim();
    const uid = $("#uid").value.replace(/\s+/g, "");
    if (needsUid(p) && uid.length < 6) { send.setAttribute("aria-disabled", "true"); send.href = "#"; send.textContent = "Enter your Player UID"; return; }
    send.textContent = "Order on WhatsApp";
    const msg = [
      `Hi WGS 👋 I'd like to order (#${state.code}):`,
      `• ${label(p)}${!isPass(p) && num(p.bonus) ? ` (${total.toLocaleString("en-US")} total)` : ""}`,
      `• Price: ${price}`,
      `• Paying with: ${pay}`,
      `• Country: ${state.cur === "kes" ? "Kenya" : "Tanzania"}`,
      needsUid(p) ? `• Player UID: ${uid}` : "",
      name ? `• Name: ${name}` : ""
    ].filter(Boolean).join("\n");
    send.href = wa(msg);
    send.removeAttribute("aria-disabled");
  }
  document.querySelectorAll('input[name="pay"]').forEach((r) => r.addEventListener("change", updateOrder));
  $("#name").addEventListener("input", updateOrder);
  $("#uid").addEventListener("input", updateOrder);
  // In the full version this tap is also recorded, so the shop gets a notification in the admin panel.
  $("#send").addEventListener("click", () => setTimeout(() => { state.code = newCode(); updateOrder(); }, 500));

  /* ── offer banner + countdown ── */
  let timer;
  function renderOffer() {
    const o = (state.data.offers || []).find((x) => yes(x.show));
    const box = $("#offer");
    if (!o) { box.hidden = true; return; }
    const end = o.ends ? new Date(o.ends) : null;
    if (end && end < new Date()) { box.hidden = true; return; }
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

  /* ── announcements ── */
  function renderNews() {
    const list = (state.data.announcements || []).slice().sort((a, b) =>
      (yes(b.pinned) - yes(a.pinned)) || String(b.date).localeCompare(String(a.date)));
    const fmt = (d) => { const x = new Date(d); return isNaN(x) ? esc(d || "") : x.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); };
    $("#newslist").innerHTML = list.length ? list.map((a) => `
      <article class="post${yes(a.pinned) ? " pinned" : ""}">
        <p class="meta">${yes(a.pinned) ? '<span class="pin">📌 Pinned</span>' : ""}<span>${fmt(a.date)}</span></p>
        <h3>${esc(a.title || "")}</h3>
        <p>${esc(a.message || "")}</p>
      </article>`).join("") : '<p class="sub">No updates right now.</p>';
  }

  /* ── upcoming drops ── */
  function renderDrops() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const list = (state.data.drops || []).filter((d) => yes(d.show) && !(new Date(d.date) < today))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const sec = $("#drops");
    if (!list.length) { sec.hidden = true; return; }
    sec.hidden = false;
    const fmt = (d) => { const x = new Date(d); return isNaN(x) ? esc(d || "Soon") : x.toLocaleDateString("en-GB", { day: "numeric", month: "short" }); };
    const days = (d) => { const n = Math.round((new Date(d) - today) / 864e5); return isNaN(n) ? "" : n === 0 ? "Today" : n === 1 ? "Tomorrow" : `In ${n} days`; };
    const safeUrl = (u) => /^https:\/\//i.test(u || "") ? u : "";
    $("#droplist").innerHTML = list.map((d) => `
      <article class="drop">
        <div class="pic">${safeUrl(d.image) ? `<img src="${esc(d.image)}" alt="${esc(d.title)}" loading="lazy">` : "Poster"}</div>
        <span class="date">${fmt(d.date)}</span>
        <div class="body"><h3>${esc(d.title || "")}</h3><p>${esc(d.note || "")}</p><span class="soon-t">${days(d.date)}</span></div>
      </article>`).join("");
  }

  /* ── reviews ── */
  function renderReviews() {
    const list = (state.data.reviews || []).filter((r) => yes(r.show))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const flag = { KE: "🇰🇪", TZ: "🇹🇿", UG: "🇺🇬" };
    const stars = (n) => { n = Math.max(0, Math.min(5, Math.round(num(n) || 5))); return "★".repeat(n) + `<span class="off">${"★".repeat(5 - n)}</span>`; };
    $("#reviewlist").innerHTML = list.length ? list.map((r) => `
      <figure class="review${/^sample/i.test(r.name) ? " sample" : ""}">
        <div class="stars" aria-label="${num(r.stars) || 5} out of 5">${stars(r.stars)}</div>
        <blockquote>${esc(r.message || "")}</blockquote>
        <figcaption><b>${esc(r.name || "Buyer")}</b> ${flag[r.country] || ""}</figcaption>
      </figure>`).join("") : '<p class="sub">Be the first to leave a review.</p>';
    if (list.length) {
      const avg = list.reduce((s, r) => s + (num(r.stars) || 5), 0) / list.length;
      $("#rating").innerHTML = `<b>★ ${avg.toFixed(1)}</b> from ${list.length} review${list.length > 1 ? "s" : ""} · real reviews from real orders.`;
    }
  }

  const form = $("#review-form"), opener = $("#review-open");
  opener.addEventListener("click", () => {
    form.hidden = !form.hidden;
    opener.setAttribute("aria-expanded", String(!form.hidden));
    if (!form.hidden) $("#r-name").focus();
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const n = (form.querySelector('input[name="stars"]:checked') || {}).value || "5";
    const msg = `Review for WGS ${"⭐".repeat(Number(n))}\nName: ${$("#r-name").value.trim()}\nCountry: ${$("#r-country").value}\n\n${$("#r-msg").value.trim()}`;
    window.open(wa(msg), "_blank", "noopener");
    form.reset(); form.hidden = true; opener.setAttribute("aria-expanded", "false");
    opener.textContent = "Thanks! Leave another";
  });

  /* ── static bits ── */
  const hi = wa("Hi WGS 👋");
  ["#nav-wa", "#fab"].forEach((s) => ($(s).href = hi));
  // "Notify me" for console & PC games. In the full version each tap is also counted on the admin waitlist.
  const soon = () => {
    const plat = (document.querySelector('.plats button[aria-pressed="true"]') || {}).textContent || "PlayStation";
    $("#soon-wa").href = wa(`Hi WGS 👋 Please notify me when console & PC games launch. My platform: ${plat}`);
  };
  document.querySelectorAll(".plats button").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(".plats button").forEach((x) => x.setAttribute("aria-pressed", x === b)); soon();
  }));
  soon();
  $("#stat-buyers").textContent = C.buyers;
  $("#stat-delivery").textContent = C.delivery;
  document.querySelectorAll(".js-delivery").forEach((e) => (e.textContent = C.delivery));
  $("#year").textContent = new Date().getFullYear();
  syncSwitch();

  /* ── go ── */
  const keys = ["prices", "offers", "announcements", "drops", "reviews"];
  Promise.all(keys.map(load)).then((res) => {
    keys.forEach((k, i) => (state.data[k] = res[i] || []));
    renderCats(); renderPrices(); renderOffer(); renderNews(); renderDrops(); renderReviews();
    const last = state.data.prices.map((p) => p.updated).filter(Boolean).sort().pop();
    const d = last && new Date(last);
    if (d && !isNaN(d)) $("#updated").textContent = `Prices change with in-game events. Last updated ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.`;
  });
})();
