/* Backup content. The site normally loads everything live from the database (edited in the admin panel).
   This copy is only used if the database can't be reached, so the shop never shows an empty page.
   Same shape as the database tables. */
window.WGS_FALLBACK = {
  settings: { whatsapp: "254748365147", catalogue: "https://wa.me/c/254748365147", youtube: "", tiktok: "", buyers: "700+", delivery: "10–30 min" },
  categories: [
    { id: "double", label: "Double CP 🔥", sort: 1, live: true, named: false, uid: false },
    { id: "regular", label: "Regular CP", sort: 2, live: true, named: false, uid: false },
    { id: "battlepass", label: "Battle Pass", sort: 3, live: true, named: true, uid: true }
  ],
  packages: [
    { category: "double", cp: 800, bonus: 800, kes: 1350, tzs: 27000, usd: "10", tag: "", sort: 1 },
    { category: "double", cp: 2000, bonus: 2000, kes: 3500, tzs: 70000, usd: "27", tag: "", sort: 2 },
    { category: "double", cp: 4000, bonus: 4000, kes: 6500, tzs: 130000, usd: "50", tag: "Most popular", sort: 3 },
    { category: "double", cp: 8000, bonus: 8000, kes: 12000, tzs: 240000, usd: "92", tag: "Best value", sort: 4 }
  ],
  offers: [],
  posts: [],
  reviews: []
};
