import RemitoEgresoLoteDocument from './RemitoEgresoLoteDocument';

export default function RemitoEgresoLotePrintModal({ lote, onClose }) {
  if (!lote) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-zinc-950 print:static print:bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 print:hidden">
        <div>
          <h3 className="text-lg font-bold text-content">Remito de retiro</h3>
          <p className="text-sm text-muted">
            Imprimí o guardá como PDF. El QR sirve para devolver el contenedor completo.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-primary" onClick={handlePrint}>
            Imprimir / PDF
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 print:p-0">
        <RemitoEgresoLoteDocument lote={lote} />
      </div>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .remito-doc, .remito-doc * { visibility: visible !important; }
          .remito-doc {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}
