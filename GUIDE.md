# WGS site: how to update it from your phone

Everything that changes on the site lives in one Google Sheet with 5 tabs.
Edit a cell, and the site shows the change the next time someone opens it.

## One-time setup (about 10 minutes)
1. Create a Google Sheet called **WGS site**.
2. Make 5 tabs named exactly: `prices`, `offers`, `announcements`, `drops`, `reviews`.
3. In each tab, import the matching file from `sheet-template/` (File → Import → Upload → "Replace current sheet").
4. File → Share → **Publish to web** → pick the tab → **Comma-separated values (.csv)** → Publish. Copy the link.
5. Paste each link into `data.js` under `sheets:`. Do this for all 5 tabs.

## What each tab does
| Tab | Columns | Tips |
|---|---|---|
| prices | cp, bonus, kes, tzs, usd, tag, show, updated | `bonus` = extra CP during events (0 when there's no event). `tag` = "Best value", "Most popular" or blank. `show` = yes/no. Change `updated` to today's date whenever you edit prices. |
| offers | title, detail, ends, show | The red banner at the top. `ends` like `2026-12-20T23:59:00Z`. It hides itself when time runs out. |
| announcements | date, title, message, pinned | Instructions and news. `pinned` = yes keeps it on top. |
| drops | date, title, note, image, show | Upcoming in-game stuff. `image` = a link to your own poster (optional). Past dates hide themselves. |
| reviews | name, country, stars, message, date, show | Reviews people send land in WhatsApp. Paste the good ones here and set `show` = yes. Country: KE, TZ or UG. |

## Rules of thumb
- Don't rename the column headers.
- Dates as `YYYY-MM-DD`.
- Never post buyers' login details anywhere on the sheet. The sheet is public.
