import { formatRemitoFecha } from '../utils/remitoStorage';

function itemDescripcion(linea) {
  const parts = [linea.nombre];
  const detalle = [linea.tipo, linea.marca, linea.modelo, linea.detalle].filter(Boolean).join(' — ');
  if (detalle) parts.push(detalle);
  return parts.join(' — ');
}

function formatInicioActividades(fecha) {
  if (!fecha) return '';
  return formatRemitoFecha(String(fecha).slice(0, 10));
}

export default function RemitoDocument({ form, lineas, empresa }) {
  const fechaLabel = formatRemitoFecha(form.fecha);
  const inicioAct = formatInicioActividades(empresa?.fechaInicioActividades);

  return (
    <div className="remito-doc mx-auto max-w-[210mm] bg-white p-4 pt-8 font-serif text-[11px] leading-tight text-black print:px-0 print:pb-0 print:pt-[15mm]">
      {/* Encabezado emisor */}
      <div className="mb-2 flex border-2 border-black">
        <div className="flex-1 border-r border-black p-2">
          <div className="flex items-start gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center border border-black/40 text-[8px] text-black/50">
              LOGO
            </div>
            <div>
              <p className="text-base font-bold uppercase tracking-wide">
                {empresa?.razonSocial || empresa?.nombre || '—'}
              </p>
              {empresa?.domicilio && <p>{empresa.domicilio}</p>}
              {empresa?.localidad && <p>{empresa.localidad}</p>}
              <p className="mt-1">
                {[
                  empresa?.telefono && `Tel: ${empresa.telefono}`,
                  empresa?.fax && `Fax: ${empresa.fax}`,
                ]
                  .filter(Boolean)
                  .join(' — ')}
              </p>
              <p>
                {[empresa?.email, empresa?.web].filter(Boolean).join(' — ')}
              </p>
            </div>
          </div>
        </div>
        <div className="flex w-[42%] flex-col">
          <div className="border-b border-black p-1.5 text-center text-[10px]">
            <p className="font-bold">IVA Responsable Inscripto</p>
            <div className="mt-1 flex items-center justify-center gap-2">
              <span>Código {empresa?.codigoDocumento || '91'}</span>
              <span className="inline-flex h-5 w-5 items-center justify-center border border-black font-bold">
                R
              </span>
            </div>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center p-2 text-center">
            <p className="text-lg font-bold tracking-widest">REMITO</p>
            <p className="mt-1 text-[9px] font-semibold uppercase leading-snug">
              Documento no válido
              <br />
              como factura
            </p>
          </div>
        </div>
      </div>

      {/* N°, fecha, CUIT */}
      <div className="mb-2 grid grid-cols-2 gap-x-4 border border-black p-2 text-[10px]">
        <div className="space-y-1">
          <p>
            <span className="font-bold">N°:</span>{' '}
            <span className="inline-block min-w-[60px] border-b border-black/60">
              {form.numero || '—'}
            </span>
          </p>
          <p>
            <span className="font-bold">C.U.I.T.:</span> {empresa?.cuit || '—'}
          </p>
        </div>
        <div className="space-y-1">
          <p>
            <span className="font-bold">Fecha:</span> {fechaLabel || '—'}
          </p>
          <p>
            <span className="font-bold">Ing. Brutos:</span> {empresa?.ingBrutos || '—'}
          </p>
          <p>
            <span className="font-bold">Inicio actividades:</span> {inicioAct || '—'}
          </p>
        </div>
      </div>

      {/* Destinatario */}
      <div className="mb-2 border border-black p-2 text-[10px]">
        <div className="grid gap-1 sm:grid-cols-2">
          <p>
            <span className="font-bold">Señor(es):</span>{' '}
            <span className="inline-block min-w-[120px] border-b border-black/40">
              {form.destinatario || ''}
            </span>
          </p>
          <p>
            <span className="font-bold">IVA:</span>{' '}
            <span className="inline-block min-w-[80px] border-b border-black/40">
              {form.iva || ''}
            </span>
          </p>
          <p className="sm:col-span-2">
            <span className="font-bold">Domicilio:</span>{' '}
            <span className="inline-block min-w-[200px] border-b border-black/40">
              {form.domicilio || ''}
            </span>
          </p>
          <p>
            <span className="font-bold">Localidad:</span>{' '}
            <span className="inline-block min-w-[100px] border-b border-black/40">
              {form.localidad || ''}
            </span>
          </p>
          <p>
            <span className="font-bold">V. Ref.:</span>{' '}
            <span className="inline-block min-w-[80px] border-b border-black/40">
              {form.vRef || ''}
            </span>
          </p>
          <p className="sm:col-span-2">
            <span className="font-bold">C.U.I.T.:</span>{' '}
            <span className="inline-block min-w-[120px] border-b border-black/40">
              {form.cuit || ''}
            </span>
          </p>
        </div>
      </div>

      {/* Tabla ítems */}
      <div className="mb-2 border border-black">
        <p className="border-b border-black bg-black/5 px-2 py-1 text-center text-[10px] font-bold uppercase">
          Remitimos a usted (es) lo siguiente
        </p>
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="border-b border-black">
              <th className="w-14 border-r border-black/40 px-2 py-1 text-left font-bold">CANT.</th>
              <th className="border-r border-black/40 px-2 py-1 text-left font-bold">DESCRIPCIÓN</th>
              <th className="w-16 px-2 py-1 text-right font-bold">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((linea) => (
              <tr key={linea.stockId} className="border-b border-black/30 align-top">
                <td className="border-r border-black/20 px-2 py-1.5 text-center font-semibold">
                  {linea.cantidad}
                </td>
                <td className="border-r border-black/20 px-2 py-1.5">{itemDescripcion(linea)}</td>
                <td className="px-2 py-1.5 text-right font-semibold">{linea.cantidad}</td>
              </tr>
            ))}
            {!lineas.length && (
              <tr>
                <td colSpan={3} className="px-2 py-6 text-center text-black/50">
                  Sin ítems
                </td>
              </tr>
            )}
            {lineas.length > 0 &&
              lineas.length < 8 &&
              Array.from({ length: 8 - lineas.length }).map((_, i) => (
                <tr key={`empty-${i}`} className="border-b border-black/20">
                  <td className="border-r border-black/20 px-2 py-3">&nbsp;</td>
                  <td className="border-r border-black/20 px-2 py-3">&nbsp;</td>
                  <td className="px-2 py-3">&nbsp;</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Transporte */}
      <div className="mb-2 border border-black p-2 text-[10px]">
        <p className="mb-1">
          <span className="font-bold">Cant. de bultos:</span>{' '}
          <span className="inline-block min-w-[40px] border-b border-black/40">
            {form.bultos || ''}
          </span>
        </p>
        <p>
          <span className="font-bold">Transportista:</span>{' '}
          <span className="inline-block min-w-[100px] border-b border-black/40">
            {form.transportista || ''}
          </span>
          <span className="ml-4 font-bold">Razón social:</span>{' '}
          <span className="inline-block min-w-[100px] border-b border-black/40">
            {form.transportista || ''}
          </span>
        </p>
        <p className="mt-1">
          <span className="font-bold">C.U.I.T.:</span>{' '}
          <span className="inline-block min-w-[100px] border-b border-black/40">
            {form.cuitTransportista || ''}
          </span>
          <span className="ml-4 font-bold">Domicilio:</span>{' '}
          <span className="inline-block min-w-[140px] border-b border-black/40">
            {form.domicilioTransportista || ''}
          </span>
        </p>
      </div>

      {/* Recepción */}
      <div className="grid border border-black text-[10px] sm:grid-cols-2">
        <div className="border-b border-black p-3 sm:border-b-0 sm:border-r">
          <p className="mb-10 font-bold">Recibí conforme</p>
          <div className="border-t border-black pt-1 text-center">Firma y sello</div>
        </div>
        <div className="space-y-4 p-3">
          <div>
            <span className="font-bold">Aclaración:</span>
            <div className="mt-1 min-h-[20px] border-b border-black/60">{form.aclaracion || ''}</div>
          </div>
          <div>
            <span className="font-bold">D.N.I.:</span>
            <div className="mt-1 min-h-[20px] border-b border-black/60">{form.dni || ''}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
