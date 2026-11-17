/* ─────────────────────────────────────────────────────────────
   WGS settings.
   The site reads prices, offers, announcements, upcoming drops and reviews from a Google Sheet.
   Paste each tab's "Publish to web → CSV" link below (see GUIDE.md).
   While a link is empty, the site uses the demo rows further down.
   ───────────────────────────────────────────────────────────── */
window.WGS = {
  sheets: {
    prices: "",
    offers: "",
    announcements: "",
    drops: "",
    reviews: ""
  },

  whatsapp: "254748365147",       // number orders are sent to, no + or spaces
  buyers: "700+",                 // happy buyers counter
  delivery: "10–30 min",          // usual delivery time  (DEMO: confirm)

  // Product tabs on the price list. A tab hides itself when it has no packages showing.
  categories: [
    { id: "double", label: "Double CP 🔥" },
    { id: "regular", label: "Regular CP" },
    { id: "battlepass", label: "Battle Pass" }
  ],

  demo: {
    // DEMO: double-CP prices are from his current list. Regular CP, Battle Pass and all TZS values are SAMPLES to confirm.
    // category = double | regular | battlepass.  uid = yes asks the buyer for their Player UID (Battle Pass needs only that).
    prices: [
      { category: "double", cp: "800",  bonus: "800",  kes: "1350",  tzs: "27000",  usd: "10", tag: "", show: "yes", updated: "2026-11-17" },
      { category: "double", cp: "2000", bonus: "2000", kes: "3500",  tzs: "70000",  usd: "27", tag: "", show: "yes", updated: "2026-11-17" },
      { category: "double", cp: "4000", bonus: "4000", kes: "6500",  tzs: "130000", usd: "50", tag: "Most popular", show: "yes", updated: "2026-11-17" },
      { category: "double", cp: "8000", bonus: "8000", kes: "12000", tzs: "240000", usd: "92", tag: "Best value", show: "yes", updated: "2026-11-17" },
      { category: "regular", cp: "80",   bonus: "0", kes: "200",   tzs: "4000",   usd: "1.5", tag: "", show: "yes", updated: "2026-11-17" },
      { category: "regular", cp: "400",  bonus: "0", kes: "750",   tzs: "15000",  usd: "6",   tag: "", show: "yes", updated: "2026-11-17" },
      { category: "regular", cp: "800",  bonus: "0", kes: "1350",  tzs: "27000",  usd: "10",  tag: "", show: "yes", updated: "2026-11-17" },
      { category: "regular", cp: "2000", bonus: "0", kes: "3500",  tzs: "70000",  usd: "27",  tag: "Popular", show: "yes", updated: "2026-11-17" },
      { category: "regular", cp: "4000", bonus: "0", kes: "6500",  tzs: "130000", usd: "50",  tag: "", show: "yes", updated: "2026-11-17" },
      { category: "regular", cp: "8000", bonus: "0", kes: "12000", tzs: "240000", usd: "92",  tag: "", show: "yes", updated: "2026-11-17" },
      { category: "battlepass", name: "Battle Pass", note: "This season's premium pass", kes: "750", tzs: "15000", usd: "6", tag: "", uid: "yes", show: "yes", updated: "2026-11-17" },
      { category: "battlepass", name: "Battle Pass Bundle", note: "Premium pass + tier skips", kes: "1950", tzs: "39000", usd: "15", tag: "Best value", uid: "yes", show: "yes", updated: "2026-11-17" }
    ],
    offers: [
      { title: "Double CP is live", detail: "Every package comes with 100% bonus CP. Event ends 20 December.", ends: "2026-12-20T23:59:00Z", show: "yes" }
    ],
    // Upcoming in-game drops. image = a link to his own poster/screenshot (optional).
    drops: [
      { date: "2026-11-19", title: "Mythic Alias", note: "New mythic operator drop. Stock up on CP before it lands.", image: "", show: "yes" },
      { date: "2026-11-26", title: "New season battle pass", note: "Pre-book your CP now and get it delivered on launch day.", image: "", show: "yes" },
      { date: "2026-12-05", title: "Legendary weapon draw", note: "Details coming soon. Watch this space.", image: "", show: "yes" }
    ],
    // Reviews only show when show = yes, so he approves each one first.
    // DEMO: these are SAMPLE reviews to show the layout. Replace with real ones before going live.
    reviews: [
      { name: "Sample · Brian", country: "KE", stars: "5", message: "Paid on M-Pesa, CP landed in about 15 minutes. Will buy again for the next event.", date: "2026-11-15", show: "yes" },
      { name: "Sample · Neema", country: "TZ", stars: "5", message: "First time buying CP outside the game. They explained every step and reminded me to turn 2FA back on.", date: "2026-11-10", show: "yes" },
      { name: "Sample · Kevin", country: "KE", stars: "4", message: "Busy during double CP so it took a bit longer, but they kept me updated the whole time.", date: "2026-11-02", show: "yes" }
    ],
    announcements: [
      { date: "2026-11-17", title: "Double CP season is back", message: "All four packages are doubled until 20 Dec. Orders are open now. Message us on WhatsApp to book your slot.", pinned: "yes" },
      { date: "2026-11-12", title: "Before you order", message: "Unlink any accounts you don't use and have your verification method ready. We'll walk you through everything in the chat.", pinned: "" },
      { date: "2026-11-05", title: "Tanzania is open", message: "We now deliver to Tanzania. Prices shown in TZS when you switch country.", pinned: "" }
    ]
  }
};
