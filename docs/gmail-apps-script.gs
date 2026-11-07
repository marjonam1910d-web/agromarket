/**
 * AgroMarket → Gmail (HTTPS) ko'prigi.
 * Render bepul tarifida SMTP portlari bloklangan. Shu skript orqali xatlar sizning Gmail'ingizdan
 * HTTPS (443-port) bilan yuboriladi. Bepul limit: kuniga ~100 ta xat (oddiy Gmail akkaunti).
 *
 * O'rnatish (5 daqiqa) — batafsil: docs/DEPLOY_RENDER_SUPABASE.md, "Email (Gmail)" bo'limi:
 *  1. https://script.google.com → New project → shu faylning hammasini joylang.
 *  2. Pastdagi SECRET qiymatini uzun tasodifiy satrga almashtiring (Render'dagi GMAIL_SCRIPT_SECRET bilan bir xil).
 *  3. Deploy → New deployment → turi: Web app → Execute as: Me, Who has access: Anyone → Deploy.
 *  4. Google ruxsat so'raydi → Allow. Chiqqan "Web app URL" (…/exec) ni Render'dagi GMAIL_SCRIPT_URL ga yozing.
 *  Skriptni o'zgartirsangiz: Deploy → Manage deployments → ✏️ → Version: New version → Deploy (URL o'zgarmaydi).
 */
const SECRET = 'BU-YERGA-UZUN-TASODIFIY-SATR-YOZING';

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (!SECRET || SECRET.indexOf('BU-YERGA') === 0 || d.secret !== SECRET) return json_({ ok: false, error: 'forbidden' });
    if (!d.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.to)) return json_({ ok: false, error: 'bad recipient' });
    MailApp.sendEmail({
      to: d.to,
      subject: String(d.subject || 'AgroMarket').slice(0, 200),
      body: String(d.text || ''),
      htmlBody: d.html ? String(d.html) : undefined,
      name: String(d.fromName || 'AgroMarket'),
    });
    return json_({ ok: true, remaining: MailApp.getRemainingDailyQuota() });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

// Brauzerda URL'ni ochib tekshirish uchun: {"ok":true,"service":"agromarket-mail"}
function doGet() {
  return json_({ ok: true, service: 'agromarket-mail', remaining: MailApp.getRemainingDailyQuota() });
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
