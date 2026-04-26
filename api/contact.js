/**
 * Vercel Edge Function — POST /api/contact
 * Envía el formulario de contacto usando Resend.
 *
 * Variables de entorno requeridas en Vercel Dashboard:
 *   RESEND_API_KEY  → tu API key de resend.com (gratis hasta 3k emails/mes)
 *   CONTACT_TO      → email destino, ej: contacto@nuvika.cl
 */

export const config = { runtime: 'edge' };

const ALLOWED_ORIGIN = 'https://nuvika.cl';

export default async function handler(req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido' }, 405);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Body inválido' }, 400);
  }

  const { nombre, email, empresa, mensaje } = body;

  // Validación
  if (!nombre?.trim() || !email?.trim() || !mensaje?.trim()) {
    return json({ error: 'Faltan campos obligatorios' }, 422);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Email inválido' }, 422);
  }
  if (mensaje.length > 2000) {
    return json({ error: 'Mensaje demasiado largo (máx 2000 caracteres)' }, 422);
  }

  const apiKey  = process.env.RESEND_API_KEY;
  const toEmail = process.env.CONTACT_TO || 'contacto@nuvika.cl';

  if (!apiKey) {
    console.error('RESEND_API_KEY no configurada');
    return json({ error: 'Error de configuración del servidor' }, 500);
  }

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:     'Nuvika Web <no-reply@nuvika.cl>',
        to:       [toEmail],
        reply_to: email,
        subject:  `Nuevo contacto web — ${nombre}${empresa ? ` (${empresa})` : ''}`,
        html:     buildHtml({ nombre, email, empresa, mensaje }),
        text:     `Nuevo contacto de ${nombre} <${email}>\n${empresa ? `Empresa: ${empresa}\n` : ''}\n${mensaje}`,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.json().catch(() => ({}));
      console.error('Resend error:', err);
      return json({ error: 'No se pudo enviar el mensaje. Intenta por WhatsApp.' }, 502);
    }

    return json({ ok: true, message: 'Mensaje enviado correctamente' }, 200);
  } catch (err) {
    console.error('Fetch error:', err);
    return json({ error: 'Error de red interno' }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function buildHtml({ nombre, email, empresa, mensaje }) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>
  body{font-family:sans-serif;background:#0d1117;color:#e6edf3;margin:0;padding:32px}
  .card{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:32px;max-width:560px;margin:auto}
  .logo{color:#00C8FF;font-size:22px;font-weight:700;letter-spacing:2px;margin-bottom:24px}
  .row{margin-bottom:16px}
  .label{font-size:11px;text-transform:uppercase;color:#8b949e;letter-spacing:1px;margin-bottom:4px}
  .value{font-size:15px;color:#e6edf3}
  .msg{background:#0d1117;border-radius:8px;padding:16px;white-space:pre-wrap;line-height:1.6;font-size:14px}
  .footer{margin-top:24px;font-size:12px;color:#8b949e;text-align:center}
</style></head>
<body>
<div class="card">
  <div class="logo">NUVI<span style="color:#e6edf3;opacity:.7">KA</span></div>
  <div class="row"><div class="label">Nombre</div><div class="value">${esc(nombre)}</div></div>
  <div class="row"><div class="label">Email</div><div class="value"><a href="mailto:${esc(email)}" style="color:#00C8FF">${esc(email)}</a></div></div>
  ${empresa ? `<div class="row"><div class="label">Empresa</div><div class="value">${esc(empresa)}</div></div>` : ''}
  <div class="row"><div class="label">Mensaje</div><div class="msg">${esc(mensaje)}</div></div>
  <div class="footer">Enviado desde nuvika.cl · ${new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' })}</div>
</div>
</body></html>`;
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
