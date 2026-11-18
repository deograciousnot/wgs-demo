# WGS site: how it works

- **Shop page:** https://wgs.ardesams.com
- **Admin panel:** https://wgs.ardesams.com/admin (sign in with the admin email and password)

Everything on the shop page comes from the database and is edited in the admin panel:

| Admin tab | What it does |
|---|---|
| Overview | Today vs yesterday, visitors, order taps, how many taps bought, revenue in KSH or TSH, where visitors come from, the games waitlist, day-by-day table |
| Orders | Every "Order on WhatsApp" tap with its code. Mark **Bought** or **No sale**. Unanswered taps become No sale after 24 h. Log sales that came straight through WhatsApp. |
| Prices | Prices per product type (Double CP, Regular CP, Battle Pass, Console & PC games). Switch types on/off, add items, then **Publish prices**. Also the offer banner. |
| Posts | Updates (pin to top) and upcoming drops (with poster). Edit or delete anytime. |
| Reviews | Reviews buyers send wait here. Approve to show them on the page. |
| Settings | WhatsApp number, catalogue / YouTube / TikTok links, buyers count, delivery time, group members, exchange rate, password. |

## Tips
- Put `?src=tiktok` or `?src=youtube` at the end of the shop link in your bios, so the Overview knows where visitors came from.
- On your phone, open the admin panel and choose **Add to Home screen**. It then opens like an app.
- Switch on **Notify me** in Orders to get a sound and a notification for new orders while the panel is open.

## Never
- Never put buyers' login details anywhere in the panel. Logins stay in WhatsApp.
- Never share the Supabase **secret / service_role key** or the database password. The key in `config.js` is the public one and is safe.

## Technical
- Static site on GitHub Pages, database and login on Supabase (free plan).
- `supabase/schema.sql` creates everything (tables, security rules, storage, stats). Run it only on a new project.
