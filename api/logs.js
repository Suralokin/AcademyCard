import { list, get } from '@vercel/blob';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtTime(ts) {
  try {
    return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(ts));
  } catch (e) {
    return new Date(ts).toISOString();
  }
}

function flag(code) {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1f1e6 + c.charCodeAt(0) - 65));
}

async function readVisits(limit = 100) {
  const listing = await list({ prefix: 'visits/', limit });
  const names = listing.blobs
    .map(b => b.pathname)
    .sort()
    .reverse();
  const results = await Promise.all(names.map(async pathname => {
    try {
      const blobMeta = listing.blobs.find(b => b.pathname === pathname);
      const r = await get(blobMeta.url, { access: 'private' });
      if (r.statusCode !== 200 || !r.stream) return null;
      return JSON.parse(await new Response(r.stream).text());
    } catch (e) {
      return null;
    }
  }));
  return results.filter(Boolean).sort((a, b) => (b.t || 0) - (a.t || 0));
}

function renderForm(msg) {
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><meta name="robots" content="noindex,nofollow"><title>Журнал посещений — вход</title></head>
<body style="font-family:Arial,sans-serif;background:#111;color:#eee;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<div style="background:#1c1c1c;padding:30px;border-radius:12px;box-shadow:0 0 20px #000;text-align:center">
<h2>Журнал посещений</h2><p style="color:#999">Введите пароль доступа</p>
<form method="GET" action=""><input type="password" name="p" placeholder="Пароль" autofocus style="padding:10px;border-radius:8px;border:1px solid #444;background:#222;color:#eee;font-size:16px;width:220px"> <button style="padding:10px 18px;border-radius:8px;border:0;background:#fc3f1d;color:#fff;font-weight:bold;cursor:pointer">Открыть</button></form>
${msg ? `<p style="color:#fc3f1d">${esc(msg)}</p>` : ''}
</div></body></html>`;
}

export default async function handler(req, res) {
  const key = process.env.LOG_KEY;
  const p = req.query.p || '';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (!key || p !== key) {
    return res.status(401).send(renderForm(p ? 'Неверный пароль' : ''));
  }
  let visits = [];
  let readError = '';
  try {
    visits = await readVisits(100);
  } catch (e) {
    readError = String((e && e.message) || e).slice(0, 300);
  }
  const rows = visits.map(v => `
<tr>
  <td style="padding:6px 10px;white-space:nowrap">${fmtTime(v.t)}</td>
  <td style="padding:6px 10px">${flag(v.country)} ${esc(v.city || v.country || '—')}${v.region ? ', ' + esc(v.region) : ''}</td>
  <td style="padding:6px 10px">${esc(v.browser || '—')} (${esc(v.device || '—')})</td>
  <td style="padding:6px 10px">${esc(v.screen || '—')}</td>
  <td style="padding:6px 10px">${v.ref ? esc(v.ref) : '<span style="color:#666">прямой заход</span>'}</td>
</tr>`).join('');
  const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><meta name="robots" content="noindex,nofollow"><title>Журнал посещений — Карты Академии</title></head>
<body style="font-family:Arial,sans-serif;background:#111;color:#ddd;margin:0;padding:24px">
<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
<h1 style="margin-top:0;margin-bottom:0">Журнал посещений сайта</h1>
<a href="https://metrika.yandex.ru/dashboard?id=95965180" target="_blank" rel="nofollow"
   style="display:inline-flex;align-items:center;gap:8px;background:#ffffff;color:#333;border-radius:6px;padding:7px 12px;text-decoration:none;font-size:13px;font-weight:bold;border:1px solid #e0e0e0;transition:box-shadow .2s"
   onmouseover="this.style.boxShadow='0 0 8px rgba(252,63,29,.5)'" onmouseout="this.style.boxShadow='none'">
  <span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;background:#fc3f1d;color:#fff;border-radius:4px;font-size:12px;font-weight:700">Я</span>
  Личный кабинет Яндекс.Метрики — полная статистика
</a>
</div>
<p style="color:#888">Показано визитов: ${visits.length} · время московское · обновите страницу (F5), чтобы увидеть новые${readError ? `</p><p style="color:#fc3f1d;font-size:12px">Ошибка чтения: ${esc(readError)}` : ''}</p>
<div style="overflow:auto"><table border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#1c1c1c;border-radius:10px;min-width:760px">
<thead><tr style="background:#333;color:#fff">
<th style="padding:10px;text-align:left">Когда (МСК)</th><th style="padding:10px;text-align:left">Откуда</th><th style="padding:10px;text-align:left">Устройство</th><th style="padding:10px;text-align:left">Экран</th><th style="padding:10px;text-align:left">Пришёл с</th>
</tr></thead><tbody>${rows || '<tr><td colspan="5" style="padding:20px;color:#888">Пока никто не заходил</td></tr>'}</tbody></table></div>
<p style="margin-top:20px"><a href="/" style="color:#888">&larr; вернуться на сайт</a></p>
</body></html>`;
  return res.status(200).send(html);
}
