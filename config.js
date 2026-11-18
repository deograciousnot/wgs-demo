/* Supabase connection for the WGS site.
   The publishable key is designed to be public: the database's security rules decide what it can do.
   Never put the secret / service_role key in any file of this site. */
window.WGS_CONFIG = {
  url: "https://murddncatgcxdyparvmj.supabase.co",
  key: "sb_publishable_xnymQb0i3bNkGUk3zcUTpg_wtuXtoQm",
  // Public half of the phone-notification key pair (the private half lives only in Supabase secrets).
  vapidPublic: "BJvcbgyBUxJRUg-sUuJusVoExCQvm3FOrIJzvikvth-GTvdq-Jd4KIP2x96Sp8IxsGiJ0OD8M6ckBwARQnvyqyY"
};
