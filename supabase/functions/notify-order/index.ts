// WGS notify-order: sends a phone notification to every admin device when a visitor taps "Order on WhatsApp".
// Called only by the database trigger in push.sql (checked with the shared x-wgs-hook secret).
import webpush from "npm:web-push@3.6.7";

const HOOK = Deno.env.get("WGS_HOOK_SECRET") ?? "";
const URL_ = Deno.env.get("SUPABASE_URL") ?? "https://murddncatgcxdyparvmj.supabase.co";
const PUBLISHABLE = "sb_publishable_xnymQb0i3bNkGUk3zcUTpg_wtuXtoQm"; // public key, only used to call push_forget

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "https://wgs.ardesams.com",
  Deno.env.get("VAPID_PUBLIC_KEY") ?? "",
  Deno.env.get("VAPID_PRIVATE_KEY") ?? "",
);

type Sub = { endpoint: string; p256dh: string; auth: string };

Deno.serve(async (req) => {
  if (req.method !== "POST" || !HOOK || req.headers.get("x-wgs-hook") !== HOOK) {
    return new Response("forbidden", { status: 403 });
  }
  const { record: o, subs = [] } = await req.json().catch(() => ({}));
  if (!o) return Response.json({ sent: 0 });

  const money = `${o.currency === "TZS" ? "TSH" : "KSH"} ${Number(o.amount || 0).toLocaleString("en-US")}`;
  const payload = JSON.stringify({
    title: `New order #${o.code}`,
    body: [o.item, money, o.pay, o.name].filter(Boolean).join(" · "),
    tag: o.id,
    url: "./#orders",
  });

  const dead: string[] = [];
  let sent = 0;
  await Promise.all((subs as Sub[]).map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
        { TTL: 6 * 3600, urgency: "high" },
      );
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) dead.push(s.endpoint); // device unsubscribed or app removed
      else console.error("push failed", code, (e as { body?: string }).body);
    }
  }));

  if (dead.length) {
    await fetch(`${URL_}/rest/v1/rpc/push_forget`, {
      method: "POST",
      headers: { apikey: PUBLISHABLE, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: HOOK, p_endpoints: dead }),
    }).catch(() => {});
  }
  return Response.json({ sent, removed: dead.length });
});
