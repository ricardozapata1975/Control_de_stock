import nodemailer from 'nodemailer';
import { config } from '../config.js';

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
  if (email.provider === 'resend') {
    if (!email.resendApiKey) return null;
    return nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      auth: { user: 'resend', pass: email.resendApiKey },
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
    });
  }
  return null;
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
  const from = config.email.from;
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

  const transport = getTransport();
  if (!transport) {
    throw Object.assign(new Error('Servicio de email no configurado en el servidor'), { status: 503 });
  }

  await transport.sendMail({ from, to, subject, text, html });
  return { ok: true, mode: config.email.provider };
}

export async function sendWelcomeEmail({ to, displayName, username }) {
  const loginUrl = buildLoginUrl();
  const from = config.email.from;
  const subject = 'Bienvenido a Inventario Px Control';
  const greeting = displayName || username || 'usuario';
  const userLabel = username || 'tu usuario';

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
    <p>Hola <strong>${greeting}</strong>,</p>
    <p>Te damos la bienvenida a <strong>Inventario Px Control</strong>. Seguí estos pasos para tu primer ingreso:</p>
    <ol>
      <li>Abrí <a href="${loginUrl}">${loginUrl}</a></li>
      <li>Hacé clic en <strong>Primer ingreso — crear contraseña</strong></li>
      <li>Ingresá tu usuario: <strong>${userLabel}</strong></li>
      <li>Creá tu contraseña personal (mínimo 6 caracteres)</li>
      <li>Listo: ya podés usar el inventario, egreso e ingreso de herramientas</li>
    </ol>
    <p>Si tenés problemas, contactá al administrador del sistema.</p>
    <p>— Inventario Px Control</p>
  `;

  if (config.email.provider === 'console') {
    console.log('[Email/console] Welcome email');
    console.log(`  To: ${to}`);
    console.log(`  Usuario: ${userLabel}`);
    console.log(`  Login: ${loginUrl}`);
    return { ok: true, mode: 'console', loginUrl };
  }

  const transport = getTransport();
  if (!transport) {
    throw Object.assign(new Error('Servicio de email no configurado en el servidor'), { status: 503 });
  }

  await transport.sendMail({ from, to, subject, text, html });
  return { ok: true, mode: config.email.provider };
}
