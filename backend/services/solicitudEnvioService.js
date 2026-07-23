import { listInventario } from './inventarioService.js';
import { resolveSedeInfo } from './sedeScope.js';
import { isEmailConfigured, sendSolicitudEnvioEmail } from './emailService.js';
import { listUsers } from './userService.js';
import { config } from '../config.js';

function parseExtraRecipients() {
  return String(config.email.solicitudesTo || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function resolveRecipients() {
  const extras = parseExtraRecipients();
  const users = await listUsers();
  const adminEmails = (users || [])
    .filter((u) => u.role === 'admin' && u.isActive !== false && u.email)
    .map((u) => String(u.email).trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...adminEmails, ...extras])];
}

export async function solicitarEnvio(
  { itemId, stockId, cantidad, sedeOrigen, sedeDestino, mensaje = '' },
  requester
) {
  if (!isEmailConfigured()) {
    throw Object.assign(new Error('El envío de correos no está configurado en el servidor'), {
      status: 503,
    });
  }

  const qty = Number(cantidad);
  if (!qty || qty <= 0) {
    throw Object.assign(new Error('Indicá una cantidad válida a solicitar'), { status: 400 });
  }
  if (!itemId) {
    throw Object.assign(new Error('Ítem requerido'), { status: 400 });
  }

  const origen = resolveSedeInfo(sedeOrigen || requester?.sede);
  const destino = resolveSedeInfo(sedeDestino);

  if (origen.codigo === destino.codigo) {
    throw Object.assign(
      new Error('La sucursal consultada debe ser distinta a la sucursal activa'),
      { status: 400 }
    );
  }

  const { items } = await listInventario({
    sede: destino.codigo,
    itemId,
  });
  const rows = items || [];
  const match =
    (stockId &&
      rows.find(
        (r) => String(r.stockId) === String(stockId) || String(r.id) === String(stockId)
      )) ||
    rows[0];

  if (!match) {
    throw Object.assign(new Error('No se encontró ese ítem en la sucursal consultada'), {
      status: 404,
    });
  }

  if (qty > Number(match.cantidad || 0)) {
    throw Object.assign(
      new Error(`Stock insuficiente en ${destino.nombre}: hay ${match.cantidad} u.`),
      { status: 400 }
    );
  }

  const recipients = await resolveRecipients();
  if (!recipients.length) {
    throw Object.assign(
      new Error(
        'No hay destinatarios: cargá email en usuarios admin o configurá EMAIL_SOLICITUDES_TO'
      ),
      { status: 503 }
    );
  }

  const result = await sendSolicitudEnvioEmail({
    to: recipients,
    requesterName: requester?.name || requester?.username || 'Usuario',
    requesterUsername: requester?.username || '',
    itemNombre: match.nombre,
    itemMarca: match.marca || '',
    itemModelo: match.modelo || '',
    cantidad: qty,
    ubicacion: match.ubicacion || match.contenedorCodigo || '',
    sedeOrigenNombre: origen.nombre,
    sedeOrigenCodigo: origen.codigo,
    sedeDestinoNombre: destino.nombre,
    sedeDestinoCodigo: destino.codigo,
    mensaje: String(mensaje || '').trim(),
  });

  return {
    ok: true,
    message: `Solicitud enviada a ${recipients.length} destinatario${recipients.length === 1 ? '' : 's'}`,
    recipients,
    mode: result.mode || config.email.provider,
    itemId: match.itemId,
    cantidad: qty,
    sedeOrigen: origen.codigo,
    sedeDestino: destino.codigo,
  };
}
