import nodemailer from 'nodemailer';
import { config } from '../config.js';

const EMAIL_SEND_TIMEOUT_MS = 20000;
const TRANSPORT_TIMEOUT_MS = 15000;
const RESEND_TEST_FROM = 'Inventario Px Control <onboarding@resend.dev>';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function extractEmailAddress(from) {
  const raw = String(from || '').trim();
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).trim().toLowerCase();
}


function resolveFromAddress() {
  return String(config.email.from || '').trim() || RESEND_TEST_FROM;
}

function buildFrontendUrl(path = '') {
  const base = config.frontendUrl.replace(/\/$/, '');
  if (!path) return base;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function buildResetUrl(token) {
  return `${buildFrontendUrl()}/reset-password?token=${encodeURIComponent(token)}`;
}

function buildLoginUrl() {
  return buildFrontendUrl('/login');
}

function getTransport() {
  const { email } = config;
  const transportOptions = {
    connectionTimeout: TRANSPORT_TIMEOUT_MS,
    greetingTimeout: TRANSPORT_TIMEOUT_MS,
    socketTimeout: TRANSPORT_TIMEOUT_MS,
  };
  if (email.provider === 'resend') {
    if (!email.resendApiKey) return null;
    return nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      auth: { user: 'resend', pass: email.resendApiKey },
      ...transportOptions,
    });
  }
  if (email.provider === 'smtp') {
    if (!email.smtp.host) return null;
    return nodemailer.createTransport({
      host: email.smtp.host,
      port: email.smtp.port,
      secure: email.smtp.secure,
      auth: email.smtp.user
        ? { user: email.smtp.user, pass: email.smtp.pass }
        : undefined,
      ...transportOptions,
    });
  }
  return null;
}

async function sendWithTimeout(promise, ms = EMAIL_SEND_TIMEOUT_MS) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(
            Object.assign(
              new Error(
                'Tiempo de espera agotado al enviar el correo. Verificá EMAIL_PROVIDER y credenciales SMTP/Resend en Render.'
              ),
              { status: 504 }
            )
          );
        }, ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function formatResendError(status, detail, to) {
  const normalized = String(detail || '').trim();
  const sandboxRestriction =
    status === 403 &&
    /own email|verify a domain|resend\.dev|testing emails/i.test(normalized);

  if (sandboxRestriction) {
    return (
      `No se puede enviar a ${to}: Resend está en modo prueba (onboarding@resend.dev). ` +
      'Solo permite enviar al correo con el que creaste la cuenta Resend. ' +
      'Para invitar a otros usuarios (ej. @systelec.com), verificá el dominio en resend.com/domains ' +
      'y actualizá EMAIL_FROM en Render con un correo de ese dominio verificado.'
    );
  }

  return `Resend: ${normalized || `HTTP ${status}`}`;
}

async function sendViaResendApi({ from, to, subject, text, html }) {
  const { resendApiKey } = config.email;
  if (!resendApiKey) {
    throw Object.assign(new Error('RESEND_API_KEY no configurada'), { status: 503 });
  }

  const toList = (Array.isArray(to) ? to : [to]).map((e) => String(e || '').trim()).filter(Boolean);
  if (!toList.length) {
    throw Object.assign(new Error('Destinatario de correo inválido'), { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EMAIL_SEND_TIMEOUT_MS);
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: toList, subject, text, html }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail =
        data.message ||
        (Array.isArray(data.errors) ? data.errors.map((e) => e.message).join('; ') : null) ||
        data.error ||
        `HTTP ${res.status}`;
      throw Object.assign(new Error(formatResendError(res.status, detail, toList.join(', '))), {
        status: res.status >= 500 ? 502 : 400,
      });
    }
    if (!data.id) {
      console.warn('[Email/Resend] Respuesta sin id de mensaje:', data);
    } else {
      console.log(`[Email/Resend] Enviado id=${data.id} to=${toList.join(', ')} from=${from}`);
    }
    return { ok: true, mode: 'resend', id: data.id };
  } catch (err) {
    if (err.name === 'AbortError') {
      throw Object.assign(
        new Error('Tiempo de espera agotado al enviar el correo vía Resend.'),
        { status: 504 }
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function deliverEmail({ from, to, subject, text, html }) {
  if (config.email.provider === 'resend') {
    return sendViaResendApi({
      from: resolveFromAddress({ logWarning: true }),
      to,
      subject,
      text,
      html,
    });
  }

  const transport = getTransport();
  if (!transport) {
    throw Object.assign(new Error('Servicio de email no configurado en el servidor'), { status: 503 });
  }

  await sendWithTimeout(transport.sendMail({ from, to, subject, text, html }));
  return { ok: true, mode: config.email.provider };
}

export function getEmailStatus() {
  const { email } = config;
  const effectiveFrom = resolveFromAddress();
  const configuredFrom = email.from || RESEND_TEST_FROM;
  return {
    configured: isEmailConfigured(),
    provider: email.provider,
    sendsRealEmail: email.provider !== 'console',
    from: effectiveFrom,
    fromConfigured: configuredFrom,
    usesResendTestFrom:
      email.provider === 'resend' &&
      extractEmailAddress(effectiveFrom).endsWith('@resend.dev') &&
      !extractEmailAddress(configuredFrom).endsWith('@resend.dev'),
    resendSandboxOnly:
      email.provider === 'resend' && extractEmailAddress(effectiveFrom).endsWith('@resend.dev'),
  };
}

export function isEmailConfigured() {
  const { email } = config;
  if (email.provider === 'console') return true;
  if (email.provider === 'resend') return !!email.resendApiKey;
  if (email.provider === 'smtp') return !!email.smtp.host;
  return false;
}

export async function sendPasswordResetEmail({ to, username, token }) {
  const resetUrl = buildResetUrl(token);
  const from = resolveFromAddress({ logWarning: true });
  const subject = 'Restablecer contraseña — Inventario Px Control';
  const text = [
    `Hola${username ? ` ${username}` : ''},`,
    '',
    'Recibimos una solicitud para restablecer tu contraseña del inventario.',
    'Si no fuiste vos, ignorá este correo.',
    '',
    `Abrí este enlace (válido 1 hora):`,
    resetUrl,
    '',
    '— Inventario Px Control',
  ].join('\n');

  const html = `
    <p>Hola${username ? ` <strong>${username}</strong>` : ''},</p>
    <p>Recibimos una solicitud para restablecer tu contraseña del inventario.</p>
    <p>Si no fuiste vos, ignorá este correo.</p>
    <p><a href="${resetUrl}">Restablecer contraseña</a></p>
    <p class="muted">El enlace vence en 1 hora.</p>
    <p>— Inventario Px Control</p>
  `;

  if (config.email.provider === 'console') {
    console.log('[Email/console] Password reset');
    console.log(`  To: ${to}`);
    console.log(`  Link: ${resetUrl}`);
    return { ok: true, mode: 'console', resetUrl };
  }

  return deliverEmail({ from, to, subject, text, html });
}

export async function sendWelcomeEmail({ to, displayName, username }) {
  const loginUrl = buildLoginUrl();
  const from = resolveFromAddress({ logWarning: true });
  const recipient = String(to || '').trim().toLowerCase();
  if (!recipient) {
    throw Object.assign(new Error('Destinatario de correo inválido'), { status: 400 });
  }
  const subject = 'Bienvenido a Inventario Px Control';
  const greeting = displayName || username || 'usuario';
  const userLabel = username || 'tu usuario';
  const safeGreeting = escapeHtml(greeting);
  const safeUserLabel = escapeHtml(userLabel);
  const safeLoginUrl = escapeHtml(loginUrl);

  const text = [
    `Hola ${greeting},`,
    '',
    'Te damos la bienvenida a Inventario Px Control. Seguí estos pasos para tu primer ingreso:',
    '',
    `1. Abrí ${loginUrl}`,
    '2. Hacé clic en "Primer ingreso — crear contraseña"',
    `3. Ingresá tu usuario: ${userLabel}`,
    '4. Creá tu contraseña personal (mínimo 6 caracteres)',
    '5. Listo: ya podés usar el inventario, egreso e ingreso de herramientas',
    '',
    'Si tenés problemas, contactá al administrador del sistema.',
    '',
    '— Inventario Px Control',
  ].join('\n');

  const html = `
    <p>Hola <strong>${safeGreeting}</strong>,</p>
    <p>Te damos la bienvenida a <strong>Inventario Px Control</strong>. Seguí estos pasos para tu primer ingreso:</p>
    <ol>
      <li>Abrí <a href="${safeLoginUrl}">${safeLoginUrl}</a></li>
      <li>Hacé clic en <strong>Primer ingreso — crear contraseña</strong></li>
      <li>Ingresá tu usuario: <strong>${safeUserLabel}</strong></li>
      <li>Creá tu contraseña personal (mínimo 6 caracteres)</li>
      <li>Listo: ya podés usar el inventario, egreso e ingreso de herramientas</li>
    </ol>
    <p>Si tenés problemas, contactá al administrador del sistema.</p>
    <p>— Inventario Px Control</p>
  `;

  if (config.email.provider === 'console') {
    console.log('[Email/console] Welcome email');
    console.log(`  To: ${recipient}`);
    console.log(`  Usuario: ${userLabel}`);
    console.log(`  Login: ${loginUrl}`);
    return { ok: true, mode: 'console', loginUrl };
  }

  return deliverEmail({ from, to: recipient, subject, text, html });
}

export async function sendSolicitudEnvioEmail({
  to,
  requesterName,
  requesterUsername,
  itemNombre,
  itemMarca,
  itemModelo,
  cantidad,
  ubicacion,
  sedeOrigenNombre,
  sedeOrigenCodigo,
  sedeDestinoNombre,
  sedeDestinoCodigo,
  mensaje,
}) {
  const recipients = (Array.isArray(to) ? to : [to])
    .map((e) => String(e || '').trim().toLowerCase())
    .filter(Boolean);
  if (!recipients.length) {
    throw Object.assign(new Error('Destinatario de correo inválido'), { status: 400 });
  }

  const from = resolveFromAddress({ logWarning: true });
  const itemLabel = [itemNombre, itemMarca, itemModelo].filter(Boolean).join(' · ');
  const subject = `Solicitud de envío: ${itemNombre} (${sedeDestinoNombre} → ${sedeOrigenNombre})`;
  const msgBlock = mensaje ? `\nMensaje del solicitante:\n${mensaje}\n` : '';
  const text = [
    'Solicitud de envío entre sucursales',
    '',
    `Solicitante: ${requesterName}${requesterUsername ? ` (${requesterUsername})` : ''}`,
    `Sucursal que pide: ${sedeOrigenNombre} (${sedeOrigenCodigo})`,
    `Sucursal con stock: ${sedeDestinoNombre} (${sedeDestinoCodigo})`,
    '',
    `Ítem: ${itemLabel}`,
    `Cantidad pedida: ${cantidad}`,
    `Ubicación en origen del stock: ${ubicacion || '—'}`,
    msgBlock,
    'Esta solicitud no mueve stock automáticamente. Coordiná el remito/transferencia según el procedimiento habitual.',
    '',
    '— Inventario Px Control',
  ]
    .filter((line) => line !== undefined)
    .join('\n');

  const safe = escapeHtml;
  const html = `
    <h2>Solicitud de envío entre sucursales</h2>
    <p><strong>Solicitante:</strong> ${safe(requesterName)}${
      requesterUsername ? ` (${safe(requesterUsername)})` : ''
    }</p>
    <p><strong>Sucursal que pide:</strong> ${safe(sedeOrigenNombre)} (${safe(sedeOrigenCodigo)})</p>
    <p><strong>Sucursal con stock:</strong> ${safe(sedeDestinoNombre)} (${safe(sedeDestinoCodigo)})</p>
    <ul>
      <li><strong>Ítem:</strong> ${safe(itemLabel)}</li>
      <li><strong>Cantidad pedida:</strong> ${safe(cantidad)}</li>
      <li><strong>Ubicación:</strong> ${safe(ubicacion || '—')}</li>
    </ul>
    ${
      mensaje
        ? `<p><strong>Mensaje:</strong></p><p>${safe(mensaje)}</p>`
        : ''
    }
    <p class="muted">Esta solicitud no mueve stock automáticamente. Coordiná el remito/transferencia según el procedimiento habitual.</p>
    <p>— Inventario Px Control</p>
  `;

  if (config.email.provider === 'console') {
    console.log('[Email/console] Solicitud de envío');
    console.log(`  To: ${recipients.join(', ')}`);
    console.log(`  Subject: ${subject}`);
    console.log(text);
    return { ok: true, mode: 'console', recipients };
  }

  await deliverEmail({ from, to: recipients, subject, text, html });
  return { ok: true, mode: config.email.provider, recipients };
}

