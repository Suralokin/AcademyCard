import { put } from '@vercel/blob';

export default async function handler(req, res) {
  try {
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    let body = {};
    try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); } catch (e) {}

    const h = req.headers;
    const ua = String(h['user-agent'] || '');
    let city = '';
    try { city = decodeURIComponent(h['x-vercel-ip-city'] || ''); } catch (e) { city = String(h['x-vercel-ip-city'] || ''); }

    const entry = {
      t: Date.now(),
      country: h['x-vercel-ip-country'] || '',
      region: h['x-vercel-ip-country-region'] || '',
      city,
      browser: /YaBrowser/i.test(ua) ? 'Яндекс' : /Edg\//i.test(ua) ? 'Edge' : /OPR|Opera/i.test(ua) ? 'Opera' : /Chrome/i.test(ua) ? 'Chrome' : /Firefox/i.test(ua) ? 'Firefox' : /Safari/i.test(ua) ? 'Safari' : 'Другой',
      device: /Mobile|Android|iPhone/i.test(ua) ? 'телефон' : /iPad|Tablet/i.test(ua) ? 'планшет' : 'компьютер',
      lang: String(body.lang || h['accept-language'] || '').slice(0, 12),
      screen: String(body.screen || '').replace(/[^\dx]/gi, '').slice(0, 16),
      ref: (() => { try { return new URL(String(body.ref || '')).hostname; } catch (e) { return ''; } })(),
      page: String(body.page || '/').slice(0, 60)
    };

    const name = `visits/${entry.t}-${Math.random().toString(36).slice(2, 8)}.json`;
    await put(name, JSON.stringify(entry), { access: 'private', addRandomSuffix: false });

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'store failed', detail: String((e && e.message) || e).slice(0, 300) });
  }
}
