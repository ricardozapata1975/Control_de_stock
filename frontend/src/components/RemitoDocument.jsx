import { formatRemitoFecha } from '../utils/remitoStorage';

function itemDescripcion(linea) {
  const parts = [linea.nombre];
  const detalle = [linea.tipo, linea.marca, linea.modelo, linea.detalle].filter(Boolean).join(' — ');
  if (detalle) parts.push(detalle);
  if (linea.ubicacion) parts.push(`Ubic.: ${linea.ubicacion}`);
  return parts;
}

export default function RemitoDocument({ form, lineas, empresaNombre }) {
  const fechaLabel = formatRemitoFecha(form.fecha);

  return (
    <div className="remito-doc mx-auto max-w-[210mm] bg-white p-6 text-black print:p-0">
      <header className="mb-4 border-b-2 border-black pb-3 text-center">
        <p className="text-xl font-bold uppercase tracking-wide">{empresaNombre}</p>
        <p className="mt-1 text-lg font-semibold">Remito de salida</p>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <div>
          <span className="font-semibold">N° Remito:</span> {form.numero || '—'}
        </div>
        <div className="text-right">
          <span className="font-semibold">Fecha:</span> {fechaLabel || '—'}
        </div>
      </div>

      <section className="mb-4 rounded border border-black/40 p-3 text-sm">
        <div className="grid gap-1 sm:grid-cols-2">
          <p>
            <span className="font-semibold">Señor(es):</span> {form.destinatario || '—'}
          </p>
          <p>
            <span className="font-semibold">IVA:</span> {form.iva || '—'}
          </p>
          <p className="sm:col-span-2">
            <span className="font-semibold">Domicilio:</span> {form.domicilio || '—'}
          </p>
          <p>
            <span className="font-semibold">Localidad:</span> {form.localidad || '—'}
          </p>
          <p>
            <span className="font-semibold">V. Ref.:</span> {form.vRef || '—'}
          </p>
          <p className="sm:col-span-2">
            <span className="font-semibold">C.U.I.T.:</span> {form.cuit || '—'}
          </p>
        </div>
      </section>

      <table className="mb-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black">
            <th className="w-16 py-2 text-left font-bold">CANT.</th>
            <th className="py-2 text-left font-bold">DESCRIPCIÓN</th>
          </tr>
        </thead>
        <tbody>
          {lineas.map((linea) => {
            const desc = itemDescripcion(linea);
            return (
              <tr key={linea.stockId} className="border-b border-black/30 align-top">
                <td className="py-2 pr-3 font-semibold">{linea.cantidad}</td>
                <td className="py-2">
                  <p className="font-medium">{desc[0]}</p>
                  {desc.slice(1).map((part, i) => (
                    <p key={i} className="text-xs text-black/80">
                      {part}
                    </p>
                  ))}
                </td>
              </tr>
            );
          })}
          {!lineas.length && (
            <tr>
              <td colSpan={2} className="py-4 text-center text-black/60">
                Sin ítems
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <section className="mb-6 grid gap-1 border-t border-black/40 pt-3 text-sm">
        <p>
          <span className="font-semibold">Cant. de Bultos:</span> {form.bultos || '—'}
        </p>
        <p>
          <span className="font-semibold">Transportista / Razón Social:</span>{' '}
          {form.transportista || '—'}
        </p>
        <p>
          <span className="font-semibold">C.U.I.T. transportista:</span>{' '}
          {form.cuitTransportista || '—'}
        </p>
        <p>
          <span className="font-semibold">Domicilio transportista:</span>{' '}
          {form.domicilioTransportista || '—'}
        </p>
      </section>

      <section className="grid gap-6 border-t-2 border-black pt-4 text-sm sm:grid-cols-2">
        <div>
          <p className="mb-8 font-semibold">Recibí conforme</p>
          <div className="border-b border-black pb-1">Firma y Sello</div>
        </div>
        <div className="space-y-3">
          <div>
            <span className="font-semibold">Aclaración:</span>
            <div className="mt-1 border-b border-black/50 pb-1">{form.aclaracion || ''}</div>
          </div>
          <div>
            <span className="font-semibold">D.N.I.:</span>
            <div className="mt-1 border-b border-black/50 pb-1">{form.dni || ''}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
